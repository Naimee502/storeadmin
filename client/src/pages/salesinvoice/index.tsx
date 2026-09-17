import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useApolloClient } from "@apollo/client";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addSalesInvoices } from "../../redux/slices/salesinvoice";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesInvoicesQuery,
  useSalesInvoiceMutations,
} from "../../graphql/hooks/salesinvoice";
import { GET_SALES_INVOICE_BALANCE } from "../../graphql/queries/salesinvoice";
import { useSalesReturnsQuery } from "../../graphql/hooks/salesreturn";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { selectModuleActions } from "../../redux/slices/permissions";
import { formatDateDMY } from "../../utils/helper";
import { shareBlobOnWhatsApp, copyPartyNumberForPicker } from "../../utils/sharepdf";
import { useInvoicePdf } from "../../components/invoicepdf";
import { stateOptions } from "../../utils/constants";
import { partyLabel } from "../../utils/partylabel";

// Party's `state` is stored as a slug (e.g. "gujarat") — map it to the
// proper display label (e.g. "Gujarat") for the printed invoice.
const stateLabel = (slug?: string) =>
  stateOptions.find((s) => s.value === slug)?.label || "";


const SalesInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const M = "salesinvoice";
  const actions = useAppSelector(state => selectModuleActions(state, M));
  
  const { data, refetch } = useSalesInvoicesQuery(undefined, { includeCancelled: true });
  const {
    deleteSalesInvoiceMutation,
    cancelSalesInvoiceMutation,
    reopenSalesInvoiceMutation,
    dispatchSalesInvoiceMutation,
    deliverSalesInvoiceMutation,
  } = useSalesInvoiceMutations();

  // Everything that can happen to a bill from the list sits in one dropdown:
  // where it is in delivery, and whether it stands at all. Cancelling is not a
  // separate little icon — it is a state this bill is in, so it belongs on the
  // same control that shows the state.
  const statusOptionsFor = (invoice: any, canEdit: boolean) => {
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
      // The server refuses with a specific reason (a return exists, a payment is
      // allocated) — show that, never a generic failure.
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
  const invoiceList = data?.getSalesInvoices || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Build a Set of source-invoice ids that already have an active Sales
  // Return. Used to hide the per-row "Return" action so the user cannot
  // create a duplicate return against the same invoice. (Server still
  // validates per-line quantities as a safety net.)
  const { data: returnsData } = useSalesReturnsQuery();
  const returnedInvoiceIds = useMemo(() => {
    const set = new Set<string>();
    (returnsData?.getSalesReturns ?? []).forEach((r: any) => {
      if (r.sourceInvoiceId) set.add(String(r.sourceInvoiceId));
    });
    return set;
  }, [returnsData]);

  // Resolve the company name across role types so the WhatsApp share
  // signs the message off as the company, not the branch.
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

  // Share the invoice on WhatsApp as a PDF (generated from the same
  // printable layout used by Print). The hidden PrintableInvoice is
  // mounted first; the effect below converts it to PDF and shares it.
  const makeInvoicePdf = useInvoicePdf();
  const [waInvoice, setWaInvoice] = useState<any>(null);
  const waMeta = useRef<{ phone: string; message: string; fileName: string } | null>(null);

  const handleWhatsAppShare = async (row: any) => {
    const orig = invoiceList.find((inv: any) => inv.id === row.id);
    if (!orig) return;

    // Nothing a browser can do names the recipient for WhatsApp — the share
    // sheet carries the file and nothing else, so its "Send message to" list
    // always follows. The number goes on the clipboard so that list becomes
    // a paste instead of a search, and the message below says so, because a
    // clipboard nobody was told about helps nobody. It is held on screen far
    // longer than a normal toast: by the time WhatsApp's picker is actually
    // open, three seconds are long gone.
    const copiedNumber = copyPartyNumberForPicker(orig.partyacc?.mobile);
    if (copiedNumber) {
      dispatch(showMessage({
        message:
          `${copiedNumber} copied.\nIn WhatsApp\u2019s \u201cSend message to\u201d search box, press Ctrl+V to pull up this party.`,
        type: "success",
        duration: 20000,
      }));
    }

    // Business Settings → Invoice Print → "Show company name in signature"
    // also governs the WhatsApp message's sign-off — when disabled, the
    // company name should not leak into the chat message either.
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

    // Party's Previous/Current Balance (Business Settings → Invoice Print)
    // — same lazy fetch used for Print, so the shared PDF matches what's
    // shown on-screen instead of omitting the balance rows.
    if (!settings?.printShowPartyBalance) {
      setWaInvoice(row);
      return;
    }
    dispatch(showLoading());
    try {
      const { data } = await apolloClient.query({
        query: GET_SALES_INVOICE_BALANCE,
        variables: { id: row.id, adminid },
        fetchPolicy: "network-only",
      });
      const bal = data?.getSalesInvoiceById;
      setWaInvoice({
        ...row,
        partyPreviousBalance: bal?.partyPreviousBalance,
        partyCurrentBalance: bal?.partyCurrentBalance,
      });
    } catch (e) {
      console.error("Failed to fetch party balance for WhatsApp share:", e);
      setWaInvoice(row);
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
              // The message slice only types 'success' | 'error'; this is an
              // informational note, and 'success' is the truthful one of the two
              // (the PDF really was produced and downloaded).
              type: "success",
            })
          );
        }
      } catch (e) {
        console.error("WhatsApp PDF share error:", e);
        // The reason is spelled out rather than swallowed: this path can fail
        // for several unrelated causes (the PDF module not loading, bad data
        // on the document), and "it failed" leaves nobody anything to act on.
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
    { label: "Ordered By", key: "orderedByDisplay" },
    { label: "Order Status", key: "deliveryDisplay" },
    { label: "Status", key: "status" },
  ];

  // Show the person's NAME (with role); if only an email is stored, fall back
  // to the role label instead of an ugly email.
  const personLabel = (name?: string, type?: string) => {
    const role = type ? capitalizeFirst(type) : "";
    if (name && !name.includes("@")) return role ? `${name} (${role})` : name;
    return role || "—";
  };

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const tableData = [...invoiceList].reverse().map((invoice: any, index: number) => {
    const totalqty = invoice.productservice.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...invoice,
      seqNo: index + 1,
      // Kept for the printable invoice — Party name & GSTIN come from the
      // Party Account record and are only shown on print if actually set
      // there (no static/default GSTIN).
      partyname: invoice.partyacc?.accountname || "",
      gstin: invoice.partyacc?.gstnumber || "",
      // Place of Supply on the printed bill = the party's City - State
      // (GST jurisdiction), not the street address.
      placeofsupply: [invoice.partyacc?.city, stateLabel(invoice.partyacc?.state)].filter(Boolean).join(" - "),
      partyacc: partyLabel(invoice.partyacc) || "N/A",
      totalitem: invoice.productservice.length,
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
          // An invoice is already a CONFIRMED sale; its delivery lifecycle is
          // confirmed → dispatched → delivered. So show "Confirmed" until it's
          // actually dispatched/delivered (instead of a bare "Pending").
          // A cancelled bill outranks all of that — it was never delivered to
          // anyone in any meaningful sense.
          current={
            invoice.cancelStatus === "cancelled"
              ? "cancelled"
              : (invoice.deliveryStatus === "dispatched" || invoice.deliveryStatus === "delivered")
                ? invoice.deliveryStatus
                : "confirmed"
          }
          options={statusOptionsFor(invoice, Boolean(actions.showEdit))}
          onSelect={(v) => handleDeliveryChange(invoice, v)}
          // Locked only when there is nothing left to choose — a delivered bill
          // can still be cancelled, so it must not be frozen outright.
          disabled={statusOptionsFor(invoice, Boolean(actions.showEdit)).length === 0}
        />
      ),
      isCancelled: invoice.cancelStatus === "cancelled",
      // A cancelled bill still says "Active" in the old sense — it has not been
      // deleted — so the cancellation has to be what the eye lands on.
      status: invoice.cancelStatus === "cancelled"
        ? "Cancelled"
        : invoice.status ? "Active" : "Inactive",
    };
  });


  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          title="Manage Sales Invoices"
          columns={columns}
          data={tableData}
          {...actions}
          onWhatsApp={handleWhatsAppShare}
          // Combine the "no duplicate return" rule with the user's
          // permission to perform a return at all.
          showReturn={(row: any) =>
            actions.showReturn && !returnedInvoiceIds.has(String(row.id)) && !row.isCancelled
          }
          onReturn={(row) => navigate(`/salesreturn/addedit?fromInvoice=${row.id}`)}
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
          onPrint={async (row) => {
            // Party's Previous/Current Balance (Business Settings → Invoice
            // Print) is expensive to compute, so it's fetched only on Print
            // click, not baked into the list query.
            if (!settings?.printShowPartyBalance) {
              setPrintInvoice(row);
              return;
            }
            dispatch(showLoading());
            try {
              const { data } = await apolloClient.query({
                query: GET_SALES_INVOICE_BALANCE,
                variables: { id: row.id, adminid },
                fetchPolicy: "network-only",
              });
              const bal = data?.getSalesInvoiceById;
              setPrintInvoice({
                ...row,
                partyPreviousBalance: bal?.partyPreviousBalance,
                partyCurrentBalance: bal?.partyCurrentBalance,
              });
            } catch (e) {
              console.error("Failed to fetch party balance for print:", e);
              setPrintInvoice(row);
            } finally {
              dispatch(hideLoading());
            }
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
