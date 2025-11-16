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

    const [activeTab, setActiveTab] = useState(reportTabs[0]);
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

    // -----------------------------
    // Default date filter = last 30 days
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
    // Ledger Data (FIXED)
    // -----------------------------
    const ledgerData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        const ledgerMap: Record<string, any> = {};
        accounts.forEach(acc => {
            if (acc.ledgerid?.id) ledgerMap[acc.ledgerid.id] = acc;
        });

        return transactions
            .filter(t => {
                const date = Number(t.transactiondate);
                if (fromTimestamp && date < fromTimestamp) return false;
                if (toTimestamp && date > toTimestamp) return false;

                if (appliedFilters.ledger && !t.entries?.some(e => e.ledgerid?.id === appliedFilters.ledger))
                    return false;

                return true;
            })
            .flatMap(t =>
                t.entries?.map(e => {
                    const ledgerId = e.ledgerid?.id;
                    const acc = ledgerMap[ledgerId];

                    return {
                        transactionCode: t.transactioncode,
                        transactionDate: new Date(Number(t.transactiondate)).toISOString().slice(0, 10),
                        accountName: e.ledgerid?.ledgername || "-",
                        debit: e.debit?.toFixed(2) || "0.00",
                        credit: e.credit?.toFixed(2) || "0.00",
                        remarks: e.remarks || t.narration || "-",
                    };
                }) || []
            );
    }, [transactions, accounts, appliedFilters]);

    // -------------------------------
    // Profit & Loss
    // -------------------------------
    const profitLossData = useMemo(() => {
        if (!transactions || !ledgers) return [];

        const ledgerMap = ledgers.reduce((acc: any, l: any) => {
            acc[l.id] = l;
            return acc;
        }, {});

        let income = 0;
        let expense = 0;

        const incomeKeys = ["income", "sales", "output", "revenue"];
        const expenseKeys = ["expense", "purchase", "input", "cost"];

        transactions.forEach(tx => {
            tx.entries?.forEach(e => {
                const l = ledgerMap[e.ledgerid.id];
                if (!l) return;

                const gName = (l.accountgroupid?.accountgroupname || "").toLowerCase();
                const lName = (l.ledgername || "").toLowerCase();

                if (incomeKeys.some(k => gName.includes(k) || lName.includes(k))) {
                    income += (e.credit || 0) - (e.debit || 0);
                } else if (expenseKeys.some(k => gName.includes(k) || lName.includes(k))) {
                    expense += (e.debit || 0) - (e.credit || 0);
                }
            });
        });

        const net = income - expense;

        return [
            { account: "Total Income", amount: income.toFixed(2) },
            { account: "Total Expense", amount: expense.toFixed(2) },
            { account: "Net Profit / Loss", amount: net.toFixed(2) },
        ];
    }, [transactions, ledgers]);

    // -------------------------------
    // Balance Sheet
    // -------------------------------
    const balanceSheetData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        const balances: Record<string, number> = {};

        ledgers.forEach(l => {
            const opening = Number(l.openingbalance || 0);
            balances[l.id] = l.openingbalancetype === "credit" ? -opening : opening;
        });

        transactions.forEach(tx => {
            const date = Number(tx.transactiondate);
            if ((fromTimestamp && date < fromTimestamp) || (toTimestamp && date > toTimestamp)) return;

            tx.entries?.forEach(e => {
                const id = e.ledgerid?.id;
                balances[id] = (balances[id] || 0) + (e.debit || 0) - (e.credit || 0);
            });
        });

        const groupCat: Record<string, string> = {};
        accountsGroup.forEach(g => {
            if (g.id && g.category) groupCat[g.id] = g.category.toLowerCase();
        });

        const catTotals: any = { assets: 0, liabilities: 0, income: 0, expenses: 0 };

        ledgers.forEach(l => {
            const bal = balances[l.id] || 0;
            const g = l.accountgroupid?.id;
            let cat = groupCat[g];

            if (!cat) {
                const n = l.ledgername?.toLowerCase() || "";
                if (n.includes("bank") || n.includes("cash")) cat = "assets";
                else if (n.includes("sales")) cat = "income";
                else if (n.includes("expense")) cat = "expenses";
                else cat = "liabilities";
            }

            catTotals[cat] += bal;
        });

        const netProfit = catTotals.income - catTotals.expenses;
        const totalLE = catTotals.liabilities + netProfit;

        return [
            { account: "--- ASSETS ---", amount: "" },
            { account: "Total Assets", amount: catTotals.assets.toFixed(2) },
            { account: "--- LIABILITIES & EQUITY ---", amount: "" },
            { account: "Net Profit (Capital Adj.)", amount: netProfit.toFixed(2) },
            { account: "Total Liabilities & Equity", amount: totalLE.toFixed(2) },
        ];
    }, [transactions, ledgers, accountsGroup, appliedFilters]);

    // -------------------------------
    // Cash Flow
    // -------------------------------
    const cashFlowData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        const cashIn = payments
            .filter(p => p.type === "receipt")
            .filter(p => {
                const d = Number(p.paymentdate);
                return (!fromTimestamp || d >= fromTimestamp) && (!toTimestamp || d <= toTimestamp);
            })
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        const cashOut = payments
            .filter(p => p.type === "payment")
            .filter(p => {
                const d = Number(p.paymentdate);
                return (!fromTimestamp || d >= fromTimestamp) && (!toTimestamp || d <= toTimestamp);
            })
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        return [
            { account: "Cash In", amount: cashIn.toFixed(2) },
            { account: "Cash Out", amount: cashOut.toFixed(2) },
            { account: "Net Cash Flow", amount: (cashIn - cashOut).toFixed(2) },
        ];
    }, [payments, appliedFilters]);

    // -------------------------------
    // Transactions Summary
    // -------------------------------
    const transactionsSummaryData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        const filtered = transactions.filter(t => {
            const d = Number(t.transactiondate);
            return (!fromTimestamp || d >= fromTimestamp) && (!toTimestamp || d <= toTimestamp);
        });

        let debit = 0,
            credit = 0;

        filtered.forEach(t =>
            t.entries.forEach(e => {
                debit += e.debit || 0;
                credit += e.credit || 0;
            })
        );

        return [
            { account: "Total Transactions", amount: filtered.length },
            { account: "Total Debit", amount: debit.toFixed(2) },
            { account: "Total Credit", amount: credit.toFixed(2) },
        ];
    }, [transactions, appliedFilters]);

    // -------------------------------
    // Payments Report
    // -------------------------------
    const paymentsDataReport = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        // Helper: Capitalize only first letter
        const capitalize = (str: string = "") =>
            str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

        return payments
            .filter(p => {
                const d = Number(p.paymentdate);
                if (fromTimestamp && d < fromTimestamp) return false;
                if (toTimestamp && d > toTimestamp) return false;
                if (appliedFilters.party && p.partyid?.id !== appliedFilters.party) return false;
                return true;
            })
            .map(p => ({
                paymentCode: p.paymentcode,
                paymentDate: new Date(Number(p.paymentdate)).toISOString().slice(0, 10),

                partyName: p.partyid?.name || "-",

                // 👇 Only First Letter Uppercase
                type: capitalize(p.type),
                mode: capitalize(p.mode),

                amount: p.amount?.toFixed(2) || "0.00",
                remarks: p.remarks || "-",
            }));
    }, [payments, appliedFilters]);

    // -------------------------------
    // Filters + Table Setup (FIXED)
    // -------------------------------
    const ledgerOptions = ledgers.map(l => ({
        label: l.ledgername,
        value: l.id,
    }));

    const partyOptions = accounts.map(a => ({
        label: a.name,
        value: a.id,
    }));

    let tableData = [];
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
            filterFields.push({
                name: "ledger",
                label: "Select Ledger",
                type: "select",
                options: ledgerOptions,
                searchable: true,
            });
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
            filterFields.push({
                name: "party",
                label: "Party",
                type: "select",
                options: partyOptions,
                searchable: true,
            });
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
            break;
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
