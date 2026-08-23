import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useOutstanding } from "../../../graphql/hooks/shared/useoutstanding";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useSalesReturnsQuery } from "../../../graphql/hooks/salesreturn";
import { usePurchaseReturnsQuery } from "../../../graphql/hooks/purchasereturn";
import { formatDateDMY } from "../../../utils/helper";
import { useMutation } from "@apollo/client";
import { SEND_OUTSTANDING_REMINDER } from "../../../graphql/queries/notifications";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

import { FaUserClock, FaStoreSlash, FaHistory, FaBell, FaFileAlt } from "react-icons/fa";

const reportTabsObj = [
  { id: "Customer Outstanding", label: "Customer Outstanding", icon: <FaUserClock className="text-blue-600" /> },
  { id: "Vendor Outstanding", label: "Vendor Outstanding", icon: <FaStoreSlash className="text-amber-600" /> },
  { id: "Receivable / Payable Aging", label: "Receivable / Payable Aging", icon: <FaHistory className="text-emerald-600" /> },
  { id: "Party Statement", label: "Party Statement", icon: <FaFileAlt className="text-indigo-600" /> },
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

  // -----------------------------
  // Fetch data
  // -----------------------------
  const { data: accountsData } = useAccountsQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: salesInvData } = useSalesInvoicesQuery();
  const { data: purchaseInvData } = usePurchaseInvoicesQuery();
  // Returns show on a statement as Credit / Debit Notes.
  const { data: salesRetData } = useSalesReturnsQuery();
  const { data: purchaseRetData } = usePurchaseReturnsQuery();

  const accounts = [...(accountsData?.getAccounts || [])].reverse();
  const payments = paymentsData?.getPayments || [];

  const { outstandingOf, excessCreditOf } = useOutstanding();
  const ledgers = ledgerData?.getAccountLedgers || [];
  const salesReturns = salesRetData?.getSalesReturns || [];
  const purchaseReturns = purchaseRetData?.getPurchaseReturns || [];
  const salesInvoices = salesInvData?.getSalesInvoices || [];
  const purchaseInvoices = purchaseInvData?.getPurchaseInvoices || [];

  // -----------------------------
  // Default filters = last 30 days
  // -----------------------------
  // Every other report opens on the last 30 days, and so does this page's own
  // Reset button — only the initial load used the financial-year start, so the
  // range silently changed the first time anyone hit Reset.
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
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
  // Single source of truth for what a bill still owes, shared with the payment
  // screen and BillAllocation:
  //
  //   outstanding = total − payments − journal settlements − un-refunded returns
  //
  // The local map this replaced had two defects: it ignored sales returns
  // entirely (a returned bill kept showing as owed), and it added `discount` on
  // top of `settledamount`. `settledamount` is ALREADY the full amount knocked
  // off the bill — a discount only lowers the CASH received — so adding it
  // again over-settled every discounted bill.

  // -----------------------------
  // Opening balance of a party's ledger
  // -----------------------------
  // How much of each party's opening balance has already been cleared by a
  // payment. Without this the report would keep charging them for an opening
  // that an advance has since settled — and "Unallocated" on the payments list
  // would never agree with "Outstanding" here.
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

  /** Opening balance still unpaid — what the party actually owes from before. */
  const getOpeningDue = (account: any) => {
    const opening = getOpeningBalance(account);
    if (opening <= 0) return opening; // a credit opening can't be "settled"
    return parseFloat(Math.max(0, opening - (openingSettledByParty[account.id] || 0)).toFixed(2));
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
    let balance = getOpeningDue(account);

    invoices
      .filter((inv: any) => inv.partyacc?.id === account.id)
      .forEach((inv: any) => {
        const unpaid = outstandingOf(inv);
        if (unpaid > 0.005) balance += sign * unpaid;

        // Bill paid first, returned later → the return is money we now owe
        // back. It behaves like an unallocated advance, so it comes off the
        // balance the same way. Without this the report stayed at the
        // pre-return figure while the ledger had already moved.
        const excess = excessCreditOf(inv);
        if (excess > 0.005) balance -= sign * excess;
      });

    payments
      .filter((p: any) => p.partyid?.id === account.id)
      .forEach((p: any) => {
        // Use the server's figure. It already accounts for the opening-balance
        // leg and for concessions (cash = settled − discount + commission).
        // Re-deriving it here from invoices[] alone missed both: a receipt that
        // had cleared a ₹100 opening still showed the whole ₹100 as an advance,
        // so this report and the payments list disagreed by that amount.
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
    // Show the opening at FACE VALUE, not the un-cleared remainder.
    //
    // It looks like it should be the remainder, but the face value is what
    // makes the row read as plain arithmetic:
    //
    //     Opening + Billed − Received = Outstanding
    //     100     + 100    − 250      = (50)
    //
    // That identity holds because whatever a payment took off the opening is
    // already inside "Received". Printing the remainder here would show
    // 0 + 100 − 250 = (50) instead, and nobody could follow the row.
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
  }, [accounts, payments, ledgers, salesInvoices, outstandingOf, excessCreditOf, appliedFilters]);

  const vendorOutstandingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "vendor")
      .map((a: any) => buildOutstandingRow(a, purchaseInvoices));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, payments, ledgers, purchaseInvoices, outstandingOf, excessCreditOf, appliedFilters]);

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
  }, [accounts, payments, ledgers, salesInvoices, purchaseInvoices, outstandingOf, excessCreditOf, appliedFilters]);

  // -----------------------------
  // Party Statement — one party's ledger, transaction by transaction
  // -----------------------------
  /** Every party that can have a statement, for the picker. */
  const statementPartyOptions = useMemo(
    () =>
      accounts
        .filter((a: any) => a.type === "customer" || a.type === "vendor")
        .map((a: any) => ({ label: partyLabelOf(a), value: a.id })),
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

  /**
   * The party's ledger as a running statement.
   *
   * Debit and credit follow the party's own account, exactly as a Tally party
   * statement reads. For a CUSTOMER a sale is a debit (they owe more) and a
   * receipt or credit note is a credit. For a VENDOR it is the mirror: a
   * purchase is a credit (we owe more), a payment or debit note is a debit.
   *
   * The running balance is signed — positive is Dr, negative is Cr — and every
   * row is labelled so the direction is never ambiguous on a printed sheet.
   */
  const statementData = useMemo(() => {
    const a = statementParty;
    if (!a) return [];

    const isVendor = a.type === "vendor";
    const { fromTimestamp, toTimestamp } = getFilterTimestamps();

    const timeOf = (d: any) => {
      if (!d) return NaN;
      const str = String(d).trim();
      return /^\d+$/.test(str) ? Number(str) : new Date(str).getTime();
    };

    type Row = { t: number; type: string; ref: string; debit: number; credit: number };
    const rows: Row[] = [];

    const mine = (list: any[]) => list.filter((x: any) => x.partyacc?.id === a.id);

    // Document numbers are stored bare ("000007") and prefixed at display time
    // everywhere else in the app — INV- for invoices, CN-/DN- for returns. The
    // guard keeps an already-prefixed number from becoming "CN-CN-12".
    const refNo = (prefix: string, num: any) => {
      const raw = String(num ?? "").trim();
      if (!raw) return "-";
      return raw.toUpperCase().startsWith(prefix) ? raw : `${prefix}${raw}`;
    };

    if (isVendor) {
      mine(purchaseInvoices).forEach((inv: any) =>
        rows.push({
          t: timeOf(inv.billdate), type: "Purchase", ref: refNo("INV-", inv.billnumber),
          debit: 0, credit: Number(inv.totalamount || 0),
        })
      );
      mine(purchaseReturns).forEach((r: any) =>
        rows.push({
          t: timeOf(r.returndate), type: "Debit Note", ref: refNo("DN-", r.billnumber),
          debit: Number(r.totalamount || 0), credit: 0,
        })
      );
    } else {
      mine(salesInvoices).forEach((inv: any) =>
        rows.push({
          t: timeOf(inv.billdate), type: "Sale", ref: refNo("INV-", inv.billnumber),
          debit: Number(inv.totalamount || 0), credit: 0,
        })
      );
      mine(salesReturns).forEach((r: any) =>
        rows.push({
          t: timeOf(r.returndate), type: "Credit Note", ref: refNo("CN-", r.billnumber),
          debit: 0, credit: Number(r.totalamount || 0),
        })
      );
    }

    payments
      .filter((p: any) => p.partyid?.id === a.id && p.status !== false)
      .forEach((p: any) => {
        const amt = Number(p.amount || 0);
        const inward = p.type === "receipt";
        rows.push({
          t: timeOf(p.paymentdate),
          type: inward ? "Payment-In" : "Payment-Out",
          ref: String(p.paymentcode ?? "-"),
          debit: inward ? 0 : amt,
          credit: inward ? amt : 0,
        });
      });

    const valid = rows.filter((r) => !isNaN(r.t)).sort((x, y) => x.t - y.t);

    // Everything before the period is folded into one beginning balance, so the
    // statement opens with what they carried in rather than from zero.
    let balance = getOpeningBalance(a);
    const before = valid.filter((r) => fromTimestamp && r.t < fromTimestamp);
    before.forEach((r) => { balance += r.debit - r.credit; });

    const label = (n: number) =>
      `₹${Math.abs(n).toFixed(2)}(${n < 0 ? "Cr" : "Dr"})`;

    const out: any[] = [
      {
        date: appliedFilters.fromDate ? formatDateDMY(appliedFilters.fromDate) : "-",
        txnType: isVendor ? "Payable Beginning Balance" : "Receivable Beginning Balance",
        ref: "",
        debit: balance > 0 ? balance.toFixed(2) : "0.00",
        credit: balance < 0 ? Math.abs(balance).toFixed(2) : "0.00",
        runningBalance: label(balance),
      },
    ];

    valid
      .filter(
        (r) =>
          (!fromTimestamp || r.t >= fromTimestamp) &&
          (!toTimestamp || r.t <= toTimestamp)
      )
      .forEach((r) => {
        balance += r.debit - r.credit;
        out.push({
          date: formatDateDMY(r.t),
          txnType: r.type,
          ref: r.ref,
          debit: r.debit ? r.debit.toFixed(2) : "",
          credit: r.credit ? r.credit.toFixed(2) : "",
          runningBalance: label(balance),
        });
      });

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementParty, salesInvoices, purchaseInvoices, salesReturns, purchaseReturns, payments, ledgers, appliedFilters]);

  // -----------------------------
  // Table Switcher
  // -----------------------------
  let tableData: any[] = [];
  let columns: any[] = [];
  const filterFields: ReportFilterField[] = [
    // A statement is always ONE party's ledger, so that choice is a filter here
    // rather than a column.
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
    case "Party Statement":
      tableData = statementData;
      columns = [
        { label: "Date", key: "date" },
        { label: "Txn Type", key: "txnType" },
        { label: "Ref No.", key: "ref" },
        { label: "Debit (₹)", key: "debit", numeric: true },
        { label: "Credit (₹)", key: "credit", numeric: true },
        {
          // Deliberately not `numeric`: a running balance is a position at a
          // point in time, and adding every row of it together is meaningless.
          // Right-align it by hand so the column still reads as money.
          label: "Running Balance",
          key: "runningBalance",
          render: (row: any) => (
            <span className="block text-right whitespace-nowrap">{row.runningBalance}</span>
          ),
        },
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
        />
      </div>
    </HomeLayout>
  );
};

export default PartyReports;
