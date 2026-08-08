import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { formatDateDMY, normalizeToYMD, getFinancialYear } from "../../../utils/helper";
import { useMutation } from "@apollo/client";
import { SEND_OUTSTANDING_REMINDER } from "../../../graphql/queries/notifications";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

import { FaUserClock, FaStoreSlash, FaHistory, FaBell } from "react-icons/fa";

const reportTabsObj = [
  { id: "Customer Outstanding", label: "Customer Outstanding", icon: <FaUserClock className="text-blue-600" /> },
  { id: "Vendor Outstanding", label: "Vendor Outstanding", icon: <FaStoreSlash className="text-amber-600" /> },
  { id: "Receivable / Payable Aging", label: "Receivable / Payable Aging", icon: <FaHistory className="text-emerald-600" /> },
];

const fmtAmt = (n: number) =>
  n >= 0 ? n.toFixed(2) : `(${Math.abs(n).toFixed(2)})`;

// "Party Name - Mobile"
const partyLabelOf = (a: any) =>
  `${a.name || "-"}${a.mobile ? ` - ${a.mobile}` : ""}`;

const PartyReports: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state: any) => state.auth);
  const adminid =
    auth.type === "admin"
      ? auth.admin?.id
      : auth.type === "branch"
        ? auth.branch?.admin?.id
        : auth.type === "staff"
          ? auth.staff?.admin?.id
          : undefined;
  const branchid = auth.type === "branch" ? auth.branch?.id : undefined;

  const [sendReminder, { loading: reminderLoading }] = useMutation(SEND_OUTSTANDING_REMINDER);
  // Track which row is mid-send so only that button shows a busy state.
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // Manual payment reminder: one click creates the in-app notification for
  // that party (it shows up in both the party mobile app and the party
  // website, since both read the same party-targeted notifications) and
  // opens WhatsApp on that same party's stored mobile number.
  const handleSendReminder = async (row: any) => {
    if (!row?._partyid || !adminid) return;

    // Bill-wise amount (unpaid bills only) — matches the party's own
    // dashboard, so the reminder and what they see after logging in agree.
    const amount = Number(row._billOutstanding || 0);
    if (amount <= 0) {
      dispatch(
        showMessage({ message: "No outstanding amount for this party.", type: "info" })
      );
      return;
    }

    // Pop the WhatsApp tab synchronously from the click, before awaiting the
    // mutation — browsers block window.open() called after an await, since it
    // no longer counts as a direct user gesture.
    //
    // NOTE: no "noopener" here on purpose. With noopener the browser returns
    // null instead of a window handle, which left the placeholder tab stranded
    // on about:blank with no way to navigate or close it. We drop the opener
    // reference manually right after navigating instead.
    const waTab = window.open("", "_blank");

    setRemindingId(row._partyid);
    try {
      const { data } = await sendReminder({
        variables: {
          input: {
            adminid,
            branchid: branchid || null,
            partyid: row._partyid,
            amount,
            pendingBills: Number(row.pendingBills || 0),
            overdueDays: Number(row._overdueDays || 0),
            dueDate: row._dueDateLabel || "",
          },
        },
      });

      const res = data?.sendOutstandingReminder;
      if (!res?.success) {
        waTab?.close();
        dispatch(showMessage({ message: "Failed to send reminder.", type: "error" }));
        return;
      }

      if (res.mobile) {
        const wa = `https://wa.me/${res.mobile}?text=${encodeURIComponent(res.message || "")}`;
        if (waTab) {
          waTab.opener = null; // don't hand WhatsApp a reference back to us
          waTab.location.replace(wa);
        } else {
          // Popup blocker ate the placeholder — try a direct open instead.
          window.open(wa, "_blank", "noopener,noreferrer");
        }
        dispatch(
          showMessage({
            message: `Reminder sent to ${row._partyname} — WhatsApp opened.`,
            type: "success",
          })
        );
      } else {
        // In-app notification still went out; only WhatsApp is unavailable.
        waTab?.close();
        dispatch(
          showMessage({
            message: `Reminder sent to ${row._partyname} in-app. No mobile number saved for WhatsApp.`,
            type: "info",
          })
        );
      }
    } catch (e: any) {
      waTab?.close();
      console.error("Outstanding reminder failed:", e);
      dispatch(showMessage({ message: e?.message || "Failed to send reminder.", type: "error" }));
    } finally {
      setRemindingId(null);
    }
  };

  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  const fy = getFinancialYear();

  // -----------------------------
  // Fetch data
  // -----------------------------
  const { data: accountsData } = useAccountsQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: salesInvData } = useSalesInvoicesQuery();
  const { data: purchaseInvData } = usePurchaseInvoicesQuery();

  const accounts = [...(accountsData?.getAccounts || [])].reverse();
  const payments = paymentsData?.getPayments || [];
  const ledgers = ledgerData?.getAccountLedgers || [];
  const salesInvoices = salesInvData?.getSalesInvoices || [];
  const purchaseInvoices = purchaseInvData?.getPurchaseInvoices || [];

  // -----------------------------
  // Default filters = current financial year
  // -----------------------------
  useEffect(() => {
    const from = normalizeToYMD(fy.start);
    const to = normalizeToYMD(new Date());
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getFilterTimestamps = () => {
    const fromTimestamp = appliedFilters.fromDate
      ? new Date(appliedFilters.fromDate + "T00:00:00").getTime()
      : null;
    const toTimestamp = appliedFilters.toDate
      ? new Date(appliedFilters.toDate + "T23:59:59").getTime()
      : null;
    return { fromTimestamp, toTimestamp };
  };

  // -----------------------------
  // Per-invoice settled amounts (from payments)
  // -----------------------------
  const settledByInvoice = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p: any) => {
      (p.invoices || []).forEach((inv: any) => {
        if (!inv.invoiceid) return;
        map[inv.invoiceid] =
          (map[inv.invoiceid] || 0) + (inv.settledamount || 0) + (inv.discount || 0);
      });
    });
    return map;
  }, [payments]);

  // -----------------------------
  // Opening balance of a party's ledger
  // -----------------------------
  const getOpeningBalance = (account: any) => {
    const ledger = ledgers.find((l: any) => l.id === account.ledgerid?.id);
    if (!ledger) {
      return account.openingbalancetype === "debit"
        ? account.openingbalance || 0
        : -(account.openingbalance || 0);
    }
    return ledger.openingbalancetype === "debit"
      ? ledger.openingbalance || 0
      : -(ledger.openingbalance || 0);
  };

  // -----------------------------
  // Bill-wise outstanding.
  //
  // Previously this was computed ledger-wise (opening + every journal entry
  // on the party ledger, then minus payment settlements). That double-counted
  // every receipt: a payment already posts a credit on the party ledger
  // (resolvers/payments builds that entry), so subtracting the settled amount
  // again knocked the balance down twice. Parties who had never paid looked
  // fine while paying parties drifted negative.
  //
  // Bill-wise is the number the user can actually verify — it matches the
  // Bill Settlement list on the Add Payment screen and the aging buckets:
  //   opening + unpaid bills − payments not allocated to any bill
  // On-account (unallocated) receipts are subtracted so advances still reduce
  // the balance even though they don't belong to a specific invoice.
  //
  // Sign convention is preserved: customers (receivable) come out positive,
  // vendors (payable) negative, because a vendor's opening balance is stored
  // as a credit and their unpaid bills are subtracted rather than added.
  const calculateOutstanding = (account: any, invoices: any[]) => {
    const sign = account.type === "vendor" ? -1 : 1;
    let balance = getOpeningBalance(account);

    invoices
      .filter((inv: any) => inv.partyacc?.id === account.id)
      .forEach((inv: any) => {
        const unpaid = Number(inv.totalamount || 0) - (settledByInvoice[inv.id] || 0);
        if (unpaid > 0.005) balance += sign * unpaid;
      });

    payments
      .filter((p: any) => p.partyid?.id === account.id)
      .forEach((p: any) => {
        const allocated = (p.invoices || []).reduce(
          (sum: number, inv: any) => sum + (inv.settledamount || 0) + (inv.discount || 0),
          0
        );
        const unallocated = Number(p.amount || 0) - allocated;
        if (unallocated > 0.005) balance -= sign * unallocated;
      });

    return balance;
  };

  // -----------------------------
  // Bill-wise info for a party: unpaid bills, next due date, overdue
  // -----------------------------
  const getBillInfo = (account: any, invoices: any[]) => {
    const { fromTimestamp, toTimestamp } = getFilterTimestamps();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let billedInPeriod = 0;
    let pendingBills = 0;
    // Sum of unpaid bills only — excludes the opening balance. This is the
    // figure the party themselves sees on their dashboard / payments screen
    // (server's partyBillOutstanding), so reminders quote the same number.
    let billOutstanding = 0;
    let nextDue: Date | null = null;
    let maxOverdueDays = 0;
    const aging = { b0: 0, b31: 0, b61: 0, b90: 0 }; // 0-30 / 31-60 / 61-90 / 90+

    invoices
      .filter((inv: any) => inv.partyacc?.id === account.id)
      .forEach((inv: any) => {
        const billTime = new Date(inv.billdate).getTime();
        if (
          !isNaN(billTime) &&
          (!fromTimestamp || billTime >= fromTimestamp) &&
          (!toTimestamp || billTime <= toTimestamp)
        ) {
          billedInPeriod += Number(inv.totalamount || 0);
        }

        const unpaid = Number(inv.totalamount || 0) - (settledByInvoice[inv.id] || 0);
        if (unpaid <= 0.005) return; // fully settled bill

        pendingBills += 1;
        billOutstanding += unpaid;

        // Reference date: duedate if set, else billdate
        const refRaw = inv.duedate || inv.billdate;
        const ref = refRaw ? new Date(refRaw) : null;
        if (ref && !isNaN(ref.getTime())) {
          ref.setHours(0, 0, 0, 0);
          if (inv.duedate && (!nextDue || ref < nextDue)) nextDue = ref;
          const days = Math.floor((today.getTime() - ref.getTime()) / 86400000);
          if (inv.duedate && days > maxOverdueDays) maxOverdueDays = days;
          const ageDays = Math.max(0, days);
          if (ageDays <= 30) aging.b0 += unpaid;
          else if (ageDays <= 60) aging.b31 += unpaid;
          else if (ageDays <= 90) aging.b61 += unpaid;
          else aging.b90 += unpaid;
        } else {
          aging.b0 += unpaid;
        }
      });

    return { billedInPeriod, pendingBills, billOutstanding, nextDue, maxOverdueDays, aging };
  };

  // -----------------------------
  // Payments received/made to a party in period
  // -----------------------------
  const getPaidInPeriod = (account: any) => {
    const { fromTimestamp, toTimestamp } = getFilterTimestamps();
    return payments
      .filter((p: any) => {
        if (p.partyid?.id !== account.id) return false;
        const d = Number(p.paymentdate);
        if (fromTimestamp && d < fromTimestamp) return false;
        if (toTimestamp && d > toTimestamp) return false;
        return true;
      })
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  };

  // -----------------------------
  // Tally-style outstanding row for one party
  // -----------------------------
  const buildOutstandingRow = (a: any, invoices: any[]) => {
    const opening = getOpeningBalance(a);
    const outstanding = calculateOutstanding(a, invoices);
    const { billedInPeriod, pendingBills, billOutstanding, nextDue, maxOverdueDays } =
      getBillInfo(a, invoices);
    const paidInPeriod = getPaidInPeriod(a);

    const creditLimit = Number(a.creditlimit || 0);
    // Credit used is always the balance owed in this party's own direction.
    // A customer owes us when `outstanding` is positive; a vendor is owed by
    // us when it's negative. Taking max(0, outstanding) for both meant every
    // vendor showed zero credit used and a permanently full credit limit.
    const used =
      a.type === "vendor" ? Math.max(0, -outstanding) : Math.max(0, outstanding);
    const creditAvailable = creditLimit > 0 ? creditLimit - used : null;

    return {
      // Raw values (underscore-prefixed so they're never rendered as a
      // column) used by the manual payment-reminder action.
      _partyid: a.id,
      _partyname: a.name || "",
      _mobile: (a.mobile || "").replace(/\D/g, ""),
      _outstandingNum: outstanding,
      // Reminders quote the bill-wise figure (unpaid bills only, no opening
      // balance) so the amount matches what the party sees on their own
      // dashboard when they open the notification.
      _billOutstanding: billOutstanding,
      _overdueDays: maxOverdueDays,
      _dueDateLabel: nextDue ? formatDateDMY(nextDue) : "-",

      party: partyLabelOf(a),
      ledger: a.ledgerid?.ledgername || "-",
      openingBalance: fmtAmt(opening),
      billed: billedInPeriod.toFixed(2),
      paid: paidInPeriod.toFixed(2),
      outstanding: fmtAmt(outstanding),
      pendingBills,
      creditLimit: creditLimit > 0 ? creditLimit.toFixed(2) : "-",
      creditAvailable:
        creditAvailable === null
          ? "-"
          : creditAvailable >= 0
            ? creditAvailable.toFixed(2)
            : `(${Math.abs(creditAvailable).toFixed(2)})`,
      dueDate: nextDue ? formatDateDMY(nextDue) : "-",
      overdue: maxOverdueDays > 0 ? `${maxOverdueDays} days` : "-",
      status:
        maxOverdueDays > 0
          ? "Overdue"
          : creditAvailable !== null && creditAvailable < 0
            ? "Limit Crossed"
            : "OK",
    };
  };

  // -----------------------------
  // Customer / Vendor Outstanding
  // -----------------------------
  const customerOutstandingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "customer")
      .map((a: any) => buildOutstandingRow(a, salesInvoices));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, payments, ledgers, salesInvoices, settledByInvoice, appliedFilters]);

  const vendorOutstandingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "vendor")
      .map((a: any) => buildOutstandingRow(a, purchaseInvoices));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, payments, ledgers, purchaseInvoices, settledByInvoice, appliedFilters]);

  // -----------------------------
  // Receivable / Payable Aging (bill-wise buckets)
  // -----------------------------
  const agingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "customer" || a.type === "vendor")
      .map((a: any) => {
        const invoices = a.type === "customer" ? salesInvoices : purchaseInvoices;
        const outstanding = calculateOutstanding(a, invoices);
        const { aging, nextDue, maxOverdueDays } = getBillInfo(a, invoices);
        const creditLimit = Number(a.creditlimit || 0);
        const used = Math.max(0, outstanding);
        return {
          status:
            maxOverdueDays > 0
              ? "Overdue"
              : creditLimit > 0 && used > creditLimit
                ? "Limit Crossed"
                : "OK",
          account: partyLabelOf(a),
          ledger: a.ledgerid?.ledgername || "-",
          type: a.type.charAt(0).toUpperCase() + a.type.slice(1),
          outstanding: fmtAmt(outstanding),
          bucket0: aging.b0.toFixed(2),
          bucket31: aging.b31.toFixed(2),
          bucket61: aging.b61.toFixed(2),
          bucket90: aging.b90.toFixed(2),
          dueDate: nextDue ? formatDateDMY(nextDue) : "-",
          overdue: maxOverdueDays > 0 ? `${maxOverdueDays} days` : "-",
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, payments, ledgers, salesInvoices, purchaseInvoices, settledByInvoice, appliedFilters]);

  // -----------------------------
  // Table Switcher
  // -----------------------------
  let tableData: any[] = [];
  let columns: any[] = [];
  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];

  // `withRemind` is only true for the Customer tab. A payment reminder tells
  // the party to pay us — on the Vendor tab the money flows the other way
  // (we owe them), so the button has no meaning there.
  const outstandingColumns = (partyLabel: string, withRemind: boolean) => [
    { label: partyLabel, key: "party" },
    { label: "Ledger", key: "ledger" },
    { label: "Opening (₹)", key: "openingBalance", numeric: true },
    { label: "Billed (₹)", key: "billed", numeric: true },
    { label: "Received/Paid (₹)", key: "paid", numeric: true },
    { label: "Outstanding (₹)", key: "outstanding", numeric: true },
    { label: "Pending Bills", key: "pendingBills", numeric: true },
    { label: "Credit Limit (₹)", key: "creditLimit", numeric: true },
    { label: "Credit Available (₹)", key: "creditAvailable", numeric: true },
    { label: "Due Date", key: "dueDate" },
    { label: "Overdue", key: "overdue" },
    { label: "Status", key: "status" },
    ...(!withRemind ? [] : [{
      label: "Remind",
      key: "remind",
      noExport: true, // action-only column — keep it out of Excel/CSV/PDF
      render: (row: any) => {
        const amount = Number(row._billOutstanding || 0);
        const disabled = amount <= 0 || (reminderLoading && remindingId === row._partyid);
        return (
          <button
            type="button"
            title={
              amount <= 0
                ? "No pending bills to collect"
                : row._mobile
                  ? `Send payment reminder to ${row._partyname}`
                  : `Send in-app reminder to ${row._partyname} (no mobile saved)`
            }
            disabled={disabled}
            onClick={() => handleSendReminder(row)}
            className={`text-lg ${
              disabled
                ? "text-gray-300 cursor-not-allowed"
                : "text-amber-500 hover:text-amber-600 cursor-pointer"
            }`}
          >
            <FaBell />
          </button>
        );
      },
    }]),
  ];

  switch (activeTab) {
    case "Customer Outstanding":
      tableData = customerOutstandingData;
      columns = outstandingColumns("Customer", true);
      break;
    case "Vendor Outstanding":
      tableData = vendorOutstandingData;
      columns = outstandingColumns("Vendor", false);
      break;
    case "Receivable / Payable Aging":
      tableData = agingData;
      columns = [
        { label: "Account", key: "account" },
        { label: "Ledger", key: "ledger" },
        { label: "Type", key: "type" },
        { label: "Outstanding (₹)", key: "outstanding", numeric: true },
        { label: "0-30 Days (₹)", key: "bucket0", numeric: true },
        { label: "31-60 Days (₹)", key: "bucket31", numeric: true },
        { label: "61-90 Days (₹)", key: "bucket61", numeric: true },
        { label: "90+ Days (₹)", key: "bucket90", numeric: true },
        { label: "Due Date", key: "dueDate" },
        { label: "Overdue", key: "overdue" },
        { label: "Status", key: "status" },
      ];
      break;
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 font-sans">
        <div className="flex flex-wrap gap-2 mb-4">
          {reportTabsObj.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    isActive
                      ? "!bg-slate-900 !text-white shadow-sm border border-slate-900"
                      : "bg-white text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
        <ReportTable moduleId="reports.party"
          title="Party Reports"
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          showExport
          showCsv
          showPdf
          exportFileName="PartyReport"
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default PartyReports;
