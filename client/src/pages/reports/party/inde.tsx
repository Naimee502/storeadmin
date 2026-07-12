import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { formatDateDMY, normalizeToYMD } from "../../../utils/helper";

import { FaUserClock, FaStoreSlash, FaHistory } from "react-icons/fa";

const reportTabsObj = [
  { id: "Customer Outstanding", label: "Customer Outstanding", icon: <FaUserClock className="text-blue-600" /> },
  { id: "Vendor Outstanding", label: "Vendor Outstanding", icon: <FaStoreSlash className="text-amber-600" /> },
  { id: "Receivable / Payable Aging", label: "Receivable / Payable Aging", icon: <FaHistory className="text-emerald-600" /> },
];

/* ── Indian financial year (1 Apr – 31 Mar) ── */
const getFinancialYear = (d = new Date()) => {
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31);
  return { start, end, label: `FY ${startYear}-${String(startYear + 1).slice(2)}` };
};

const fmtAmt = (n: number) =>
  n >= 0 ? n.toFixed(2) : `(${Math.abs(n).toFixed(2)})`;

const PartyReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  const fy = getFinancialYear();

  // -----------------------------
  // Fetch data
  // -----------------------------
  const { data: accountsData } = useAccountsQuery();
  const { data: transactionsData } = useTransactionsQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: salesInvData } = useSalesInvoicesQuery();
  const { data: purchaseInvData } = usePurchaseInvoicesQuery();

  const accounts = accountsData?.getAccounts || [];
  const transactions = transactionsData?.getTransactions || [];
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
  // Ledger-wise outstanding (opening + txns - settlements)
  // -----------------------------
  const calculateOutstanding = (account: any) => {
    const ledgerId = account.ledgerid?.id;
    if (!ledgerId) return 0;
    let balance = getOpeningBalance(account);

    transactions.forEach((txn: any) => {
      txn.entries?.forEach((entry: any) => {
        if (entry.ledgerid?.id === ledgerId) {
          balance += (entry.debit || 0) - (entry.credit || 0);
        }
      });
    });

    payments
      .filter((p: any) => p.partyid?.id === account.id)
      .forEach((p: any) => {
        const settled = (p.invoices || []).reduce(
          (sum: number, inv: any) => sum + (inv.settledamount || 0),
          0
        );
        balance -= settled;
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

    return { billedInPeriod, pendingBills, nextDue, maxOverdueDays, aging };
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
    const outstanding = calculateOutstanding(a);
    const { billedInPeriod, pendingBills, nextDue, maxOverdueDays } = getBillInfo(a, invoices);
    const paidInPeriod = getPaidInPeriod(a);

    const creditLimit = Number(a.creditlimit || 0);
    const used = Math.max(0, outstanding); // credit currently used
    const creditAvailable = creditLimit > 0 ? creditLimit - used : null;

    return {
      party: a.name,
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
  }, [accounts, transactions, payments, ledgers, salesInvoices, settledByInvoice, appliedFilters]);

  const vendorOutstandingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "vendor")
      .map((a: any) => buildOutstandingRow(a, purchaseInvoices));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions, payments, ledgers, purchaseInvoices, settledByInvoice, appliedFilters]);

  // -----------------------------
  // Receivable / Payable Aging (bill-wise buckets)
  // -----------------------------
  const agingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "customer" || a.type === "vendor")
      .map((a: any) => {
        const invoices = a.type === "customer" ? salesInvoices : purchaseInvoices;
        const outstanding = calculateOutstanding(a);
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
          account: a.name,
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
  }, [accounts, transactions, payments, ledgers, salesInvoices, purchaseInvoices, settledByInvoice, appliedFilters]);

  // -----------------------------
  // Table Switcher
  // -----------------------------
  let tableData: any[] = [];
  let columns: any[] = [];
  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];

  const outstandingColumns = (partyLabel: string) => [
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
  ];

  switch (activeTab) {
    case "Customer Outstanding":
      tableData = customerOutstandingData;
      columns = outstandingColumns("Customer");
      break;
    case "Vendor Outstanding":
      tableData = vendorOutstandingData;
      columns = outstandingColumns("Vendor");
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap gap-2">
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
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-bold border border-indigo-200">
            {fy.label} ({formatDateDMY(fy.start)} → {formatDateDMY(fy.end)})
          </span>
        </div>
        <ReportTable
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
