import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addPurchaseInvoices } from "../../redux/slices/purchaseinvoice";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  usePurchaseInvoicesQuery,
  usePurchaseInvoiceMutations,
} from "../../graphql/hooks/purchaseinvoice";
import { usePurchaseReturnsQuery } from "../../graphql/hooks/purchasereturn";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";

const PurchaseInvoices = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "purchaseinvoice"));
  const dispatch = useAppDispatch();

  const { data, refetch } = usePurchaseInvoicesQuery();
  const { deletePurchaseInvoiceMutation } = usePurchaseInvoiceMutations();
  const invoiceList = data?.getPurchaseInvoices || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Set of source-invoice ids that already have an active Purchase Return.
  const { data: returnsData } = usePurchaseReturnsQuery();
  const returnedInvoiceIds = useMemo(() => {
    const set = new Set<string>();
    (returnsData?.getPurchaseReturns ?? []).forEach((r: any) => {
      if (r.sourceInvoiceId) set.add(String(r.sourceInvoiceId));
    });
    return set;
  }, [returnsData]);

  // Resolve company name to sign off the WhatsApp share message.
  const auth = useAppSelector((state) => state.auth);
  const companyName =
    auth.type === "admin"
      ? auth.admin?.companyName
      : auth.type === "branch"
        ? auth.branch?.admin?.companyName
        : auth.type === "staff"
          ? auth.staff?.admin?.companyName
          : "";

  const handleWhatsAppShare = (row: any) => {
    const orig = invoiceList.find((inv: any) => inv.id === row.id);
    if (!orig) return;

    const mobile = (orig.partyacc?.mobile || "").replace(/\D/g, "");
    const items = (orig.productservice || [])
      .map(
        (p: any, i: number) =>
          `${i + 1}. ${p.productserviceid?.name ?? "Item"} x ${p.qty} @ ${Number(p.rate).toFixed(2)}`
      )
      .join("\n");

    const text =
      `*Purchase Invoice INV-${orig.billnumber}*\n` +
      `Date: ${orig.billdate}\n` +
      `Vendor: ${orig.partyacc?.accountname ?? "-"}\n\n` +
      `${items}\n\n` +
      `Total: ₹ ${Number(orig.totalamount).toFixed(2)}\n\n` +
      `${companyName ? `— ${companyName}` : ""}`;

    const url = mobile
      ? `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const [readyToPrint, setReadyToPrint] = useState(false);

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

  useEffect(() => {
    if (printInvoice) {
      setReadyToPrint(true);
    }
  }, [printInvoice]);

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

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const tableData = invoiceList.map((invoice: any, index: number) => {
    const totalqty = (invoice.productservice || []).reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...invoice,
      seqNo: index + 1,
      partyacc: `${invoice.partyacc?.accountname ?? "N/A"} - ${invoice.partyacc?.mobile ?? "N/A"}`,
      totalitem: invoice.productservice?.length || 0,
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
          {...actions}
          title="Manage Purchase Invoices"
          columns={columns}
          data={tableData}
          showPrint={true}
          showWhatsApp={true}
          onWhatsApp={handleWhatsAppShare}
          showReturn={(row: any) => !returnedInvoiceIds.has(String(row.id))}
          onReturn={(row) => navigate(`/purchasereturn/addedit?fromInvoice=${row.id}`)}
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
