import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addSalesInvoices } from "../../redux/slices/salesinvoice";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesInvoicesQuery,
  useSalesInvoiceMutations,
} from "../../graphql/hooks/salesinvoice";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { useProductsQuery } from "../../graphql/hooks/products";

const SalesInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const branchid = localStorage.getItem("branchid") || "";
  const { data, refetch } = useSalesInvoicesQuery(branchid);
  const { deleteSalesInvoiceMutation } = useSalesInvoiceMutations();
  const invoiceList = data?.getSalesInvoices || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const { data: accountData } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const accountsMap = new Map(accountsList.map((acc: any) => [acc.id, acc]));

  const { data: productData, refetch: productRefetch } = useProductsQuery();
  const productList = productData?.getProducts || [];
  const productMap = new Map(productList.map((p: any) => [p.id, p.name]));

  // Use ref for the printable component
  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const [readyToPrint, setReadyToPrint] = useState(false);

  // React-to-Print hook setup
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "Sales Invoice",
    onAfterPrint: () => {
      setPrintInvoice(null);
      setReadyToPrint(false);
    },
    onPrintError: (error) => {
      console.error("Print error:", error);
    },
  });

  // Fetch data on mount
  useEffect(() => {
    const fetchInvoices = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getSalesInvoices) {
          dispatch(addSalesInvoices(data.getSalesInvoices));
        }
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchInvoices();
  }, [dispatch, refetch]);

  // Step 1: When printInvoice is set, trigger readyToPrint
  useEffect(() => {
    if (printInvoice) {
      setReadyToPrint(true);
    }
  }, [printInvoice]);

  // Step 2: When readyToPrint and ref available, call handlePrint
  useEffect(() => {
    if (readyToPrint && componentRef.current) {
      handlePrint?.();
    }
  }, [readyToPrint, handlePrint]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Payment Type", key: "paymenttype" },
    { label: "Party A/c", key: "partyacc" },
    { label: "Total Items", key: "totalitem" },
    { label: "Total Qty", key: "totalqty" },
    { label: "Billing Date", key: "billdate" },
    { label: "Billing No", key: "billtype_billnumber" },
    { label: "Total Amount", key: "totalamount" },
    { label: "Status", key: "status" },
  ];

  const tableData = invoiceList.map((invoice: any, index: number) => {
    const totalqty = invoice.products.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    const account = accountsMap.get(invoice.partyacc);
    
    const productname = invoice.products
      .map((p: any) => productMap.get(p.id) || "Unknown")
      .join(", ");

    return {
      ...invoice,
      seqNo: index + 1,
      totalitem: invoice.products.length,
      totalqty,
      billtype_billnumber: `${invoice.billtype}-${invoice.billnumber}`,
      status: invoice.status ? "Active" : "Inactive",
      partyacc: account
        ? `${account.name} - ${account.mobile}`
        : invoice.partyacc,
      productname,
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Sales Invoices"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={true}
          showPrint={true}
          onView={(row) => navigate(`/salesinvoice/view/${row.id}`)}
          onEdit={(row) => navigate(`/salesinvoice/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to delete invoice ${row.billnumber}?`
              )
            ) {
              try {
                await deleteSalesInvoiceMutation({
                  variables: { id: row.id },
                });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Invoice deleted successfully.",
                    type: "success",
                  })
                );
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(
                  showMessage({
                    message: "Failed to delete invoice.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onAdd={() => navigate("/salesinvoice/addedit")}
          onShowDeleted={() => navigate("/salesinvoice/deletedentries")}
          onPrint={(row) => {
            setPrintInvoice(row);
          }}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />

        {/* Hidden printable content, positioned offscreen to keep mounted */}
        {printInvoice && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <PrintableInvoice ref={componentRef} invoice={printInvoice} />
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default SalesInvoices;
