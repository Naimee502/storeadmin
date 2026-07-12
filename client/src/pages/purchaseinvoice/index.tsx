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
import { formatDateDMY } from "../../utils/helper";
import { shareElementAsPdfOnWhatsApp } from "../../utils/sharepdf";

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

  // Share the purchase invoice on WhatsApp as a PDF (same printable
  // layout as Print). Hidden mount below; effect converts + shares.
  const waRef = useRef<HTMLDivElement>(null);
  const [waInvoice, setWaInvoice] = useState<any>(null);
  const waMeta = useRef<{ phone: string; message: string; fileName: string } | null>(null);

  const handleWhatsAppShare = (row: any) => {
    const orig = invoiceList.find((inv: any) => inv.id === row.id);
    if (!orig) return;

    const mobile = (orig.partyacc?.mobile || "").replace(/\D/g, "");
    const message =
      `*Purchase Invoice INV-${orig.billnumber}*\n` +
      `Date: ${formatDateDMY(orig.billdate)}\n` +
      `Total: ₹ ${Number(orig.totalamount).toFixed(2)}\n\n` +
      `${companyName ? `— ${companyName}` : ""}`;

    waMeta.current = {
      phone: mobile,
      message,
      fileName: `Purchase-Invoice-INV-${orig.billnumber}.pdf`,
    };
    setWaInvoice(row);
  };

  useEffect(() => {
    if (!waInvoice || !waRef.current || !waMeta.current) return;
    const run = async () => {
      dispatch(showLoading());
      try {
        const result = await shareElementAsPdfOnWhatsApp({
          element: waRef.current!,
          ...waMeta.current!,
        });
        if (result === "downloaded") {
          dispatch(
            showMessage({
              message: "Invoice PDF downloaded — attach it in the WhatsApp chat that just opened.",
              type: "info",
            })
          );
        }
      } catch (e) {
        console.error("WhatsApp PDF share error:", e);
        dispatch(showMessage({ message: "Failed to share invoice PDF.", type: "error" }));
      } finally {
        dispatch(hideLoading());
        setWaInvoice(null);
        waMeta.current = null;
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waInvoice]);

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
    { label: "Created By", key: "createdByDisplay" },
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
      billdate: formatDateDMY(invoice.billdate),
      billdateRaw: invoice.billdate,
      billtype_billnumber: `${capitalizeFirst(String(invoice.billtype))}-${invoice.billnumber}`,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      createdByDisplay: invoice.createdby_name || "N/A",
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

        {/* Hidden copy rendered only while generating the WhatsApp PDF */}
        {waInvoice && (
          <div style={{ position: "absolute", left: "-9999px", top: 0, width: "800px" }}>
            <PrintableInvoice ref={waRef} invoice={waInvoice} />
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default PurchaseInvoices;
