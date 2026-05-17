import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";

import { FaUserClock, FaStoreSlash, FaHistory } from "react-icons/fa";

const reportTabsObj = [
  { id: "Customer Outstanding", label: "Customer Outstanding", icon: <FaUserClock className="text-blue-600" /> },
  { id: "Vendor Outstanding", label: "Vendor Outstanding", icon: <FaStoreSlash className="text-amber-600" /> },
  { id: "Receivable / Payable Aging", label: "Receivable / Payable Aging", icon: <FaHistory className="text-emerald-600" /> },
];

const PartyReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // -----------------------------
  // Fetch data
  // -----------------------------
  const { data: accountsData } = useAccountsQuery();
  const { data: transactionsData } = useTransactionsQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: ledgerData } = useAccountLedgersQuery();

  const accounts = accountsData?.getAccounts || [];
  const transactions = transactionsData?.getTransactions || [];
  const payments = paymentsData?.getPayments || [];
  const ledgers = ledgerData?.getAccountLedgers || [];

  // ✅ Debug Logs
  console.log("✅ Accounts:", JSON.stringify(accounts, null, 2));
  console.log("✅ Transactions:", JSON.stringify(transactions, null, 2));
  console.log("✅ Payments:", JSON.stringify(payments, null, 2));
  console.log("✅ Ledgers:", JSON.stringify(ledgers, null, 2));

  // -----------------------------
  // Default filters (last 30 days)
  // -----------------------------
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
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
  // Common Outstanding Logic (Customer & Vendor)
  // -----------------------------
  const calculateOutstanding = (account: any) => {
    const ledgerId = account.ledgerid?.id;
    if (!ledgerId) return 0;

    // Opening balance
    const ledger = ledgers.find((l: any) => l.id === ledgerId);
    let balance = 0;
    if (ledger) {
      balance =
        ledger.openingbalancetype === "debit"
          ? ledger.openingbalance
          : -ledger.openingbalance;
    }

    console.log(`\n=== Calculating for ${account.name} ===`);
    console.log("Opening Balance:", balance);

    // Transactions
    transactions.forEach((txn: any) => {
      txn.entries?.forEach((entry: any) => {
        if (entry.ledgerid?.id === ledgerId) {
          const change = (entry.debit || 0) - (entry.credit || 0);
          balance += change;
          console.log(
            `Txn ${txn.transactioncode}: Debit=${entry.debit}, Credit=${entry.credit}, Change=${change}, Balance=${balance}`
          );
        }
      });
    });

    // Payments
    payments
      .filter((p: any) => p.partyid?.id === account.id)
      .forEach((p: any) => {
        const settled = (p.invoices || []).reduce(
          (sum: number, inv: any) => sum + (inv.settledamount || 0),
          0
        );
        balance -= settled;
        console.log(
          `Payment ${p.paymentcode}: SettledAmount=${settled}, Balance=${balance}`
        );
      });

    console.log(`Final Outstanding for ${account.name}: ${balance}`);
    return balance;
  };

  // -----------------------------
  // Customer Outstanding
  // -----------------------------
  const customerOutstandingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "customer")
      .map((a: any) => {
        const balance = calculateOutstanding(a);
        return {
          customer: a.name,
          ledger: a.ledgerid?.ledgername || "-",
          outstanding:
            balance > 0 ? balance.toFixed(2) : `(${Math.abs(balance).toFixed(2)})`,
        };
      });
  }, [accounts, transactions, payments, ledgers]);

  // -----------------------------
  // Vendor Outstanding
  // -----------------------------
  const vendorOutstandingData = useMemo(() => {
    return accounts
      .filter((a: any) => a.type === "vendor")
      .map((a: any) => {
        const balance = calculateOutstanding(a);
        return {
          vendor: a.name,
          ledger: a.ledgerid?.ledgername || "-",
          outstanding:
            balance > 0 ? balance.toFixed(2) : `(${Math.abs(balance).toFixed(2)})`,
        };
      });
  }, [accounts, transactions, payments, ledgers]);

  // -----------------------------
  // Receivable / Payable Aging
  // -----------------------------
  const agingData = useMemo(() => {
    const { fromTimestamp, toTimestamp } = getFilterTimestamps();
    const today = new Date().getTime();
    const data: any[] = [];

    accounts.forEach((a: any) => {
      const ledgerId = a.ledgerid?.id;
      if (!ledgerId) return;

      const ledger = ledgers.find((l: any) => l.id === ledgerId);
      let balance = 0;
      let oldestTxnDate: number | null = null;

      // Opening balance
      if (ledger) {
        balance =
          ledger.openingbalancetype === "debit"
            ? ledger.openingbalance
            : -ledger.openingbalance;
      }

      console.log(`\n--- Aging for ${a.name} ---`);
      console.log("Opening balance:", balance);

      // Transactions
      transactions.forEach((txn: any) => {
        const txnDate = Number(txn.transactiondate);
        if (
          (!fromTimestamp || txnDate >= fromTimestamp) &&
          (!toTimestamp || txnDate <= toTimestamp)
        ) {
          txn.entries?.forEach((e: any) => {
            if (e.ledgerid?.id === ledgerId) {
              const change = (e.debit || 0) - (e.credit || 0);
              balance += change;
              if (!oldestTxnDate || txnDate < oldestTxnDate) oldestTxnDate = txnDate;
              console.log(
                `Txn ${txn.transactioncode}: Debit=${e.debit}, Credit=${e.credit}, Change=${change}, Balance=${balance}`
              );
            }
          });
        }
      });

      // Payments
      payments
        .filter((p: any) => p.partyid?.id === a.id)
        .forEach((p: any) => {
          const payDate = Number(p.paymentdate);
          if (
            (!fromTimestamp || payDate >= fromTimestamp) &&
            (!toTimestamp || payDate <= toTimestamp)
          ) {
            const settled = (p.invoices || []).reduce(
              (sum: number, inv: any) => sum + (inv.settledamount || 0),
              0
            );
            balance -= settled;
            console.log(`Payment ${p.paymentcode}: Settled=${settled}, Balance=${balance}`);
          }
        });

      const dueDays = oldestTxnDate
        ? Math.floor((today - oldestTxnDate) / (1000 * 60 * 60 * 24))
        : 0;

      data.push({
        account: a.name,
        ledger: a.ledgerid?.ledgername || "-",
        type: a.type.charAt(0).toUpperCase() + a.type.slice(1),
        outstanding:
          balance > 0 ? balance.toFixed(2) : `(${Math.abs(balance).toFixed(2)})`,
        dueDays,
      });

      console.log(`Final Outstanding: ${balance}, Due Days: ${dueDays}`);
    });

    return data;
  }, [accounts, transactions, payments, ledgers, appliedFilters]);


  // -----------------------------
  // Table Switcher
  // -----------------------------
  let tableData: any[] = [];
  let columns: any[] = [];
  const filterFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];

  switch (activeTab) {
    case "Customer Outstanding":
      tableData = customerOutstandingData;
      columns = [
        { label: "Customer", key: "customer" },
        { label: "Ledger", key: "ledger" },
        { label: "Outstanding (₹)", key: "outstanding", numeric: true },
      ];
      break;
    case "Vendor Outstanding":
      tableData = vendorOutstandingData;
      columns = [
        { label: "Vendor", key: "vendor" },
        { label: "Ledger", key: "ledger" },
        { label: "Outstanding (₹)", key: "outstanding", numeric: true },
      ];
      break;
    case "Receivable / Payable Aging":
      tableData = agingData;
      columns = [
        { label: "Account", key: "account" },
        { label: "Ledger", key: "ledger" },
        { label: "Type", key: "type" },
        { label: "Outstanding (₹)", key: "outstanding", numeric: true },
        { label: "Due Days", key: "dueDays", numeric: true },
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
