import { useEffect, useRef, useState } from "react";
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
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";


const SalesInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { data, refetch } = useSalesInvoicesQuery();
  const { deleteSalesInvoiceMutation } = useSalesInvoiceMutations();
  const invoiceList = data?.getSalesInvoices || [];
  console.log("Fetched Sales Invoices:", JSON.stringify(invoiceList));
  const isLoading = useAppSelector((state) => state.loader.isLoading);

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
    { label: "Created By", key: "createdby_name" },
    { label: "Status", key: "status" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const tableData = invoiceList.map((invoice: any, index: number) => {
    const totalqty = invoice.productservice.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...invoice,
      seqNo: index + 1,
      partyacc: `${invoice.partyacc?.accountname ?? "N/A"} - ${invoice.partyacc?.mobile ?? "N/A"}`,
      totalitem: invoice.productservice.length,
      totalqty,
      billtype_billnumber: `INV-${invoice.billnumber}`,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      createdby_name: invoice.createdby_name || "N/A",
      status: invoice.status ? "Active" : "Inactive",
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
