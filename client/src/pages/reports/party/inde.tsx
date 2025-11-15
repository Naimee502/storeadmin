import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";

const PartyReports: React.FC = () => {
  const reportTabs = ["Customer Outstanding", "Vendor Outstanding", "Receivable / Payable Aging"];
  const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
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
        { label: "Outstanding", key: "outstanding" },
      ];
      break;
    case "Vendor Outstanding":
      tableData = vendorOutstandingData;
      columns = [
        { label: "Vendor", key: "vendor" },
        { label: "Ledger", key: "ledger" },
        { label: "Outstanding", key: "outstanding" },
      ];
      break;
    case "Receivable / Payable Aging":
      tableData = agingData;
      columns = [
        { label: "Account", key: "account" },
        { label: "Ledger", key: "ledger" },
        { label: "Type", key: "type" },
        { label: "Outstanding", key: "outstanding" },
        { label: "Due Days", key: "dueDays" },
      ];
      break;
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <ReportTable
          title="Party Reports"
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          defaultTab={activeTab}
          tabs={reportTabs}
          onTabChange={setActiveTab}
          showExport
          showCsv
        />
      </div>
    </HomeLayout>
  );
};

export default PartyReports;
