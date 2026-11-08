import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useOutstanding } from "../../../graphql/hooks/shared/useoutstanding";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useSalesReturnsQuery } from "../../../graphql/hooks/salesreturn";
import { usePurchaseReturnsQuery } from "../../../graphql/hooks/purchasereturn";
import { useAdminSettingsQuery } from "../../../graphql/hooks/adminsettings";
import { formatDateDMY, todayYMD, shiftDaysYMD, timestampOf, compareStatementRows } from "../../../utils/helper";
import { useMutation, useQuery } from "@apollo/client";
import { PARTY_REPORT_SALES_INVOICES, PARTY_REPORT_PURCHASE_INVOICES } from "../../../graphql/queries/reports/party";
import { SEND_OUTSTANDING_REMINDER } from "../../../graphql/queries/notifications";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

import { FaUserClock, FaStoreSlash, FaHistory, FaBell, FaFileAlt } from "react-icons/fa";
import { partyLabel as sharedPartyLabel } from "../../../utils/partylabel";
import { isCustomerParty, isVendorParty, isBothParty } from "../../../utils/partytype";

const reportTabsObj = [
  { id: "Customer Outstanding", label: "Customer Outstanding", icon: <FaUserClock className="text-[12px] text-blue-600" /> },
  { id: "Vendor Outstanding", label: "Vendor Outstanding", icon: <FaStoreSlash className="text-[12px] text-amber-600" /> },
  { id: "Receivable / Payable Aging", label: "Receivable / Payable Aging", icon: <FaHistory className="text-[12px] text-emerald-600" /> },
  { id: "Party Statement", label: "Party Statement", icon: <FaFileAlt className="text-[12px] text-indigo-600" /> },
];

const fmtAmt = (n: number) =>
  n >= 0 ? n.toFixed(2) : `(${Math.abs(n).toFixed(2)})`;

