import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addPurchaseInvoices } from "../../redux/slices/purchaseinvoice";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  usePurchaseInvoicesQuery,
  usePurchaseInvoiceMutations,
} from "../../graphql/hooks/purchaseinvoice";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";

const PurchaseInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data, refetch } = usePurchaseInvoicesQuery();
  const { deletePurchaseInvoiceMutation } = usePurchaseInvoiceMutations();
  const invoiceList = data?.getPurchaseInvoices || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Print states and ref
  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const [readyToPrint, setReadyToPrint] = useState(false);

  // react-to-print hook
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "Purchase Invoice",
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
        if (data?.getPurchaseInvoices) {
          dispatch(addPurchaseInvoices(data.getPurchaseInvoices));
        }
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchInvoices();
  }, [dispatch, refetch]);

  // Trigger printing when printInvoice is set
  useEffect(() => {
    if (printInvoice) {
      setReadyToPrint(true);
    }
  }, [printInvoice]);

  // Call print function when ready and ref is available
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

  // ✅ Reusable Helpers
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
      billtype_billnumber: `${capitalizeFirst(String(invoice.billtype))}-${invoice.billnumber}`,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      status: invoice.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Purchase Invoices"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={true}
          showPrint={true}
          onView={(row) => navigate(`/purchaseinvoice/view/${row.id}`)}
          onEdit={(row) => navigate(`/purchaseinvoice/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to delete invoice ${row.billnumber}?`
              )
            ) {
              try {
                await deletePurchaseInvoiceMutation({
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
          onAdd={() => navigate("/purchaseinvoice/addedit")}
          onShowDeleted={() => navigate("/purchaseinvoice/deletedentries")}
          onPrint={(row) => setPrintInvoice(row)}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />

        {/* Hidden printable invoice component */}
        {printInvoice && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <PrintableInvoice ref={componentRef} invoice={printInvoice} />
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default PurchaseInvoices;
