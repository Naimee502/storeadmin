import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountGroupsQuery } from "../../../graphql/hooks/accountgroups";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";

const AccountingFinanceReports: React.FC = () => {
    const reportTabs = [
        "Ledger",
        "Profit & Loss",
        "Balance Sheet",
        "Cash Flow Statement",
        "Transactions Summary",
        "Payments / Receipts",
    ];

    const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
    const [filters, setFilters] = useState<{ [key: string]: any }>({});
    const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

    // -----------------------------
    // Fetch all data
    // -----------------------------
    const { data: accountsData } = useAccountsQuery();
    const { data: accountsGroupData } = useAccountGroupsQuery();
    const { data: accountLedgerData } = useAccountLedgersQuery();
    const { data: transactionsData } = useTransactionsQuery();
    const { data: paymentsData } = usePaymentsQuery();



    const accounts = accountsData?.getAccounts || [];
    const accountsGroup = accountsGroupData?.getAccountGroups || [];
    const ledgers = accountLedgerData?.getAccountLedgers || [];
    const transactions = transactionsData?.getTransactions || [];
    const payments = paymentsData?.getPayments || [];


    console.log("📌 Accounts JSON:", JSON.stringify(accounts, null, 2));
    console.log("📌 Account Groups JSON:", JSON.stringify(accountsGroup, null, 2));
    console.log("📌 Ledgers:", JSON.stringify(ledgers, null, 2));
    console.log("📌 Transactions JSON:", JSON.stringify(transactions, null, 2));
    console.log("📌 Payments JSON:", JSON.stringify(payments, null, 2));


    // -----------------------------
    // Default filters: last 30 days
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

    // -----------------------------
    // Account map
    // -----------------------------
    const accountMap = useMemo(() => {
        return accounts.reduce((acc: any, a: any) => {
            acc[a.id] = a;
            return acc;
        }, {});
    }, [accounts]);

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
    // Ledger Data
    // -----------------------------
    const ledgerData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        // Map ledgerId to account for easy lookup
        const ledgerMap: Record<string, any> = {};
        accounts.forEach((acc: any) => {
            if (acc.ledgerid?.id) ledgerMap[acc.ledgerid.id] = acc;
        });

        return transactions
            .filter((t) => {
                const trxDate = Number(t.transactiondate);
                if (fromTimestamp && trxDate < fromTimestamp) return false;
                if (toTimestamp && trxDate > toTimestamp) return false;

                if (appliedFilters.account && !t.entries?.some((e: any) => e.ledgerid?.id === appliedFilters.account))
                    return false;

                return true;
            })
            .flatMap((t) =>
                t.entries?.map((e: any) => {
                    const ledgerId = e.ledgerid?.id;
                    const account = ledgerMap[ledgerId];
                    return {
                        transactionCode: t.transactioncode,
                        transactionDate: new Date(Number(t.transactiondate)).toISOString().slice(0, 10),
                        accountName: account?.name || e.ledgerid?.ledgername || "-",
                        debit: e.debit?.toFixed(2) || "0.00",
                        credit: e.credit?.toFixed(2) || "0.00",
                        remarks: e.remarks || t.narration || "-",
                    };
                }) || []
            );
    }, [transactions, accounts, appliedFilters]);

    // -------------------------------
    // ✅ Profit & Loss Report (Fixed)
    // -------------------------------
    const profitLossData = useMemo(() => {
        if (!transactions || !ledgers) return [];

        // Create ledger map for quick lookup
        const ledgerMap = ledgers.reduce((acc: Record<string, any>, ledger) => {
            acc[ledger.id] = ledger;
            return acc;
        }, {});

        let totalIncome = 0;
        let totalExpense = 0;

        // Keywords to classify ledgers
        const incomeKeywords = ["income", "sales", "output", "revenue"];
        const expenseKeywords = ["expense", "purchase", "input", "cost", "payable"];

        transactions.forEach(tx => {
            tx.entries?.forEach(entry => {
                const ledger = ledgerMap[entry.ledgerid.id];
                if (!ledger) return;

                const groupName = (ledger.accountgroupid?.accountgroupname || "").toLowerCase();
                const ledgerName = (ledger.ledgername || "").toLowerCase();

                // Classify ledger as Income
                if (incomeKeywords.some(k => groupName.includes(k) || ledgerName.includes(k))) {
                    totalIncome += (entry.credit || 0) - (entry.debit || 0);
                }
                // Classify ledger as Expense
                else if (expenseKeywords.some(k => groupName.includes(k) || ledgerName.includes(k))) {
                    totalExpense += (entry.debit || 0) - (entry.credit || 0);
                }
            });
        });

        const netProfit = totalIncome - totalExpense;

        return [
            { account: "Total Income", amount: totalIncome.toFixed(2) },
            { account: "Total Expense", amount: totalExpense.toFixed(2) },
            { account: "Net Profit / Loss", amount: netProfit.toFixed(2) },
        ];
    }, [transactions, ledgers]);

    // -------------------------------
    // ✅ Balance Sheet Report (Fixed)
    // -------------------------------
    const balanceSheetData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        // Ledger balances
        const ledgerBalances: Record<string, number> = {};
        ledgers.forEach(l => {
            if (!l.id) return;
            const opening = Number(l.openingbalance || 0);
            const type = l.openingbalancetype || "debit";
            ledgerBalances[l.id] = (type === "debit" ? opening : -opening);
        });

        // Add transaction entries
        transactions.forEach(tx => {
            const trxDate = Number(tx.transactiondate);
            if ((fromTimestamp && trxDate < fromTimestamp) || (toTimestamp && trxDate > toTimestamp)) return;

            tx.entries?.forEach(e => {
                const ledgerId = e.ledgerid?.id || e.ledgerid;
                const debit = Number(e.debit || 0);
                const credit = Number(e.credit || 0);
                ledgerBalances[ledgerId] = (ledgerBalances[ledgerId] || 0) + debit - credit;
            });
        });

        // Map group ID to category
        const groupCategoryMap: Record<string, string> = {};
        accountsGroup.forEach(g => {
            if (g.id && g.category) groupCategoryMap[g.id] = g.category.toLowerCase();
        });

        // Aggregate balances
        const categories: Record<string, number> = { assets: 0, liabilities: 0, income: 0, expenses: 0 };
        ledgers.forEach(l => {
            const balance = ledgerBalances[l.id] || 0;
            const groupId = l.accountgroupid?.id || l.accountgroupid;
            let cat = groupCategoryMap[groupId];

            if (!cat) {
                // Infer from ledger name
                const name = l.ledgername?.toLowerCase() || "";
                if (name.includes("cash") || name.includes("bank")) cat = "assets";
                else if (name.includes("sales") || name.includes("income") || name.includes("revenue")) cat = "income";
                else if (name.includes("expense") || name.includes("commission") || name.includes("input")) cat = "expenses";
                else if (name.includes("liability") || name.includes("credit") || name.includes("output") || name.includes("gst")) cat = "liabilities";
                else cat = "assets"; // fallback
            }

            categories[cat] += balance;
        });

        const netProfit = categories.income - categories.expenses;
        const totalLiabilitiesWithProfit = categories.liabilities + netProfit;

        console.log("DEBUG Categories:", categories, "Net Profit:", netProfit, "Total Liabilities + Profit:", totalLiabilitiesWithProfit);

        return [
            { account: "--- ASSETS ---", amount: "" },
            { account: "Total Assets", amount: categories.assets.toFixed(2) },
            { account: "--- LIABILITIES & EQUITY ---", amount: "" },
            { account: "Net Profit (Capital Adj.)", amount: netProfit.toFixed(2) },
            { account: "Total Liabilities & Equity", amount: totalLiabilitiesWithProfit.toFixed(2) },
        ];
    }, [transactions, ledgers, accountsGroup, appliedFilters]);

    // -----------------------------
    // Cash Flow
    // -----------------------------
    const cashFlowData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();
        const cashIn = payments
            .filter((p) => p.type === "receipt")
            .filter((p) => {
                const date = Number(p.paymentdate);
                return (!fromTimestamp || date >= fromTimestamp) && (!toTimestamp || date <= toTimestamp);
            })
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        const cashOut = payments
            .filter((p) => p.type === "payment")
            .filter((p) => {
                const date = Number(p.paymentdate);
                return (!fromTimestamp || date >= fromTimestamp) && (!toTimestamp || date <= toTimestamp);
            })
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        return [
            { account: "Cash In", amount: cashIn.toFixed(2) },
            { account: "Cash Out", amount: cashOut.toFixed(2) },
            { account: "Net Cash Flow", amount: (cashIn - cashOut).toFixed(2) },
        ];
    }, [payments, appliedFilters]);

    // -----------------------------
    // Transactions Summary
    // -----------------------------
    const transactionsSummaryData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        // Filter transactions by date
        const filteredTxns = transactions.filter((t) => {
            const date = Number(t.transactiondate);
            return (!fromTimestamp || date >= fromTimestamp) && (!toTimestamp || date <= toTimestamp);
        });

        // Compute total debit & credit dynamically from entries
        let totalDebit = 0;
        let totalCredit = 0;

        filteredTxns.forEach((t) => {
            t.entries.forEach((e) => {
                totalDebit += e.debit || 0;
                totalCredit += e.credit || 0;
            });
        });

        return [
            { account: "Total Transactions", amount: filteredTxns.length },
            { account: "Total Debit", amount: totalDebit.toFixed(2) },
            { account: "Total Credit", amount: totalCredit.toFixed(2) },
        ];
    }, [transactions, appliedFilters]);

    // -----------------------------
    // Payments / Receipts
    // -----------------------------
    const paymentsDataReport = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        return payments
            .filter((p) => {
                const payDate = Number(p.paymentdate);
                if (fromTimestamp && payDate < fromTimestamp) return false;
                if (toTimestamp && payDate > toTimestamp) return false;
                if (appliedFilters.party && p.partyid?.id !== appliedFilters.party) return false;
                return true;
            })
            .map((p) => {
                const partyName = p.partyid?.name || "-";
                const typeCapitalized = p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : "-";
                const modeCapitalized = p.mode ? p.mode.charAt(0).toUpperCase() + p.mode.slice(1) : "-";
                return {
                    paymentCode: p.paymentcode,
                    paymentDate: new Date(Number(p.paymentdate)).toISOString().slice(0, 10),
                    partyName,
                    type: typeCapitalized,
                    mode: modeCapitalized,
                    amount: p.amount?.toFixed(2) || "0.00",
                    remarks: p.remarks || "-",
                };
            });
    }, [payments, appliedFilters]);


    // -----------------------------
    // Table Switcher
    // -----------------------------
    const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));
    let tableData: any[] = [];
    let columns: any[] = [];
    let filterFields: ReportFilterField[] = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
    ];

    switch (activeTab) {
        case "Ledger":
            tableData = ledgerData;
            columns = [
                { label: "Transaction Code", key: "transactionCode" },
                { label: "Date", key: "transactionDate" },
                { label: "Account Ledger", key: "accountName" },
                { label: "Debit", key: "debit" },
                { label: "Credit", key: "credit" },
                { label: "Remarks", key: "remarks" },
            ];
            filterFields.push({ name: "account", label: "Account", type: "select", options: accountOptions, searchable: true });
            break;

        case "Payments / Receipts":
            tableData = paymentsDataReport;
            columns = [
                { label: "Payment Code", key: "paymentCode" },
                { label: "Date", key: "paymentDate" },
                { label: "Party", key: "partyName" },
                { label: "Type", key: "type" },
                { label: "Mode", key: "mode" },
                { label: "Amount", key: "amount" },
                { label: "Remarks", key: "remarks" },
            ];
            filterFields.push({ name: "party", label: "Party", type: "select", options: accountOptions, searchable: true });
            break;

        case "Profit & Loss":
            tableData = profitLossData;
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount", key: "amount" },
            ];
            break;

        case "Balance Sheet":
            tableData = balanceSheetData;
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount", key: "amount" },
            ];
            break;

        case "Cash Flow Statement":
            tableData = cashFlowData;
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount", key: "amount" },
            ];
            break;

        case "Transactions Summary":
            tableData = transactionsSummaryData;
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount", key: "amount" },
            ];
            break;

        default:
            tableData = [];
            columns = [];
    }

    return (
        <HomeLayout>
            <div className="w-full px-2 sm:px-6 pt-4 pb-6">
                <ReportTable
                    title="Accounting & Finance Reports"
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

export default AccountingFinanceReports;