// "Party Name - Mobile - City", same label as the pickers.
const partyLabelOf = (a: any) => sharedPartyLabel(a) || "-";

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

  // Payment reminder: creates the party notification and opens WhatsApp to their mobile.
  const handleSendReminder = async (row: any) => {
    if (!row?._partyid || !adminid) return;

    // Unpaid bills only, matching the party's own dashboard.
    const amount = Number(row._billOutstanding || 0);
    if (amount <= 0) {
      dispatch(
        showMessage({ message: "No outstanding amount for this party.", type: "info" })
      );
      return;
    }

    // Open the tab before awaiting (popup blockers); no noopener so we keep the handle.
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

  // Fetch data

  const { data: accountsData } = useAccountsQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: ledgerData } = useAccountLedgersQuery();
  // Lite invoice lists only for the sides the active tab reads.
  const selectedBranchId = useAppSelector((state: any) => state.selectedBranch.branchId);
  const invAdminid = adminid;
  const invBranchid =
    auth.type === "admin" ? selectedBranchId : auth.type === "branch" ? auth.branch?.id : auth.type === "staff" ? auth.staff?.branchid?.id : undefined;
  const stmtType = activeTab === "Party Statement"
    ? (accountsData?.getAccounts || []).find((x: any) => x.id === appliedFilters.partyid)?.type
    : undefined;
  // Statement: vendors use purchases; everyone else uses sales.
  const needPurchaseInv =
    activeTab === "Vendor Outstanding" ||
    activeTab === "Receivable / Payable Aging" ||
    (activeTab === "Party Statement" && !!stmtType && isVendorParty(stmtType));
  const needSalesInv =
    activeTab === "Customer Outstanding" ||
    activeTab === "Receivable / Payable Aging" ||
    (activeTab === "Party Statement" && !!stmtType && (isCustomerParty(stmtType) || !isVendorParty(stmtType)));
  const { data: salesInvData } = useQuery(PARTY_REPORT_SALES_INVOICES, {
    variables: { filter: { adminid: invAdminid, branchid: invBranchid } },
    skip: !needSalesInv,
  });
  const { data: purchaseInvData } = useQuery(PARTY_REPORT_PURCHASE_INVOICES, {
    variables: { filter: { adminid: invAdminid, branchid: invBranchid } },
    skip: !needPurchaseInv,
  });
  // Returns show on a statement as Credit / Debit Notes.
  const { data: salesRetData } = useSalesReturnsQuery();
  const { data: purchaseRetData } = usePurchaseReturnsQuery();
  const { data: adminSettingsData } = useAdminSettingsQuery();

  // Flag "Discount & Commission on Payment settlement"; off keeps plain Debit / Credit.
  const dcEnabled = !!adminSettingsData?.getAdminSettings?.enablePaymentDiscountCommission;
  // Flag for Last Payment columns (key still says "OnStatement" for saved settings).
  const showLastPayment = !!adminSettingsData?.getAdminSettings?.showLastPaymentOnStatement;

  const accounts = useMemo(() => [...(accountsData?.getAccounts || [])].reverse(), [accountsData]);
  const payments = paymentsData?.getPayments || [];

  const { outstandingOf, excessCreditOf } = useOutstanding();
  const ledgers = ledgerData?.getAccountLedgers || [];
  const salesReturns = salesRetData?.getSalesReturns || [];
  const purchaseReturns = purchaseRetData?.getPurchaseReturns || [];
  // Cancelled bills are reversed out of the books — same default as the hooks.
  const salesInvoices = useMemo(
    () => (salesInvData?.getSalesInvoices || []).filter((i: any) => i?.cancelStatus !== "cancelled"),
    [salesInvData]
  );
  const purchaseInvoices = useMemo(
    () => (purchaseInvData?.getPurchaseInvoices || []).filter((i: any) => i?.cancelStatus !== "cancelled"),
    [purchaseInvData]
  );

  // Default filters = last 30 days

  // Default to the last 30 days, same as Reset.
  useEffect(() => {
    const to = todayYMD();
    const from = shiftDaysYMD(-30);
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

  // Per-invoice settled amounts (from payments)

  // Shared outstanding: total - payments - journal settlements - un-refunded returns.

  // Opening balance of a party's ledger

  // Opening balance already cleared by payments.
  const openingSettledByParty = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p: any) => {
      const pid = p.partyid?.id;
      if (!pid) return;
      map[pid] = (map[pid] || 0) + (Number(p.openingsettled) || 0);
    });
    return map;
  }, [payments]);

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

  /** Unpaid opening in display sign; vendor openings are flipped before subtracting settlements. */
  const getOpeningDue = (account: any) => {
    const opening = getOpeningBalance(account);
    const isVendor = String(account.type || "").toLowerCase() === "vendor";

    // The debt in this party's own direction — positive means it can be paid off.
    const owed = isVendor ? -opening : opening;
    if (owed <= 0) return opening; // nothing outstanding to settle against

    const remaining = Math.max(0, owed - (openingSettledByParty[account.id] || 0));
    return parseFloat((isVendor ? -remaining : remaining).toFixed(2));
  };

  // Bill-wise outstanding: opening + unpaid bills - unallocated payments (customers +, vendors -).
  const calculateOutstanding = (account: any, invoices: any[]) => {
    const sign = account.type === "vendor" ? -1 : 1;
    let balance = getOpeningDue(account);

    invoices
      .filter((inv: any) => inv.partyacc?.id === account.id)
      .forEach((inv: any) => {
        const unpaid = outstandingOf(inv);
        if (unpaid > 0.005) balance += sign * unpaid;

        // A return after payment is owed back, so treat it like an unallocated advance.
        const excess = excessCreditOf(inv);
        if (excess > 0.005) balance -= sign * excess;
      });

    payments
      .filter((p: any) => p.partyid?.id === account.id)
      .forEach((p: any) => {
        // Use the server's unallocated figure (includes opening leg and concessions).
        const unallocated =
          p.unallocatedamount != null
            ? Number(p.unallocatedamount) || 0
            : Number(p.amount || 0) -
              ((p.invoices || []).reduce(
                (sum: number, inv: any) =>
                  sum + (inv.settledamount || 0) - (inv.discount || 0) + (inv.commission || 0),
                0
              ) +
                (Number(p.openingsettled) || 0));
        if (unallocated > 0.005) balance -= sign * unallocated;
      });

    return balance;
  };

  // Bill-wise info for a party: unpaid bills, next due date, overdue

  const getBillInfo = (account: any, invoices: any[]) => {
    const { fromTimestamp, toTimestamp } = getFilterTimestamps();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let billedInPeriod = 0;
    let pendingBills = 0;
    // Unpaid bills only, excluding opening; matches the party's dashboard.
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

        const unpaid = outstandingOf(inv);
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

  // Payments received/made to a party in period

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

  // Last payment of a party (flag-gated columns on the outstanding tabs)

  // Customer tab: last receipt; Vendor tab: last payment made.
  const getLastPayment = (a: any, received: boolean) => {
    const latest = payments
      .filter(
        (p: any) =>
          p.partyid?.id === a.id &&
          p.status !== false &&
          (p.type === "receipt") === received
      )
      .map((p: any) => ({ p, t: timestampOf(p.paymentdate), seq: timestampOf(p.createdAt) }))
      .filter((x: any) => !isNaN(x.t))
      .sort((x: any, y: any) => y.t - x.t || (y.seq || 0) - (x.seq || 0))[0];

    if (!latest) return { lastPaymentDate: "-", lastPaymentAmount: "-", lastPaymentDays: "-" };

    const dayStart = (t: number) => {
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const days = Math.round((dayStart(Date.now()) - dayStart(latest.t)) / 86400000);
    return {
      lastPaymentDate: formatDateDMY(latest.t),
      lastPaymentAmount: (Number(latest.p.amount) || 0).toFixed(2),
      lastPaymentDays:
        days === 0 ? "Today" : days === 1 ? "1 day ago" : days > 1 ? `${days} days ago` : `in ${-days} days`,
    };
  };

  // Tally-style outstanding row for one party

  const buildOutstandingRow = (a: any, invoices: any[], received: boolean) => {
    // Opening at face value so Opening + Billed - Received = Outstanding.
    const opening = getOpeningBalance(a);
    const outstanding = calculateOutstanding(a, invoices);
    const { billedInPeriod, pendingBills, billOutstanding, nextDue, maxOverdueDays } =
      getBillInfo(a, invoices);
    const paidInPeriod = getPaidInPeriod(a);

    const creditLimit = Number(a.creditlimit || 0);
    // Credit used is the balance owed in the party's own direction.
    const used =
      a.type === "vendor" ? Math.max(0, -outstanding) : Math.max(0, outstanding);
    const creditAvailable = creditLimit > 0 ? creditLimit - used : null;

    return {
      // Raw values for the reminder action (underscore = not a column).
      _partyid: a.id,
      _partyname: a.name || "",
      _mobile: (a.mobile || "").replace(/\D/g, ""),
      _outstandingNum: outstanding,
      // Reminder quotes unpaid bills only, as the party sees it.
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
      ...getLastPayment(a, received),
    };
  };

  // Customer / Vendor Outstanding

  const customerOutstandingData = useMemo(() => {
    return accounts
      // Both-type parties appear here for sales and on the vendor list for purchases.
      .filter((a: any) => isCustomerParty(a.type))
      .map((a: any) => buildOutstandingRow(a, salesInvoices, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, payments, ledgers, salesInvoices, outstandingOf, excessCreditOf, appliedFilters]);

  const vendorOutstandingData = useMemo(() => {
    return accounts
      .filter((a: any) => isVendorParty(a.type))
      .map((a: any) => buildOutstandingRow(a, purchaseInvoices, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, payments, ledgers, purchaseInvoices, outstandingOf, excessCreditOf, appliedFilters]);

  // Receivable / Payable Aging (bill-wise buckets)

  const agingData = useMemo(() => {
    return accounts
      .filter((a: any) => isCustomerParty(a.type) || isVendorParty(a.type))
      .map((a: any) => {
        // Aging uses the receivable side; payables are on Vendor Outstanding.
        const invoices = isCustomerParty(a.type) ? salesInvoices : purchaseInvoices;
        const outstanding = calculateOutstanding(a, invoices);
        const { aging, nextDue, maxOverdueDays } = getBillInfo(a, invoices);
        const creditLimit = Number(a.creditlimit || 0);
        // Credit used is the balance in the party's own direction (vendor balances are negative).
        const used =
          a.type === "vendor" ? Math.max(0, -outstanding) : Math.max(0, outstanding);
        return {
          status:
            maxOverdueDays > 0
              ? "Overdue"
              : creditLimit > 0 && used > creditLimit
                ? "Limit Crossed"
                : "OK",
          party: partyLabelOf(a),
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
  }, [accounts, payments, ledgers, salesInvoices, purchaseInvoices, outstandingOf, excessCreditOf, appliedFilters]);

  // Party Statement — one party's ledger, transaction by transaction

  /** Every party that can have a statement, for the picker. */
  const statementPartyOptions = useMemo(
    () =>
      accounts
        .filter((a: any) => isCustomerParty(a.type) || isVendorParty(a.type))
        .map((a: any) => ({ label: sharedPartyLabel(a) || partyLabelOf(a), value: a.id })),
    [accounts]
  );

  // Pick the first party by default so the tab is never a blank screen.
  useEffect(() => {
    if (activeTab !== "Party Statement" || !statementPartyOptions.length) return;
    if (appliedFilters.partyid) return;
    const first = statementPartyOptions[0].value;
    setFilters((f) => ({ ...f, partyid: first }));
    setAppliedFilters((f) => ({ ...f, partyid: first }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statementPartyOptions]);

  const statementParty = useMemo(
    () => accounts.find((a: any) => a.id === appliedFilters.partyid) || null,
    [accounts, appliedFilters.partyid]
  );

  /** Party ledger as a running statement, Tally-style; positive balance is Dr, negative Cr. */
  const statementData = useMemo(() => {
    const a = statementParty;
    if (!a) return [];

    const isVendor = a.type === "vendor";
    const { fromTimestamp, toTimestamp } = getFilterTimestamps();

    const timeOf = timestampOf;

    type Row = {
      t: number; type: string; ref: string; debit: number; credit: number; remarks: string;
      // Only payments carry concessions; invoice / return rows leave these unset.
      discount?: number; commission?: number;
      // Commission + discount move the balance further (see stepOf).
      conc?: number;
      // Same-day tie-break, see compareStatementRows.
      seq?: number;
    };
    const rows: Row[] = [];

    const mine = (list: any[]) => list.filter((x: any) => x.partyacc?.id === a.id);

    // Add the display prefix unless already there (avoids "CN-CN-12").
    const refNo = (prefix: string, num: any) => {
      const raw = String(num ?? "").trim();
      if (!raw) return "-";
      return raw.toUpperCase().startsWith(prefix) ? raw : `${prefix}${raw}`;
    };

    // Documents for this ledger; both-type parties get both on one running balance.
    const showPurchase = isVendorParty(a.type);
    // Anything not a vendor reads as a customer.
    const showSales = isCustomerParty(a.type) || !showPurchase;

    if (showPurchase) {
      mine(purchaseInvoices).forEach((inv: any) =>
        rows.push({
          t: timeOf(inv.billdate), type: "Purchase", ref: refNo("INV-", inv.billnumber),
          debit: 0, credit: Number(inv.totalamount || 0),
          remarks: (inv.notes || inv.narration || "").trim() || "-",
        })
      );
      mine(purchaseReturns).forEach((r: any) =>
        rows.push({
          t: timeOf(r.returndate), type: "Debit Note", ref: refNo("DN-", r.billnumber),
          debit: Number(r.totalamount || 0), credit: 0,
          remarks: (r.notes || r.narration || "").trim() || "-",
        })
      );
    }

    if (showSales) {
      mine(salesInvoices).forEach((inv: any) =>
        rows.push({
          t: timeOf(inv.billdate), type: "Sale", ref: refNo("INV-", inv.billnumber),
          debit: Number(inv.totalamount || 0), credit: 0,
          remarks: (inv.notes || inv.narration || "").trim() || "-",
        })
      );
      mine(salesReturns).forEach((r: any) =>
        rows.push({
          t: timeOf(r.returndate), type: "Credit Note", ref: refNo("CN-", r.billnumber),
          debit: 0, credit: Number(r.totalamount || 0),
          remarks: (r.notes || r.narration || "").trim() || "-",
        })
      );
    }

    payments
      .filter((p: any) => p.partyid?.id === a.id && p.status !== false)
      .forEach((p: any) => {
        const r2 = (n: any) => parseFloat((Number(n) || 0).toFixed(2));
        const invs = Array.isArray(p.invoices) ? p.invoices : [];

        // Concessions may be on bill lines or the payment; take the larger.
        const discount = Math.max(
          r2(invs.reduce((s: number, i: any) => s + (Number(i.discount) || 0), 0)),
          r2(p.discount)
        );
        const commission = Math.max(
          r2(invs.reduce((s: number, i: any) => s + (Number(i.commission) || 0), 0)),
          r2(p.commission)
        );

        // Debit / Credit show the settled amount (cash + discount - commission).
        const cash = r2(p.amount);
        const settled = r2(cash + discount - commission);
        const inward = p.type === "receipt";

        rows.push({
          t: timeOf(p.paymentdate),
          seq: timeOf(p.createdAt),
          type: inward ? "Payment-In" : "Payment-Out",
          ref: String(p.paymentcode ?? "-"),
          debit: inward ? 0 : settled,
          credit: inward ? settled : 0,
          // commission + discount, applied in the payment's direction (stepOf).
          conc: r2(commission + discount),
          remarks: (p.remarks || "").trim() || "-",
          discount,
          commission,
        });
      });

    const valid = rows.filter((r) => !isNaN(r.t)).sort(compareStatementRows);

    // Fold everything before the period into the opening balance.
    let balance = getOpeningBalance(a);
    const before = valid.filter((r) => fromTimestamp && r.t < fromTimestamp);
    // Commission and discount move the balance further in the payment's direction (In: Cr, Out: Dr).
    const stepOf = (bal: number, r: Row) => {
      const b = bal + r.debit - r.credit;
      const c = r.conc || 0;
      return b + (r.type === "Payment-In" ? -c : c);
    };
    before.forEach((r) => { balance = stepOf(balance, r); });

    const label = (n: number) =>
      `₹${Math.abs(n).toFixed(2)}(${n < 0 ? "Cr" : "Dr"})`;

    const out: any[] = [
      {
        date: appliedFilters.fromDate ? formatDateDMY(appliedFilters.fromDate) : "-",
        txnType: isBothParty(a.type)
          ? "Beginning Balance"
          : isVendor
          ? "Payable Beginning Balance"
          : "Receivable Beginning Balance",
        ref: "",
        debit: balance > 0 ? balance.toFixed(2) : "0.00",
        credit: balance < 0 ? Math.abs(balance).toFixed(2) : "0.00",
        runningBalance: label(balance),
        remarks: "-",
        discount: "-",
        commission: "-",
      },
    ];

    valid
      .filter(
        (r) =>
          (!fromTimestamp || r.t >= fromTimestamp) &&
          (!toTimestamp || r.t <= toTimestamp)
      )
      .forEach((r) => {
        const prev = balance;
        balance = stepOf(balance, r);
        out.push({
          date: formatDateDMY(r.t),
          txnType: r.type,
          ref: r.ref,
          debit: r.debit ? r.debit.toFixed(2) : "",
          credit: r.credit ? r.credit.toFixed(2) : "",
          runningBalance: label(balance),
          remarks: r.remarks,
          discount: r.discount ? r.discount.toFixed(2) : "-",
          commission: r.commission ? r.commission.toFixed(2) : "-",
          // Hidden: balance movement beyond Debit - Credit, added in Totals.
          balanceAdjust: (balance - prev - (r.debit - r.credit)).toFixed(2),
        });
      });

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementParty, salesInvoices, purchaseInvoices, salesReturns, purchaseReturns, payments, ledgers, appliedFilters]);

  // Table Switcher

  let tableData: any[] = [];
  let columns: any[] = [];
  const filterFields: ReportFilterField[] = [
    // A statement is one party's ledger, so the party is a filter.
    ...(activeTab === "Party Statement"
      ? ([
          {
            name: "partyid",
            label: "Party",
            type: "select",
            options: statementPartyOptions,
            searchable: true,
          },
        ] as ReportFilterField[])
      : []),
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];

  // Reminders only on the Customer tab.
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
    ...(showLastPayment
      ? [
          { label: withRemind ? "Last Received On" : "Last Paid On", key: "lastPaymentDate" },
          { label: withRemind ? "Last Received (₹)" : "Last Paid (₹)", key: "lastPaymentAmount" },
          { label: "Since", key: "lastPaymentDays" },
        ]
      : []),
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
            className={`text-sm ${
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

  let pdfSubtitle: string[] | undefined;
  let netTotal:
    | { debitKey: string; creditKey: string; minusKeys?: string[]; plusKeys?: string[]; showInKey?: string }
    | undefined;

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
        { label: "Account", key: "party" },
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
    case "Party Statement":
      if (statementParty) {
        pdfSubtitle = [
          `Party name: ${statementParty.name || ""}`,
          `Duration: From ${appliedFilters.fromDate ? formatDateDMY(appliedFilters.fromDate) : "-"} to ${appliedFilters.toDate ? formatDateDMY(appliedFilters.toDate) : "-"}`,
        ];
      }
      tableData = statementData;
      columns = [
        { label: "Date", key: "date" },
        { label: "Txn Type", key: "txnType" },
        { label: "Ref No.", key: "ref" },
        { label: "Debit (₹)", key: "debit", numeric: true },
        { label: "Credit (₹)", key: "credit", numeric: true },
        ...(dcEnabled ? [
          { label: "Discount (₹)", key: "discount", numeric: true },
          { label: "Commission (₹)", key: "commission", numeric: true },
        ] : []),
        {
          // Not `numeric`: summing a running balance is meaningless.
          label: "Running Balance",
          key: "runningBalance",
          render: (row: any) => (
            <span className="block text-right whitespace-nowrap">{row.runningBalance}</span>
          ),
        },
        { label: "Remarks", key: "remarks" },
      ];
      // Totals net (Debit - Credit, - discount + commission) equals the closing running balance.
      netTotal = {
        debitKey: "debit",
        creditKey: "credit",
        plusKeys: ["balanceAdjust"],
        showInKey: "remarks",
      };
      break;
  }

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <div className="flex flex-wrap gap-2 mb-3">
          {reportTabsObj.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium cursor-pointer ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
        <ReportTable moduleId="reports.party"
          title={activeTab === "Party Statement" ? "Party Statement" : "Party Reports"}
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
          exportFileName={activeTab === "Party Statement" ? "PartyStatement" : "PartyReport"}
          showTotals
          netTotal={netTotal}
          pdfSubtitle={pdfSubtitle}
        />
      </div>
    </HomeLayout>
  );
};

export default PartyReports;
