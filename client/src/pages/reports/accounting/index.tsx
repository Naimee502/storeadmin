import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { FaBookOpen, FaChartPie, FaBalanceScale, FaWater, FaListUl, FaHandHoldingUsd, FaReceipt } from "react-icons/fa";

import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountGroupsQuery } from "../../../graphql/hooks/accountgroups";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useExpenseNotesQuery } from "../../../graphql/hooks/expensenote";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { normalizeToYMD, formatDateDMY } from "../../../utils/helper";

const reportTabsObj = [
    { id: "Ledger", label: "Ledger", icon: <FaBookOpen className="text-blue-600" /> },
    { id: "Profit & Loss", label: "Profit & Loss", icon: <FaChartPie className="text-emerald-600" /> },
    { id: "Balance Sheet", label: "Balance Sheet", icon: <FaBalanceScale className="text-purple-600" /> },
    { id: "Cash Flow Statement", label: "Cash Flow Statement", icon: <FaWater className="text-cyan-600" /> },
    { id: "Transactions Summary", label: "Transactions Summary", icon: <FaListUl className="text-amber-600" /> },
    { id: "Payments / Receipts", label: "Payments / Receipts", icon: <FaHandHoldingUsd className="text-rose-600" /> },
    { id: "Expense Notes", label: "Expense Notes", icon: <FaReceipt className="text-rose-600" /> },
];

