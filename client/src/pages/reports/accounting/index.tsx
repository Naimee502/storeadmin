import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { FaBookOpen, FaChartPie, FaBalanceScale, FaWater, FaListUl, FaHandHoldingUsd, FaReceipt, FaFileInvoiceDollar } from "react-icons/fa";

import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";
import { useAccountGroupsQuery } from "../../../graphql/hooks/accountgroups";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useExpenseNotesQuery } from "../../../graphql/hooks/expensenote";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useAdminSettingsQuery } from "../../../graphql/hooks/adminsettings";
import { normalizeToYMD, formatDateDMY, todayYMD, shiftDaysYMD } from "../../../utils/helper";

const reportTabsObj = [
    { id: "Ledger", label: "Ledger", icon: <FaBookOpen className="text-blue-600" /> },
    { id: "Profit & Loss", label: "Profit & Loss", icon: <FaChartPie className="text-emerald-600" /> },
    { id: "Balance Sheet", label: "Balance Sheet", icon: <FaBalanceScale className="text-purple-600" /> },
    { id: "Cash Flow Statement", label: "Cash Flow Statement", icon: <FaWater className="text-cyan-600" /> },
    { id: "Transactions Summary", label: "Transactions Summary", icon: <FaListUl className="text-amber-600" /> },
    { id: "Payments / Receipts", label: "Payments / Receipts", icon: <FaHandHoldingUsd className="text-rose-600" /> },
    { id: "Expense Notes", label: "Expense Notes", icon: <FaReceipt className="text-rose-600" /> },
    { id: "Ledger Statement", label: "Ledger Statement", icon: <FaFileInvoiceDollar className="text-indigo-600" /> },
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
    const { data: adminSettingsData } = useAdminSettingsQuery();

    const accounts = accountsData?.getAccounts || [];
    const accountsGroup = accountsGroupData?.getAccountGroups || [];
    const ledgers = accountLedgerData?.getAccountLedgers || [];
    const transactions = [...(transactionsData?.getTransactions || [])].reverse();
    const payments = [...(paymentsData?.getPayments || [])].reverse();
    const expenseNotes = expenseData?.getExpenseNotes || [];
    const staff = staffData?.getStaffAccounts || [];

    // Per-business feature flag: "Discount & Commission on Payment settlement".
    // Off means the business never collects a concession, so the four-column
    // Settled / Discount / Commission / Cash split is noise -- the sheet goes
    // back to the single Amount column it always had.
    const dcEnabled = !!adminSettingsData?.getAdminSettings?.enablePaymentDiscountCommission;

    // -----------------------------
    // Default date filter = last 30 days
    // -----------------------------
    useEffect(() => {
        const to = todayYMD();
        const from = shiftDaysYMD(-30);

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

        // Remarks column ma user e jate lakhelu remark j dekhavu joie.
        // Payment / Expense Note mathi bane te journal na entry remarks auto
        // generate thay che ("Receipt from X"), etle source document nu asal
        // remark map kari ne pehla e batavie; na hoy to j auto text.
        const sourceRemarkMap: Record<string, string> = {};
        payments.forEach((p: any) => {
            const r = (p.remarks || "").trim();
            if (p.id && r) sourceRemarkMap[p.id] = r;
        });
        expenseNotes.forEach((e: any) => {
            const r = (e.notes || e.narration || "").trim();
            if (e.id && r) sourceRemarkMap[e.id] = r;
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
            .flatMap(t => {
                const docId = (t as any).source?.docid;
                const sourceRemark = docId ? sourceRemarkMap[docId] : "";

                return t.entries?.map(e => {
                    const ledgerId = e.ledgerid?.id;
                    const acc = ledgerMap[ledgerId];

                    return {
                        transactionCode: t.transactioncode,
                        transactionDate: formatDateDMY(t.transactiondate),
                        accountName: e.ledgerid?.ledgername || "-",
                        debit: e.debit?.toFixed(2) || "0.00",
                        credit: e.credit?.toFixed(2) || "0.00",
                        remarks: sourceRemark || e.remarks || t.narration || "-",
                    };
                }) || [];
            });
    }, [transactions, accounts, payments, expenseNotes, appliedFilters]);

    // -----------------------------
    // Ledger Statement  (built from PAYMENTS, not Transactions)
    // -----------------------------
    // One LEDGER read as a running statement — the same shape as the Party
    // Statement, but for any ledger at all (Cash, Bank, Discount Allowed,
    // Commission Received, a party's own ledger) and sourced from the payment
    // documents rather than the posted Transactions.
    //
    // Each payment is expanded into its journal legs exactly as the server
    // posts them (resolvers/payments — buildPaymentEntries / buildLedgerEntries):
    //
    //   Receipt : Dr Cash + Dr Discount Allowed
    //               Cr Party/Ledger + Cr Commission Received
    //   Payment : Dr Party/Ledger + Dr Commission
    //               Cr Cash + Cr Discount Received
    //
    //   party leg = cash + discount - commission
    //
    // A discount lowers the cash without lowering the bill and a commission is
    // charged on top of it, so the party leg is NOT the cash amount. Treating
    // it as the cash amount is exactly what makes Customer Outstanding drift.

    /** Every ledger that can have a statement, for the picker. */
    const statementLedgerOptions = useMemo(
        () => ledgers.map((l: any) => ({ label: l.ledgername, value: l.id })),
        [ledgers]
    );

    // Pick the first ledger by default so the tab is never a blank screen.
    useEffect(() => {
        if (activeTab !== "Ledger Statement" || !statementLedgerOptions.length) return;
        if (appliedFilters.statementledger) return;
        const first = statementLedgerOptions[0].value;
        setFilters((f) => ({ ...f, statementledger: first }));
        setAppliedFilters((f) => ({ ...f, statementledger: first }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, statementLedgerOptions]);

    const statementLedger = useMemo(
        () => ledgers.find((l: any) => l.id === appliedFilters.statementledger) || null,
        [ledgers, appliedFilters.statementledger]
    );

    const ledgerStatementData = useMemo(() => {
        const target = statementLedger;
        if (!target) return [];

        const { fromTimestamp, toTimestamp } = getFilterTimestamps();
        const r2 = (n: any) => parseFloat((Number(n) || 0).toFixed(2));

        // Party account -> the ledger it posts to. The party leg of a payment
        // names the ACCOUNT, but the statement is keyed by LEDGER, so the two
        // have to be joined before a party receipt can land on this sheet.
        const partyLedgerOf: Record<string, { id?: string; name: string }> = {};
        accounts.forEach((a: any) => {
            if (a.id) partyLedgerOf[a.id] = { id: a.ledgerid?.id, name: a.ledgerid?.ledgername || a.name || "-" };
        });

        // Discount / Commission ledgers are created on the server the first time
        // they are needed, so the payment document never carries their ids.
        // Resolve them by name or those legs can never be selected here.
        const ledgerIdByName: Record<string, string> = {};
        ledgers.forEach((l: any) => {
            if (l.ledgername) ledgerIdByName[String(l.ledgername).toLowerCase()] = l.id;
        });
        const namedLedger = (name: string) => ({ id: ledgerIdByName[name.toLowerCase()], name });

        const timeOf = (d: any) => {
            if (!d) return NaN;
            const str = String(d).trim();
            return /^\d+$/.test(str) ? Number(str) : new Date(str).getTime();
        };

        type Row = { t: number; type: string; ref: string; debit: number; credit: number };
        const rows: Row[] = [];

        payments
            .filter((p: any) => p.status !== false)
            .forEach((p: any) => {
                const invs = Array.isArray(p.invoices) ? p.invoices : [];

                // Concessions can sit on the bill lines OR on the payment itself
                // (an opening-balance-only receipt has no line to hang them on),
                // so take the larger of the two — the same rule the server uses.
                const lineDiscount = r2(invs.reduce((sum: number, i: any) => sum + (Number(i.discount) || 0), 0));
                const lineCommission = r2(invs.reduce((sum: number, i: any) => sum + (Number(i.commission) || 0), 0));
                const discount = Math.max(lineDiscount, r2(p.discount));
                const commission = Math.max(lineCommission, r2(p.commission));

                const cash = r2(p.amount);
                const settled = r2(cash + discount - commission);

                const isReceipt = String(p.type || "").toLowerCase() === "receipt";
                const viaParty = !!p.partyid?.id;

                const cashLeg = { id: p.ledgerid?.id, name: p.ledgerid?.ledgername || "-" };
                const counterLeg = viaParty
                    ? partyLedgerOf[p.partyid.id] || { id: undefined, name: p.partyid?.name || "-" }
                    : { id: p.counterledgerid?.id, name: p.counterledgerid?.ledgername || "-" };

                const legs: any[] = isReceipt
                    ? [
                        { ...cashLeg, debit: cash, credit: 0 },
                        ...(discount > 0 ? [{ ...namedLedger("Discount Allowed"), debit: discount, credit: 0 }] : []),
                        { ...counterLeg, debit: 0, credit: settled },
                        ...(commission > 0 ? [{ ...namedLedger("Commission Received"), debit: 0, credit: commission }] : []),
                    ]
                    : [
                        { ...counterLeg, debit: settled, credit: 0 },
                        ...(commission > 0 ? [{ ...namedLedger("Commission"), debit: commission, credit: 0 }] : []),
                        { ...cashLeg, debit: 0, credit: cash },
                        ...(discount > 0 ? [{ ...namedLedger("Discount Received"), debit: 0, credit: discount }] : []),
                    ];

                // Only this ledger's own legs belong on its statement. A payment
                // can touch it more than once (paying a party out of that same
                // party's ledger), so every matching leg is kept, not the first.
                legs
                    .filter((l: any) => l.id === target.id)
                    .filter((l: any) => (l.debit || 0) > 0.005 || (l.credit || 0) > 0.005)
                    .forEach((l: any) => {
                        rows.push({
                            t: timeOf(p.paymentdate),
                            type: isReceipt ? "Payment-In" : "Payment-Out",
                            ref: String(p.paymentcode ?? "-"),
                            debit: r2(l.debit),
                            credit: r2(l.credit),
                        });
                    });
            });

        const valid = rows.filter((r) => !isNaN(r.t)).sort((x, y) => x.t - y.t);

        // Everything before the period is folded into one beginning balance, so
        // the statement opens with what the ledger carried in, not from zero.
        let balance =
            target.openingbalancetype === "credit"
                ? -(Number(target.openingbalance) || 0)
                : Number(target.openingbalance) || 0;
        valid
            .filter((r) => fromTimestamp && r.t < fromTimestamp)
            .forEach((r) => { balance += r.debit - r.credit; });

        const label = (n: number) => `₹${Math.abs(n).toFixed(2)}(${n < 0 ? "Cr" : "Dr"})`;

        const out: any[] = [
            {
                date: appliedFilters.fromDate ? formatDateDMY(appliedFilters.fromDate) : "-",
                txnType: "Opening Beginning Balance",
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
    }, [statementLedger, payments, accounts, ledgers, appliedFilters]);

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
    const paymentsLedger = useMemo(
        () => ledgers.find((l: any) => l.id === appliedFilters.paymentledger) || null,
        [ledgers, appliedFilters.paymentledger]
    );

    // Filtered by LEDGER, not by party. A payment keeps its counter leg in one
    // of two places -- partyid (party mode) or counterledgerid (ledger mode) --
    // and a party filter can only ever see the first, so every ledger-mode
    // receipt fell out of this report entirely. The ledger is what both modes
    // have in common: a party posts to its own ledger anyway.
    //
    // Concessions are broken out too. The party's own statement can never show
    // them (a discount / commission posts to its own income ledger, not to the
    // party), so this is the one sheet that answers "how much commission did we
    // charge this party, and how much discount did we allow".
    const paymentsDataReport = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();
        const r2 = (n: any) => parseFloat((Number(n) || 0).toFixed(2));

        // Helper: Capitalize only first letter
        const capitalize = (str: string = "") =>
            str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

        // paymentdate arrives as an epoch string OR an ISO date. Number() turns
        // the ISO form into NaN and then every date comparison below silently
        // passes, which is why a wrong date range never looked wrong.
        const timeOf = (d: any) => {
            if (!d) return NaN;
            const str = String(d).trim();
            return /^\d+$/.test(str) ? Number(str) : new Date(str).getTime();
        };

        // Party account -> the ledger it actually posts to, so a party-mode
        // receipt is still found by picking that party's ledger in the filter.
        const partyLedgerOf: Record<string, { id?: string; name: string }> = {};
        accounts.forEach((a: any) => {
            if (a.id)
                partyLedgerOf[a.id] = {
                    id: a.ledgerid?.id,
                    name: a.ledgerid?.ledgername || a.name || "-",
                };
        });

        return payments
            .filter((p: any) => p.status !== false)
            .map((p: any) => {
                const invs = Array.isArray(p.invoices) ? p.invoices : [];

                // Same rule the server and the Ledger Statement use: a
                // concession can sit on the bill lines or on the payment itself
                // (an opening-balance-only receipt has no line to hang it on).
                const lineDiscount = r2(invs.reduce((s: number, i: any) => s + (Number(i.discount) || 0), 0));
                const lineCommission = r2(invs.reduce((s: number, i: any) => s + (Number(i.commission) || 0), 0));
                const discount = Math.max(lineDiscount, r2(p.discount));
                const commission = Math.max(lineCommission, r2(p.commission));

                // Cash is what moved; settled is what came off the balance.
                const cash = r2(p.amount);
                const settled = r2(cash + discount - commission);

                const counter = p.partyid?.id
                    ? partyLedgerOf[p.partyid.id] || { id: undefined, name: p.partyid?.name || "-" }
                    : { id: p.counterledgerid?.id, name: p.counterledgerid?.ledgername || "-" };

                return {
                    t: timeOf(p.paymentdate),
                    // Both legs, so the sheet answers either question: "what did
                    // this party pay" and "what came through the cash ledger".
                    ledgerIds: [counter.id, p.ledgerid?.id].filter(Boolean),

                    paymentCode: p.paymentcode,
                    paymentDate: formatDateDMY(p.paymentdate),
                    ledgerName: counter.name,

                    // Only First Letter Uppercase
                    type: capitalize(p.type),
                    mode: capitalize(p.mode),

                    settled: settled.toFixed(2),
                    discount: discount.toFixed(2),
                    commission: commission.toFixed(2),
                    amount: cash.toFixed(2),
                    remarks: p.remarks || "-",
                };
            })
            .filter((row: any) => {
                if (!isNaN(row.t)) {
                    if (fromTimestamp && row.t < fromTimestamp) return false;
                    if (toTimestamp && row.t > toTimestamp) return false;
                }
                if (
                    appliedFilters.paymentledger &&
                    !row.ledgerIds.includes(appliedFilters.paymentledger)
                )
                    return false;
                return true;
            })
            // Keep the row down to what the table shows; t / ledgerIds are join
            // keys for the filter above and nothing else.
            .map((row: any) => ({
                paymentCode: row.paymentCode,
                paymentDate: row.paymentDate,
                ledgerName: row.ledgerName,
                type: row.type,
                mode: row.mode,
                settled: row.settled,
                discount: row.discount,
                commission: row.commission,
                amount: row.amount,
                remarks: row.remarks,
            }));
    }, [payments, accounts, appliedFilters]);

    // -------------------------------
    // Filters + Table Setup (FIXED)
    // -------------------------------
    const ledgerOptions = ledgers.map(l => ({
        label: l.ledgername,
        value: l.id,
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
    let netTotal: { debitKey: string; creditKey: string; showInKey?: string } | undefined;
    let pdfSubtitle: string[] | undefined;

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
            // Totals row ma Remarks column ni niche net (Debit - Credit) batavo
            netTotal = { debitKey: "debit", creditKey: "credit", showInKey: "remarks" };
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
            // Same header the Ledger Statement PDF carries -- which ledger this
            // sheet is for, and over what period.
            pdfSubtitle = [
                `Ledger name: ${paymentsLedger?.ledgername || "All Ledgers"}`,
                `Duration: From ${appliedFilters.fromDate ? formatDateDMY(appliedFilters.fromDate) : "-"} to ${appliedFilters.toDate ? formatDateDMY(appliedFilters.toDate) : "-"}`,
            ];
            columns = [
                { label: "Payment Code", key: "paymentCode" },
                { label: "Date", key: "paymentDate" },
                { label: "Ledger", key: "ledgerName" },
                { label: "Type", key: "type" },
                { label: "Mode", key: "mode" },
                // With concessions switched on, Settled is what came off the
                // balance and Cash is what actually moved -- the gap between the
                // two IS the discount / commission. With the flag off the two are
                // always equal, so one Amount column says everything.
                ...(dcEnabled
                    ? [
                        { label: "Settled (₹)", key: "settled", numeric: true },
                        { label: "Discount (₹)", key: "discount", numeric: true },
                        { label: "Commission (₹)", key: "commission", numeric: true },
                        { label: "Cash (₹)", key: "amount", numeric: true },
                    ]
                    : [{ label: "Amount (₹)", key: "amount", numeric: true }]),
                { label: "Remarks", key: "remarks" },
            ];
            filterFields.push({
                name: "paymentledger",
                label: "Ledger",
                type: "select",
                options: ledgerOptions,
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

        case "Ledger Statement":
            tableData = ledgerStatementData;
            title = "Ledger Statement";
            exportFileName = "LedgerStatement";
            if (statementLedger) {
                pdfSubtitle = [
                    `Ledger name: ${statementLedger.ledgername || ""}`,
                    `Duration: From ${appliedFilters.fromDate ? formatDateDMY(appliedFilters.fromDate) : "-"} to ${appliedFilters.toDate ? formatDateDMY(appliedFilters.toDate) : "-"}`,
                ];
            }
            columns = [
                { label: "Date", key: "date" },
                { label: "Txn Type", key: "txnType" },
                { label: "Ref No.", key: "ref" },
                { label: "Debit (₹)", key: "debit", numeric: true },
                { label: "Credit (₹)", key: "credit", numeric: true },
                {
                    // Deliberately not `numeric`: a running balance is a position
                    // at a point in time, and summing every row of it is
                    // meaningless. Right-align by hand so it still reads as money.
                    label: "Running Balance",
                    key: "runningBalance",
                    render: (row: any) => (
                        <span className="block text-right whitespace-nowrap">{row.runningBalance}</span>
                    ),
                },
            ];
            // A statement is always ONE ledger, so that choice leads the filter
            // bar rather than trailing the dates.
            filterFields = [
                {
                    name: "statementledger",
                    label: "Ledger",
                    type: "select",
                    options: statementLedgerOptions,
                    searchable: true,
                },
                ...filterFields,
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
                    netTotal={netTotal}
                    pdfSubtitle={pdfSubtitle}
                />
            </div>
        </HomeLayout>
    );
};

export default AccountingFinanceReports;
