import React, { useEffect, useState, useMemo } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useSalesInvoicesQuery } from "../../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { usePaymentsQuery } from "../../../graphql/hooks/payments";

const PartyReports: React.FC = () => {
    const reportTabs = ["Customer Outstanding", "Vendor Outstanding", "Receivable / Payable Aging"];
    const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
    const [filters, setFilters] = useState<{ [key: string]: any }>({});
    const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

    // -----------------------------
    // Fetch data
    // -----------------------------
    const { data: accountsData } = useAccountsQuery();
    const { data: salesData } = useSalesInvoicesQuery();
    const { data: purchaseData } = usePurchaseInvoicesQuery();
    const { data: transactionsData } = useTransactionsQuery();
    const { data: paymentsData } = usePaymentsQuery();

    const accounts = accountsData?.getAccounts || [];
    const salesInvoices = salesData?.getSalesInvoices || [];
    const purchaseInvoices = purchaseData?.getPurchaseInvoices || [];
    const transactions = transactionsData?.getTransactions || [];
    const payments = paymentsData?.getPayments || [];

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

    // -----------------------------
    // Helper: Filter timestamps
    // -----------------------------
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
    // Customer Outstanding
    // -----------------------------
    const customerOutstandingData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        return accounts
            .filter(a => a.type === "customer")
            .map(a => {
                const customerSales = salesInvoices
                    .filter(s => s.partyacc === a.id) 
                    .filter(s => {
                        const invoiceDate = new Date(s.billdate).getTime(); 
                        return (!fromTimestamp || invoiceDate >= fromTimestamp) && (!toTimestamp || invoiceDate <= toTimestamp);
                    });

                const totalSales = customerSales.reduce((sum, s) => sum + (s.totalamount || 0), 0);
                const totalPayments = customerSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0); 

                const outstanding = totalSales - totalPayments;

                return {
                    customer: a.name,
                    outstanding: outstanding.toFixed(2),
                };
            });
    }, [accounts, salesInvoices, appliedFilters]);

    // -----------------------------
    // Vendor Outstanding
    // -----------------------------
    const vendorOutstandingData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();

        return accounts
            .filter(a => a.type === "vendor")
            .map(a => {
                const vendorPurchases = purchaseInvoices
                    .filter(p => p.partyacc === a.id) 
                    .filter(p => {
                        const invoiceDate = new Date(p.billdate).getTime(); 
                        return (!fromTimestamp || invoiceDate >= fromTimestamp) && (!toTimestamp || invoiceDate <= toTimestamp);
                    });

                const totalPurchases = vendorPurchases.reduce((sum, p) => sum + (p.totalamount || 0), 0);
                const totalPayments = vendorPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0); 

                const outstanding = totalPurchases - totalPayments;

                return {
                    vendor: a.name,
                    outstanding: outstanding.toFixed(2),
                };
            });
    }, [accounts, purchaseInvoices, appliedFilters]);

    // -----------------------------
    // Receivable / Payable Aging
    // -----------------------------
    const agingData = useMemo(() => {
        const { fromTimestamp, toTimestamp } = getFilterTimestamps();
        const today = new Date().getTime();

        const data: any[] = [];

        accounts.forEach(a => {
            // Filter transactions related to this account
            const accountTxns = transactions
                .filter(t => (t.entries || []).some(e => e.accountid === a.id))
                .filter(t => {
                    const txnDate = Number(t.transactiondate);
                    return (!fromTimestamp || txnDate >= fromTimestamp) && (!toTimestamp || txnDate <= toTimestamp);
                });

            // Calculate outstanding
            let outstanding = 0;
            let oldestTxnDate: number | null = null;

            accountTxns.forEach(txn => {
                txn.entries.forEach((e: any) => {
                    if (e.accountid === a.id) {
                        if (a.type === "customer") {
                            outstanding += (e.credit || 0) - (e.debit || 0); // Customer owes money
                        } else if (a.type === "vendor") {
                            outstanding += (e.debit || 0) - (e.credit || 0); // Vendor owed money
                        } else {
                            outstanding += (e.debit || 0) - (e.credit || 0); // Others
                        }
                    }
                });

                const txnDate = Number(txn.transactiondate);
                if (!oldestTxnDate || txnDate < oldestTxnDate) oldestTxnDate = txnDate;
            });

            // Subtract payments for this account
            const accountPayments = payments
                .filter(p => p.partyid === a.id)
                .filter(p => {
                    const payDate = Number(p.paymentdate);
                    return (!fromTimestamp || payDate >= fromTimestamp) && (!toTimestamp || payDate <= toTimestamp);
                })
                .reduce((sum, p) => {
                    const settled = (p.invoices || []).reduce((s, inv) => s + (inv.settledamount || 0), 0);
                    return sum + settled;
                }, 0);

            // Adjust outstanding with payments
            if (a.type === "customer") {
                outstanding -= accountPayments; // Customer payments reduce what they owe
            } else if (a.type === "vendor") {
                outstanding -= accountPayments; // Vendor payments reduce what we owe them
            }

            const dueDays = oldestTxnDate ? Math.floor((today - oldestTxnDate) / (1000 * 60 * 60 * 24)) : 0;

            data.push({
                account: a.name,
                type: a.type.charAt(0).toUpperCase() + a.type.slice(1),
                outstanding: outstanding.toFixed(2),
                dueDays,
            });
        });

        console.log("Aging Data:", JSON.stringify(data));
        return data;
    }, [accounts, transactions, payments, appliedFilters]);

    // -----------------------------
    // Table Switcher
    // -----------------------------
    let tableData: any[] = [];
    let columns: any[] = [];
    let filterFields: ReportFilterField[] = [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
    ];

    switch (activeTab) {
        case "Customer Outstanding":
            tableData = customerOutstandingData;
            columns = [
                { label: "Customer", key: "customer" },
                { label: "Outstanding", key: "outstanding" },
            ];
            break;

        case "Vendor Outstanding":
            tableData = vendorOutstandingData;
            columns = [
                { label: "Vendor", key: "vendor" },
                { label: "Outstanding", key: "outstanding" },
            ];
            break;

        case "Receivable / Payable Aging":
            tableData = agingData;
            columns = [
                { label: "Account", key: "account" },
                { label: "Type", key: "type" },
                { label: "Outstanding", key: "outstanding" },
                { label: "Due Days", key: "dueDays" },
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
