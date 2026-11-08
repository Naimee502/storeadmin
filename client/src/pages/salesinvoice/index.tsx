import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useApolloClient } from "@apollo/client";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesInvoicesPageQuery,
  useSalesInvoiceMutations,
} from "../../graphql/hooks/salesinvoice";
import { GET_SALES_INVOICE_BALANCE, GET_SALES_INVOICE_BY_ID } from "../../graphql/queries/salesinvoice";
import { useSalesReturnsQuery } from "../../graphql/hooks/salesreturn";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { selectModuleActions } from "../../redux/slices/permissions";
import { formatDateDMY } from "../../utils/helper";
import { shareBlobOnWhatsApp, copyPartyNumberForPicker } from "../../utils/sharepdf";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { useInvoicePdf } from "../../components/invoicepdf";
import { stateOptions } from "../../utils/constants";
import { partyLabel } from "../../utils/partylabel";
import { useOfflineList } from "../../offline/listing";

// Party state is a slug; map it to its label for print.
const stateLabel = (slug?: string) =>
  stateOptions.find((s) => s.value === slug)?.label || "";

// Columns the server can filter (Seq Number is per page, so it has none).
const SERVER_FILTER_KEYS = [
  "paymenttype", "partyacc", "totalitem", "totalqty", "billdate",
  "billtype_billnumber", "totalamount", "orderedByDisplay", "deliveryDisplay", "status",
];

const SalesInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const M = "salesinvoice";
  const actions = useAppSelector(state => selectModuleActions(state, M));

  // Lite listing; the full bill is fetched on Print / WhatsApp (see loadPrintable).
  const table = useServerTable("salesinvoice", SERVER_FILTER_KEYS);
  const {
    items: invoiceList,
    total: invoiceTotal,
    loading: invoicesLoading,
    refetch,
  } = useSalesInvoicesPageQuery({ ...table.variables, includeCancelled: true });
  const serverPaging = useServerPaging(table, invoiceTotal, invoicesLoading);
  // Offline mode only: unsynced bills on page 1 and badges for queued changes.
  const offline = useOfflineList("salesinvoice", table.page);
  const {
    deleteSalesInvoiceMutation,
    cancelSalesInvoiceMutation,
    reopenSalesInvoiceMutation,
    dispatchSalesInvoiceMutation,
    deliverSalesInvoiceMutation,
  } = useSalesInvoiceMutations();

  // All bill actions, cancel included, live in one status dropdown.
  const statusOptionsFor = (invoice: any, canEdit: boolean) => {
    // Unsynced bill: only cancel / re-open can be queued.
    if (invoice.isOffline) {
      if (!canEdit) return [];
      return invoice.cancelStatus === "cancelled" ? [{ label: "Re-open", value: "reopen" }] : [{ label: "Cancel Invoice", value: "cancelled" }];
    }
    if (invoice.cancelStatus === "cancelled") {
      return canEdit ? [{ label: "Re-open", value: "reopen" }] : [];
    }
    const opts = [];
    // No going back to "dispatched" once it is delivered.
    if (invoice.deliveryStatus !== "delivered") opts.push({ label: "Dispatched", value: "dispatched" });
    opts.push({ label: "Delivered", value: "delivered" });
    if (canEdit) opts.push({ label: "Cancel Invoice", value: "cancelled" });
    return opts;
  };

  const handleDeliveryChange = async (row: any, status: string) => {
    if (status === "cancelled") return handleCancel(row);
    if (status === "reopen") return handleReopen(row);
    try {
      if (status === "dispatched") await dispatchSalesInvoiceMutation({ variables: { id: row.id } });
      else if (status === "delivered") await deliverSalesInvoiceMutation({ variables: { id: row.id, byType: "admin" } });
      await refetch();
      dispatch(showMessage({ message: "Delivery status updated.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Failed to update.", type: "error" }));
    }
  };

  const handleCancel = async (row: any) => {
    const reason = window.prompt(
      `Cancel invoice INV-${row.billnumber}?\n\n` +
        `Its stock goes back, and its journal and counter receipt are removed.\n` +
        `Reason (optional):`
    );
    if (reason === null) return; // dismissed the prompt — do nothing
    try {
      await cancelSalesInvoiceMutation({ variables: { id: row.id, reason } });
      await refetch();
      dispatch(showMessage({ message: "Invoice cancelled. Stock has been returned.", type: "success" }));
    } catch (e: any) {
      // Show the server's specific reason.
      dispatch(showMessage({ message: e?.message || "Failed to cancel invoice.", type: "error" }));
    }
  };

  const handleReopen = async (row: any) => {
    if (!window.confirm(`Re-open invoice INV-${row.billnumber}? The stock will be taken out again and the bill will post to the books.`)) return;
    try {
      await reopenSalesInvoiceMutation({ variables: { id: row.id } });
      await refetch();
      dispatch(showMessage({ message: "Invoice re-opened.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Failed to re-open invoice.", type: "error" }));
    }
  };
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Invoices with an active Sales Return, to hide the Return action (server also checks).
  const { data: returnsData } = useSalesReturnsQuery();
  const returnedInvoiceIds = useMemo(() => {
    const set = new Set<string>();
    (returnsData?.getSalesReturns ?? []).forEach((r: any) => {
      if (r.sourceInvoiceId) set.add(String(r.sourceInvoiceId));
    });
    return set;
  }, [returnsData]);

  // Company name across roles, for the WhatsApp sign-off.
  const auth = useAppSelector((state) => state.auth);
  const apolloClient = useApolloClient();
  const { settings } = useAppSelector((state: any) => state.adminsettings);
  const adminid =
    auth.type === "admin"
      ? auth.admin?.id
      : auth.type === "branch"
        ? auth.branch?.admin?.id
        : auth.type === "staff"
          ? auth.staff?.admin?.id
          : undefined;
  const companyName =
    auth.type === "admin"
      ? auth.admin?.companyName
      : auth.type === "branch"
        ? auth.branch?.admin?.companyName
        : auth.type === "staff"
          ? auth.staff?.admin?.companyName
          : "";

  // Share as PDF on WhatsApp: mount the hidden PrintableInvoice, the effect converts it.
  const makeInvoicePdf = useInvoicePdf();
  const [waInvoice, setWaInvoice] = useState<any>(null);
  const waMeta = useRef<{ phone: string; message: string; fileName: string } | null>(null);

  const handleWhatsAppShare = async (row: any) => {
    const orig = [...offline.rows, ...invoiceList].find((inv: any) => inv.id === row.id);
    if (!orig) return;

    // WhatsApp can't preselect a recipient, so copy the number and keep the toast up longer.
    const copiedNumber = copyPartyNumberForPicker(orig.partyacc?.mobile);
    if (copiedNumber) {
      dispatch(showMessage({
        message:
          `${copiedNumber} copied.\nIn WhatsApp\u2019s \u201cSend message to\u201d search box, press Ctrl+V to pull up this party.`,
        type: "success",
        duration: 20000,
      }));
    }

    // "Show company name in signature" also controls the WhatsApp sign-off.
    const showSignatureCompanyName = settings?.printShowCompanyNameInSignature !== false;
    const mobile = (orig.partyacc?.mobile || "").replace(/\D/g, "");
    const message =
      `*Invoice INV-${orig.billnumber}*\n` +
      `Date: ${formatDateDMY(orig.billdate)}\n` +
      `Thank you for your business!\n` +
      `${showSignatureCompanyName && companyName ? `— ${companyName}` : ""}`;

    waMeta.current = {
      phone: mobile,
      message,
      fileName: `Invoice-INV-${orig.billnumber}.pdf`,
    };

    // Load the full bill (and party balance if enabled) for the PDF.
    dispatch(showLoading());
    try {
      setWaInvoice(await loadPrintable(row));
    } catch (e: any) {
      console.error("Failed to load invoice for WhatsApp share:", e);
      waMeta.current = null;
      dispatch(showMessage({ message: e?.message || "Failed to load invoice.", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  useEffect(() => {
    if (!waInvoice || !waMeta.current) return;
    const run = async () => {
      dispatch(showLoading());
      try {
        const blob = await makeInvoicePdf(waInvoice);
        const result = await shareBlobOnWhatsApp({
          blob,
          ...waMeta.current!,
        });
        if (result === "downloaded") {
          dispatch(
            showMessage({
              message: "Invoice PDF downloaded — attach it in the WhatsApp chat that just opened.",
              // Only 'success' | 'error' exist; the PDF was produced, so 'success'.
              type: "success",
            })
          );
        }
      } catch (e) {
        console.error("WhatsApp PDF share error:", e);
        // Show the reason; this can fail for several unrelated causes.
        dispatch(showMessage({
          message: `Failed to share invoice PDF: ${(e as any)?.message || e}`,
          type: "error",
        }));
      } finally {
        dispatch(hideLoading());
        setWaInvoice(null);
        waMeta.current = null;
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waInvoice]);

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
      // Rows already on screen → refresh quietly, no full-screen loader.
      const blocking = invoiceList.length === 0;
      if (blocking) dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        if (blocking) dispatch(hideLoading());
      }
    };
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    { label: "Ordered By", key: "orderedByDisplay" },
    { label: "Order Status", key: "deliveryDisplay" },
    { label: "Status", key: "status" },
  ];

  // Show name with role; fall back to the role label instead of an email.
  const personLabel = (name?: string, type?: string) => {
    const role = type ? capitalizeFirst(type) : "";
    if (name && !name.includes("@")) return role ? `${name} (${role})` : name;
    return role || "—";
  };

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const buildRow = (invoice: any, index: number) => {
    const totalqty = (invoice.productservice || []).reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...invoice,
      seqNo: index + 1,
      // Party name and GSTIN only print if set on the party account.
      partyname: invoice.partyacc?.accountname || "",
      gstin: invoice.partyacc?.gstnumber || "",
      // Place of Supply = party City - State (GST jurisdiction).
      placeofsupply: [invoice.partyacc?.city, stateLabel(invoice.partyacc?.state)].filter(Boolean).join(" - "),
      partyacc: partyLabel(invoice.partyacc) || "N/A",
      totalitem: (invoice.productservice || []).length,
      totalqty,
      billdate: formatDateDMY(invoice.billdate),
      billdateRaw: invoice.billdate,
      billtype_billnumber: `INV-${invoice.billnumber}`,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      orderedByDisplay: invoice.orderedby_name
        ? personLabel(invoice.orderedby_name, invoice.orderedby_type)
        : "—",
      createdByDisplay: personLabel(invoice.createdby_name, invoice.createdby_type),
      deliveryDisplay: (
        <StatusDropdown
          // Invoice is a confirmed sale: Confirmed until dispatched/delivered; Cancelled wins.
          current={
            invoice.cancelStatus === "cancelled"
              ? "cancelled"
              : (invoice.deliveryStatus === "dispatched" || invoice.deliveryStatus === "delivered")
                ? invoice.deliveryStatus
                : "confirmed"
          }
          options={statusOptionsFor(invoice, Boolean(actions.showEdit))}
          onSelect={(v) => handleDeliveryChange(invoice, v)}
          // Lock only when nothing is left; a delivered bill can still be cancelled.
          disabled={statusOptionsFor(invoice, Boolean(actions.showEdit)).length === 0}
        />
      ),
      isCancelled: invoice.cancelStatus === "cancelled",
      // Highlight cancellation; the bill is still "Active" (not deleted).
      status: invoice.cancelStatus === "cancelled"
        ? "Cancelled"
        : invoice.status ? "Active" : "Inactive",
    };
  };

  const serverRows = invoiceList.map((inv: any, i: number) => offline.decorate(buildRow(inv, table.offset + i), "seqNo"));
  const tableData = offline.rows.length
    ? [...offline.rows.map((inv: any) => offline.decorate(buildRow(inv, -1), "seqNo")), ...serverRows]
    : serverRows;

  // Fetch the full bill (and party balance if enabled) for Print / WhatsApp.
  const loadPrintable = async (row: any) => {
    const [full, bal] = await Promise.all([
      apolloClient.query({
        query: GET_SALES_INVOICE_BY_ID,
        variables: { id: row.id, adminid },
        fetchPolicy: "network-only",
      }),
      // An unsynced bill has no server balance yet.
      settings?.printShowPartyBalance && !row.isOffline
        ? apolloClient
            .query({
              query: GET_SALES_INVOICE_BALANCE,
              variables: { id: row.id, adminid },
              fetchPolicy: "network-only",
            })
            .catch((e) => {
              console.error("Failed to fetch party balance:", e);
              return null;
            })
        : Promise.resolve(null),
    ]);
    const inv = full?.data?.getSalesInvoiceById;
    if (!inv) throw new Error("Invoice not found.");
    const printable: any = buildRow(inv, (row.seqNo || 1) - 1);
    const b = bal?.data?.getSalesInvoiceById;
    if (b) {
      printable.partyPreviousBalance = b.partyPreviousBalance;
      printable.partyCurrentBalance = b.partyCurrentBalance;
    }
    return printable;
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          title="Manage Sales Invoices"
          columns={columns}
          data={tableData}
          serverPaging={serverPaging}
          {...actions}
          onWhatsApp={handleWhatsAppShare}
          // No duplicate return, and the user needs Return permission.
          showReturn={(row: any) =>
            actions.showReturn && !returnedInvoiceIds.has(String(row.id)) && !row.isCancelled
          }
          onReturn={(row) => navigate(`/salesreturn/addedit?fromInvoice=${row.id}`)}
          onView={(row) => navigate(`/salesinvoice/view/${row.id}`)}
          onEdit={(row) => navigate(`/salesinvoice/addedit/${row.id}`)}
          // Delete-only-inside-invoice setting moves the trash icon to the edit page.
          showDelete={actions.showDelete && !settings?.deleteInvoiceFromInsideOnly}
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
          onPrint={async (row) => {
            // Full bill fetched only on Print.
            dispatch(showLoading());
            try {
              setPrintInvoice(await loadPrintable(row));
            } catch (e: any) {
              console.error("Failed to load invoice for print:", e);
              dispatch(showMessage({ message: e?.message || "Failed to load invoice.", type: "error" }));
            } finally {
              dispatch(hideLoading());
            }
          }}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={invoicesLoading || isLoading}
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
