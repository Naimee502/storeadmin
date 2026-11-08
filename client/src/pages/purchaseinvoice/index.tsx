import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useApolloClient } from "@apollo/client";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  usePurchaseInvoicesPageQuery,
  usePurchaseInvoiceMutations,
} from "../../graphql/hooks/purchaseinvoice";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { GET_PURCHASE_INVOICE_BALANCE, GET_PURCHASE_INVOICE_BY_ID } from "../../graphql/queries/purchaseinvoice";
import { usePurchaseReturnsListQuery } from "../../graphql/hooks/purchasereturn";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { formatDateDMY } from "../../utils/helper";
import { shareBlobOnWhatsApp, copyPartyNumberForPicker } from "../../utils/sharepdf";
import { useInvoicePdf } from "../../components/invoicepdf";
import { stateOptions } from "../../utils/constants";
import { partyLabel } from "../../utils/partylabel";

// Party state is a slug; map it to its label for print.
const stateLabel = (slug?: string) =>
  stateOptions.find((s) => s.value === slug)?.label || "";

// Columns the server can filter (Seq Number is per page, so it has none).
const SERVER_FILTER_KEYS = [
  "paymenttype", "partyacc", "totalitem", "totalqty", "billdate",
  "billtype_billnumber", "totalamount", "createdByDisplay", "status",
];

const PurchaseInvoices = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "purchaseinvoice"));
  const dispatch = useAppDispatch();

  // Lite listing; the full bill is fetched on Print / WhatsApp (see loadPrintable).
  const table = useServerTable("purchaseinvoice", SERVER_FILTER_KEYS);
  const offline = useOfflineList("purchaseinvoice", table.page);
  const {
    items: invoiceList,
    total: invoiceTotal,
    loading: invoicesLoading,
    refetch,
  } = usePurchaseInvoicesPageQuery({ ...table.variables, includeCancelled: true });
  const serverPaging = useServerPaging(table, invoiceTotal, invoicesLoading);
  const {
    deletePurchaseInvoiceMutation,
    cancelPurchaseInvoiceMutation,
    reopenPurchaseInvoiceMutation,
  } = usePurchaseInvoiceMutations();
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Set of source-invoice ids that already have an active Purchase Return.
  const { data: returnsData } = usePurchaseReturnsListQuery();
  const returnedInvoiceIds = useMemo(() => {
    const set = new Set<string>();
    (returnsData?.getPurchaseReturns ?? []).forEach((r: any) => {
      if (r.sourceInvoiceId) set.add(String(r.sourceInvoiceId));
    });
    return set;
  }, [returnsData]);

  // Resolve company name to sign off the WhatsApp share message.
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

  // Share as PDF on WhatsApp via the hidden printable.
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
      // Rows already cached: refresh quietly without the full-screen loader.
      const blocking = !invoiceList.length;
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

  const buildRow = (invoice: any, index: number) => {
    const totalqty = (invoice.productservice || []).reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...invoice,
      seqNo: index + 1,
      // Party name/GSTIN print only if set; Place of Supply = City - State.
      partyname: invoice.partyacc?.accountname || "",
      gstin: invoice.partyacc?.gstnumber || "",
      placeofsupply: [invoice.partyacc?.city, stateLabel(invoice.partyacc?.state)].filter(Boolean).join(" - "),
      partyacc: partyLabel(invoice.partyacc) || "N/A",
      totalitem: invoice.productservice?.length || 0,
      totalqty,
      billdate: formatDateDMY(invoice.billdate),
      billdateRaw: invoice.billdate,
      // "INV-000001" style, same as Sales Invoice.
      billtype_billnumber: `INV-${invoice.billnumber}`,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      createdByDisplay: invoice.createdby_name || "N/A",
      isCancelled: invoice.cancelStatus === "cancelled",
      // Highlight cancellation; the bill is still "Active" (not deleted).
      status: invoice.cancelStatus === "cancelled"
        ? "Cancelled"
        : invoice.status ? "Active" : "Inactive",
    };
  };

  const tableData = [
    ...offline.rows.map((r: any) => offline.decorate(buildRow(r, -1), "seqNo")),
    ...invoiceList.map((r: any, i: number) => offline.decorate(buildRow(r, table.offset + i), "seqNo")),
  ];

  // Fetch the full bill (and party balance if enabled) for Print / WhatsApp.
  const loadPrintable = async (row: any) => {
    const [full, bal] = await Promise.all([
      apolloClient.query({
        query: GET_PURCHASE_INVOICE_BY_ID,
        variables: { id: row.id, adminid },
        fetchPolicy: "network-only",
      }),
      settings?.printShowPartyBalance
        ? apolloClient
            .query({
              query: GET_PURCHASE_INVOICE_BALANCE,
              variables: { id: row.id, adminid },
              fetchPolicy: "network-only",
            })
            .catch((e) => {
              console.error("Failed to fetch party balance:", e);
              return null;
            })
        : Promise.resolve(null),
    ]);
    const inv = full?.data?.getPurchaseInvoiceById;
    if (!inv) throw new Error("Invoice not found.");
    const printable: any = buildRow(inv, (row.seqNo || 1) - 1);
    const b = bal?.data?.getPurchaseInvoiceById;
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
          {...actions}
          title="Manage Purchase Invoices"
          columns={columns}
          data={tableData}
          serverPaging={serverPaging}
          onWhatsApp={handleWhatsAppShare}
          // No duplicate return plus Return permission; Print/WhatsApp come from actions.
          showReturn={(row: any) =>
            actions.showReturn && !returnedInvoiceIds.has(String(row.id)) && !row.isCancelled
          }
          showCancel={(row: any) => !row.isCancelled}
          showReopen={(row: any) => Boolean(row.isCancelled)}
          cancelTitle="Cancel Invoice"
          onCancel={async (row: any) => {
            const reason = window.prompt(
              `Cancel purchase invoice ${row.billtype_billnumber}?\n\n` +
                `Its stock goes back out, and its journal and counter payment are removed.\n` +
                `Reason (optional):`
            );
            if (reason === null) return;
            try {
              await cancelPurchaseInvoiceMutation({ variables: { id: row.id, reason } });
              await refetch();
              dispatch(showMessage({ message: "Purchase invoice cancelled. Stock has been reversed.", type: "success" }));
            } catch (e: any) {
              // Show the server's specific reason.
              dispatch(showMessage({ message: e?.message || "Failed to cancel invoice.", type: "error" }));
            }
          }}
          onReopen={async (row: any) => {
            if (!window.confirm(`Re-open purchase invoice ${row.billtype_billnumber}? The stock comes back in and the bill posts to the books again.`)) return;
            try {
              await reopenPurchaseInvoiceMutation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Purchase invoice re-opened.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to re-open invoice.", type: "error" }));
            }
          }}
          onReturn={(row) => navigate(`/purchasereturn/addedit?fromInvoice=${row.id}`)}
          onView={(row) => navigate(`/purchaseinvoice/view/${row.id}`)}
          onEdit={(row) => navigate(`/purchaseinvoice/addedit/${row.id}`)}
          // Delete-only-inside-invoice setting moves the trash icon to the edit page.
          showDelete={actions.showDelete && !settings?.deleteInvoiceFromInsideOnly}
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