const AccountingFinanceReports: React.FC = () => {
    const [activeTab, setActiveTab] = useState(reportTabsObj[0].id);
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
    const { data: expenseData } = useExpenseNotesQuery();
    const { data: staffData } = useStaffQuery();

    const accounts = accountsData?.getAccounts || [];
    const accountsGroup = accountsGroupData?.getAccountGroups || [];
    const ledgers = accountLedgerData?.getAccountLedgers || [];
    const transactions = [...(transactionsData?.getTransactions || [])].reverse();
    const payments = [...(paymentsData?.getPayments || [])].reverse();
    const expenseNotes = expenseData?.getExpenseNotes || [];
    const staff = staffData?.getStaffAccounts || [];

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
                        transactionDate: formatDateDMY(t.transactiondate),
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
                paymentDate: formatDateDMY(p.paymentdate),

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

    const staffOptions = staff.map((s: any) => ({
        label: `${s.firstname || ""} ${s.lastname || ""}`.trim() || s.username || s.name,
        value: s.id,
    }));

    const expenseTableData = useMemo(() => {
        return expenseNotes
            .filter((e: any) => {
                const date = normalizeToYMD(e.date || e.expensedate);
                if (appliedFilters.fromDate && date < appliedFilters.fromDate) return false;
                if (appliedFilters.toDate && date > appliedFilters.toDate) return false;
                if (appliedFilters.staffId && (e.staffaccountid?.id || e.staffid?.id) !== appliedFilters.staffId) return false;
                if (appliedFilters.category && e.category !== appliedFilters.category) return false;
                if (appliedFilters.paymenttype && (e.paymentmode || e.paymenttype) !== appliedFilters.paymenttype) return false;
                return true;
            })
            .map((e: any, idx: number) => ({
                seqNo: idx + 1,
                expenseNo: e.expensenumber || "-",
                expenseDate: formatDateDMY(e.date || e.expensedate),
                category: e.category === "tada" ? "TA/DA" : e.category ? e.category.charAt(0).toUpperCase() + e.category.slice(1) : "-",
                staffName: `${e.staffaccountid?.firstname || ""} ${e.staffaccountid?.lastname || ""}`.trim() || e.staffaccountid?.username || e.staffid?.name || "-",
                ledger: e.ledgerid?.ledgername || "-",
                paymentType: (e.paymentmode || e.paymenttype) ? (e.paymentmode || e.paymenttype).charAt(0).toUpperCase() + (e.paymentmode || e.paymenttype).slice(1) : "-",
                narration: e.notes || e.narration || "-",
                totalGst: Number(e.totalgst || 0).toFixed(2),
                totalAmount: Number(e.amount || e.totalamount || 0).toFixed(2),
                status:
                  typeof e.status === "boolean"
                    ? (e.status ? "Active" : "Inactive")
                    : (e.status
                        ? String(e.status).charAt(0).toUpperCase() + String(e.status).slice(1)
                        : "-"),
            }));
    }, [expenseNotes, appliedFilters]);

    let tableData: any[] = [];
    let columns: any[] = [];
    let filterFields: ReportFilterField[] = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
    ];
    let title = "Accounting & Finance Reports";
    let exportFileName = "AccountingReport";

    switch (activeTab) {
        case "Ledger":
            tableData = ledgerData;
            title = "Account Ledger Report";
            exportFileName = "LedgerReport";
            columns = [
                { label: "Transaction Code", key: "transactionCode" },
                { label: "Date", key: "transactionDate" },
                { label: "Account Ledger", key: "accountName" },
                { label: "Debit (₹)", key: "debit", numeric: true },
                { label: "Credit (₹)", key: "credit", numeric: true },
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
            title = "Payments & Receipts Report";
            exportFileName = "PaymentsReceiptsReport";
            columns = [
                { label: "Payment Code", key: "paymentCode" },
                { label: "Date", key: "paymentDate" },
                { label: "Party", key: "partyName" },
                { label: "Type", key: "type" },
                { label: "Mode", key: "mode" },
                { label: "Amount (₹)", key: "amount", numeric: true },
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
            title = "Profit & Loss Report";
            exportFileName = "ProfitLossReport";
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount (₹)", key: "amount", numeric: true },
            ];
            break;

        case "Balance Sheet":
            tableData = balanceSheetData;
            title = "Balance Sheet";
            exportFileName = "BalanceSheet";
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount (₹)", key: "amount", numeric: true },
            ];
            break;

        case "Cash Flow Statement":
            tableData = cashFlowData;
            title = "Cash Flow Statement";
            exportFileName = "CashFlowStatement";
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount (₹)", key: "amount", numeric: true },
            ];
            break;

        case "Transactions Summary":
            tableData = transactionsSummaryData;
            title = "Transactions Summary";
            exportFileName = "TransactionsSummary";
            columns = [
                { label: "Account", key: "account" },
                { label: "Amount / Count", key: "amount" },
            ];
            break;

        case "Expense Notes":
            tableData = expenseTableData;
            title = "Expense Notes Report";
            exportFileName = "ExpenseNotesReport";
            columns = [
                { label: "Seq No", key: "seqNo" },
                { label: "Expense No", key: "expenseNo" },
                { label: "Date", key: "expenseDate" },
                { label: "Category", key: "category" },
                { label: "Staff", key: "staffName" },
                { label: "Ledger", key: "ledger" },
                { label: "Payment Type", key: "paymentType" },
                { label: "Narration", key: "narration" },
                { label: "GST (₹)", key: "totalGst", numeric: true },
                { label: "Amount (₹)", key: "totalAmount", numeric: true },
                { label: "Status", key: "status" },
            ];
            filterFields = [
                ...filterFields,
                { name: "staffId", label: "Staff", type: "select", options: staffOptions, searchable: true },
                { name: "category", label: "Category", type: "select", options: [
                    { label: "TA/DA", value: "tada" },
                    { label: "Salary", value: "salary" },
                    { label: "Others", value: "others" },
                ]},
                { name: "paymenttype", label: "Payment Type", type: "select", options: [
                    { label: "Cash", value: "cash" },
                    { label: "Bank", value: "bank" },
                    { label: "Online", value: "online" },
                ]},
            ];
            break;

        default:
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
                <ReportTable moduleId="reports.accounting"
                    title={title}
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
                    exportFileName={exportFileName}
                    showTotals
                />
            </div>
        </HomeLayout>
    );
};

export default AccountingFinanceReports;
