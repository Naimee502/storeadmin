import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountGroupsQuery } from "../../../graphql/hooks/accountgroups";

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
    const { data: salesData } = useSalesInvoicesQuery();
    const { data: purchaseData } = usePurchaseInvoicesQuery();
    const { data: transactionsData } = useTransactionsQuery();
    const { data: paymentsData } = usePaymentsQuery();


    const accounts = accountsData?.getAccounts || [];
    const accountsGroup = accountsGroupData?.getAccountGroups || [];
    const salesInvoices = salesData?.getSalesInvoices || [];
    const purchaseInvoices = purchaseData?.getPurchaseInvoices || [];
    const transactions = transactionsData?.getTransactions || [];
    const payments = paymentsData?.getPayments || [];

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
        return transactions
            .filter((t) => {
                const trxDate = Number(t.transactiondate);
                if (fromTimestamp && trxDate < fromTimestamp) return false;
                if (toTimestamp && trxDate > toTimestamp) return false;
                if (appliedFilters.account && !t.entries?.some((e: any) => e.accountid === appliedFilters.account))
                    return false;
                return true;
            })
            .flatMap((t) =>
                t.entries?.map((e: any) => ({
                    transactionCode: t.transactioncode,
                    transactionDate: new Date(Number(t.transactiondate)).toISOString().slice(0, 10),
                    accountName: accountMap[e.accountid]?.name || "-",
                    debit: e.debit?.toFixed(2) || "0.00",
                    credit: e.credit?.toFixed(2) || "0.00",
                    remarks: e.remarks || t.narration || "-",
                })) || []
            );
    }, [transactions, accountMap, appliedFilters]);

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
                if (appliedFilters.party && p.partyid !== appliedFilters.party) return false;
                return true;
            })
            .map((p) => {
                const party = accountMap[p.partyid] || {};
                return {
                    paymentCode: p.paymentcode,
                    paymentDate: new Date(Number(p.paymentdate)).toISOString().slice(0, 10),
                    partyName: party.name || "-",
                    type: p.type,
                    mode: p.mode,
                    amount: p.amount?.toFixed(2) || "0.00",
                    remarks: p.remarks || "-",
                };
            });
    }, [payments, accountMap, appliedFilters]);

    // -------------------------------
    // ✅ Profit & Loss Report (Fixed)
    // -------------------------------
    const profitLossData = useMemo(() => {
        if (!accountsGroup || accountsGroup.length === 0) return [];

        const { fromTimestamp, toTimestamp } = getFilterTimestamps();
        const balances: Record<string, number> = {};

        transactions.forEach((t) => {
            const trxDate = Number(t.transactiondate);
            if ((fromTimestamp && trxDate < fromTimestamp) || (toTimestamp && trxDate > toTimestamp)) return;

            t.entries?.forEach((e: any) => {
                const accountId = typeof e.accountid === "object" ? e.accountid : e.accountid;
                const acc = accounts.find(a => a.id === accountId || a._id === accountId);
                if (!acc || !acc.accountgroupid) return;

                const groupId = typeof acc.accountgroupid === "object" ? acc.accountgroupid.id : acc.accountgroupid;
                const group = accountsGroup.find((g: any) => g.id === groupId || g._id === groupId);
                if (!group || !group.category) {
                    console.log("Group not found for account:", acc);
                    return;
                }

                const category = group.category.toLowerCase();
                if (category === "income") {
                    balances[accountId] = (balances[accountId] || 0) + (e.credit || 0) - (e.debit || 0);
                } else if (category === "expenses") {
                    balances[accountId] = (balances[accountId] || 0) + (e.debit || 0) - (e.credit || 0);
                }
            });
        });

        const incomeAccounts = accounts.filter(a => {
            const groupId = typeof a.accountgroupid === "object" ? a.accountgroupid.id : a.accountgroupid;
            const group = accountsGroup.find((g: any) => g.id === groupId || g._id === groupId);
            return group?.category?.toLowerCase() === "income";
        });

        const expenseAccounts = accounts.filter(a => {
            const groupId = typeof a.accountgroupid === "object" ? a.accountgroupid.id : a.accountgroupid;
            const group = accountsGroup.find((g: any) => g.id === groupId || g._id === groupId);
            return group?.category?.toLowerCase() === "expenses";
        });

        const totalIncome = incomeAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
        const totalExpense = expenseAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
        const netProfit = totalIncome - totalExpense;

        return [
            ...incomeAccounts.map(a => ({ account: a.name, amount: (balances[a.id] || 0).toFixed(2) })),
            { account: "Total Income", amount: totalIncome.toFixed(2) },
            ...expenseAccounts.map(a => ({ account: a.name, amount: (balances[a.id] || 0).toFixed(2) })),
            { account: "Total Expense", amount: totalExpense.toFixed(2) },
            { account: "Net Profit / Loss", amount: netProfit.toFixed(2) },
        ];
    }, [transactions, accounts, accountsGroup, appliedFilters]);

    // -------------------------------
    // ✅ Balance Sheet Report (Fixed)
    // -------------------------------
    const balanceSheetData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();
        const accountBalances: Record<string, number> = {};

        transactions.forEach((t) => {
            const trxDate = Number(t.transactiondate);
            if ((fromTimestamp && trxDate < fromTimestamp) || (toTimestamp && trxDate > toTimestamp)) return;

            t.entries?.forEach((e: any) => {
                const accountId =
                    typeof e.accountid === "object" ? e.accountid._id : e.accountid;
                const acc = accounts.find(
                    (a) => a.id === accountId || a._id === accountId
                );

                if (!acc) return;
                const category = acc.accountgroupid?.category?.toLowerCase();

                if (["income", "liabilities"].includes(category)) {
                    accountBalances[accountId] =
                        (accountBalances[accountId] || 0) + (e.credit || 0) - (e.debit || 0);
                } else {
                    accountBalances[accountId] =
                        (accountBalances[accountId] || 0) + (e.debit || 0) - (e.credit || 0);
                }
            });
        });

        const assetAccounts = accounts.filter(
            (a) => a.accountgroupid?.category?.toLowerCase() === "assets"
        );
        const liabilityAccounts = accounts.filter(
            (a) => a.accountgroupid?.category?.toLowerCase() === "liabilities"
        );
        const incomeAccounts = accounts.filter(
            (a) => a.accountgroupid?.category?.toLowerCase() === "income"
        );
        const expenseAccounts = accounts.filter(
            (a) => a.accountgroupid?.category?.toLowerCase() === "expenses"
        );

        const totalAssets = assetAccounts.reduce(
            (sum, a) => sum + (accountBalances[a.id] || accountBalances[a._id] || 0),
            0
        );
        const totalLiabilities = liabilityAccounts.reduce(
            (sum, a) => sum + (accountBalances[a.id] || accountBalances[a._id] || 0),
            0
        );

        // Include Net Profit/Loss as Capital Adjustment
        const totalIncome = incomeAccounts.reduce(
            (sum, a) => sum + (accountBalances[a.id] || accountBalances[a._id] || 0),
            0
        );
        const totalExpense = expenseAccounts.reduce(
            (sum, a) => sum + (accountBalances[a.id] || accountBalances[a._id] || 0),
            0
        );
        const netProfit = totalIncome - totalExpense;
        const totalLiabilitiesWithProfit = totalLiabilities + netProfit;

        const formatAccount = (a: any) => ({
            account: a.name,
            amount: (accountBalances[a.id] || accountBalances[a._id] || 0).toFixed(2),
        });

        return [
            { account: "--- Assets ---", amount: "" },
            ...assetAccounts.map(formatAccount),
            { account: "Total Assets", amount: totalAssets.toFixed(2) },
            { account: "--- Liabilities ---", amount: "" },
            ...liabilityAccounts.map(formatAccount),
            { account: "Net Profit (Capital Adj.)", amount: netProfit.toFixed(2) },
            { account: "Total Liabilities", amount: totalLiabilitiesWithProfit.toFixed(2) },
        ];
    }, [transactions, accounts, appliedFilters]);

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
        const filteredTxns = transactions.filter((t) => {
            const date = Number(t.transactiondate);
            return (!fromTimestamp || date >= fromTimestamp) && (!toTimestamp || date <= toTimestamp);
        });
        const totalDebit = filteredTxns.reduce((sum, t) => sum + (t.totaldebit || 0), 0);
        const totalCredit = filteredTxns.reduce((sum, t) => sum + (t.totalcredit || 0), 0);

        return [
            { account: "Total Transactions", amount: filteredTxns.length },
            { account: "Total Debit", amount: totalDebit.toFixed(2) },
            { account: "Total Credit", amount: totalCredit.toFixed(2) },
        ];
    }, [transactions, appliedFilters]);

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
                { label: "Account", key: "accountName" },
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
