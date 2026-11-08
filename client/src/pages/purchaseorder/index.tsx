import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useApolloClient } from "@apollo/client";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions, selectIsModuleBusinessEnabled } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  usePurchaseOrdersPageQuery,
  usePurchaseOrderMutations,
} from "../../graphql/hooks/purchaseorder";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { GET_PURCHASE_ORDER_PRINT } from "../../graphql/queries/purchaseorder";
import { formatDateDMY } from "../../utils/helper";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { shareBlobOnWhatsApp, copyPartyNumberForPicker } from "../../utils/sharepdf";
import { useInvoicePdf } from "../../components/invoicepdf";
import { stateOptions } from "../../utils/constants";
import { partyLabel } from "../../utils/partylabel";

// Party state is a slug; map it to the label for Place of Supply.
const stateLabel = (slug?: string) =>
  stateOptions.find((s) => s.value === slug)?.label || "";

// Columns the server can filter (Seq Number is per page, so it has none).
const SERVER_FILTER_KEYS = [
  "paymenttype", "partyacc", "totalitem", "totalqty", "billdate",
  "billtype_billnumber", "totalamount", "createdby_name", "orderStatusCell", "activeStatus",
];

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "purchaseorder"));
  // With invoicing on, confirming means "Convert to Invoice" (business-level, same for all roles).
  const purchaseInvoiceEnabled = useAppSelector(state => selectIsModuleBusinessEnabled(state, "purchaseinvoice"));
  const dispatch = useAppDispatch();

  // Lite listing query; the full order is fetched by id on Print / WhatsApp.
  const table = useServerTable("purchaseorder", SERVER_FILTER_KEYS);
  const {
    items: orderList,
    total: orderTotal,
    loading: ordersLoading,
    refetch,
  } = usePurchaseOrdersPageQuery(table.variables);
  const serverPaging = useServerPaging(table, orderTotal, ordersLoading);
  const apolloClient = useApolloClient();
  const {
    deletePurchaseOrderMutation,
    cancelPurchaseOrderMutation,
    reopenPurchaseOrderMutation,
    confirmPurchaseOrderMutation,
    receivePurchaseOrderMutation,
  } = usePurchaseOrderMutations();

  // Purchases have a single "Received" step instead of Dispatched + Delivered.
  const optionsFor = (order: any) => {
    // "Pending" only reopens a cancelled order; a converted one has posted stock and ledger.
    const opts: { label: string; value: string }[] = order.isConverted
      ? []
      : [{ label: "Pending", value: "pending" }];
    if (purchaseInvoiceEnabled) {
      if (!order.isConverted && actions.showConvert) opts.push({ label: "Convert to Invoice", value: "convert" });
    } else {
      if (actions.showConvert) opts.push({ label: "Confirmed", value: "confirmed" });
    }
    if (actions.showConvert) {
      opts.push(
        { label: "Received",  value: "received" },
        { label: "Cancelled", value: "cancelled" },
      );
    }
    return opts;
  };

  const handleStatusChange = async (row: any, status: string) => {
    try {
      if (status === "convert") {
        if (row.isConverted) { dispatch(showMessage({ message: "Order is already converted to an invoice.", type: "error" })); return; }
        navigate(`/purchaseinvoice/addedit?orderId=${row.id}`);
        return;
      }
      if (status === "confirmed")     await confirmPurchaseOrderMutation({ variables: { id: row.id } });
      else if (status === "received") await receivePurchaseOrderMutation({ variables: { id: row.id, byType: "admin" } });
      else if (status === "cancelled") {
        const reason = window.prompt(`Cancel PO-${row.billnumber}? Reason:`);
        if (reason === null) return;
        await cancelPurchaseOrderMutation({ variables: { id: row.id, reason } });
      }
      else if (status === "pending")  await reopenPurchaseOrderMutation({ variables: { id: row.id } });
      await refetch();
      dispatch(showMessage({ message: "Order status updated.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Failed to update status.", type: "error" }));
    }
  };

  const isLoading = useAppSelector((state) => state.loader.isLoading);
  const { settings } = useAppSelector((state: any) => state.adminsettings);
  const auth = useAppSelector((state) => state.auth);
  const companyName =
    auth.type === "admin"
      ? auth.admin?.companyName
      : auth.type === "branch"
        ? auth.branch?.admin?.companyName
        : auth.type === "staff"
          ? auth.staff?.admin?.companyName
          : "";

  // Print: put the row in state first, print once the ref is set.
  const componentRef = useRef<HTMLDivElement>(null);
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [readyToPrint, setReadyToPrint] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "Purchase Order",
    onAfterPrint: () => {
      setPrintOrder(null);
      setReadyToPrint(false);
    },
    onPrintError: (error) => console.error("Print error:", error),
  });

  useEffect(() => {
    if (printOrder) setReadyToPrint(true);
  }, [printOrder]);

  useEffect(() => {
    if (readyToPrint && componentRef.current) handlePrint?.();
  }, [readyToPrint, handlePrint]);

  // WhatsApp share: same printable layout as a PDF.
  const makeInvoicePdf = useInvoicePdf();
  const [waOrder, setWaOrder] = useState<any>(null);
  const waMeta = useRef<{ phone: string; message: string; fileName: string } | null>(null);

  const handleWhatsAppShare = async (row: any) => {
    const orig = orderList.find((o: any) => o.id === row.id);
    if (!orig) return;

    // Copy the supplier's number for WhatsApp's picker; keep the toast up long enough.
    const copiedNumber = copyPartyNumberForPicker(orig.partyacc?.mobile);
    if (copiedNumber) {
      dispatch(showMessage({
        message:
          `${copiedNumber} copied.\nIn WhatsApp\u2019s \u201cSend message to\u201d search box, press Ctrl+V to pull up this party.`,
        type: "success",
        duration: 20000,
      }));
    }

    // "Show company name in signature" setting also governs the chat sign-off.
    const showSignatureCompanyName = settings?.printShowCompanyNameInSignature !== false;
    const mobile = (orig.partyacc?.mobile || "").replace(/\D/g, "");
    const message =
      `*Purchase Order PO-${orig.billnumber}*\n` +
      `Date: ${formatDateDMY(orig.billdate)}\n` +
      `Total: ₹ ${Number(orig.totalamount).toFixed(2)}\n\n` +
      `${showSignatureCompanyName && companyName ? `— ${companyName}` : ""}`;

    waMeta.current = {
      phone: mobile,
      message,
      fileName: `Purchase-Order-PO-${orig.billnumber}.pdf`,
    };
    // The list holds only the table columns — load the full order for the PDF.
    dispatch(showLoading());
    try {
      setWaOrder(await loadPrintable(row));
    } catch (e: any) {
      console.error("Failed to load order for WhatsApp share:", e);
      waMeta.current = null;
      dispatch(showMessage({ message: e?.message || "Failed to load order.", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  useEffect(() => {
    if (!waOrder || !waMeta.current) return;
    const run = async () => {
      dispatch(showLoading());
      try {
        const blob = await makeInvoicePdf(waOrder, {
          title: "PURCHASE ORDER",
          docNoLabel: "Order No.",
        });
        const result = await shareBlobOnWhatsApp({
          blob,
          ...waMeta.current!,
        });
        if (result === "downloaded") {
          dispatch(showMessage({
            message: "Order PDF downloaded — attach it in the WhatsApp chat that just opened.",
            // Informational note; 'success' since the PDF was downloaded.
            type: "success",
          }));
        }
      } catch (e) {
        console.error("WhatsApp PDF share error:", e);
        // Show the actual failure reason.
        dispatch(showMessage({
          message: `Failed to share order PDF: ${(e as any)?.message || e}`,
          type: "error",
        }));
      } finally {
        dispatch(hideLoading());
        setWaOrder(null);
        waMeta.current = null;
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waOrder]);

  useEffect(() => {
    const fetchOrders = async () => {
      // Cached rows: refresh in the background without the full-screen loader.
      const blocking = !orderList.length;
      if (blocking) dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        if (blocking) dispatch(hideLoading());
      }
    };
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Payment Type", key: "paymenttype" },
    { label: "Party A/c", key: "partyacc" },
    { label: "Total Items", key: "totalitem" },
    { label: "Total Qty", key: "totalqty" },
    { label: "Order Date", key: "billdate" },
    { label: "Order No", key: "billtype_billnumber" },
    { label: "Total Amount", key: "totalamount" },
    { label: "Created By", key: "createdby_name" },
    { label: "Order Status", key: "orderStatusCell" },
    { label: "Status", key: "activeStatus" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const buildRow = (order: any, index: number) => {
    const totalqty = (order.productservice || []).reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...order,
      seqNo: index + 1,
      // Flattened fields for the printable document.
      partyname: order.partyacc?.accountname || "",
      gstin: order.partyacc?.gstnumber || "",
      placeofsupply: [order.partyacc?.city, stateLabel(order.partyacc?.state)].filter(Boolean).join(" - "),
      partyacc: partyLabel(order.partyacc) || "N/A",
      totalitem: (order.productservice || []).length,
      totalqty,
      billdate: formatDateDMY(order.billdate),
      billdateRaw: order.billdate,
      billtype_billnumber: `PO-${order.billnumber}`,
      paymenttype: capitalizeFirst(order.paymenttype),
      createdby_name: order.createdby_name || "N/A",
      orderStatusCell: (
        <StatusDropdown
          current={order.orderStatus || (order.cancelStatus === "cancelled" ? "cancelled" : "pending")}
          options={optionsFor(order)}
          onSelect={(v) => handleStatusChange(order, v)}
        />
      ),
      activeStatus: order.status ? "Active" : "Inactive",
      cancelStatus: order.cancelStatus,
      isConverted: order.isConverted,
    };
  };

  const tableData = orderList.map((order: any, i: number) => buildRow(order, table.offset + i));

  // Print / WhatsApp need the full order; fetch it by id.
  const loadPrintable = async (row: any) => {
    const { data: full } = await apolloClient.query({
      query: GET_PURCHASE_ORDER_PRINT,
      variables: { id: row.id },
      fetchPolicy: "network-only",
    });
    const order = full?.getPurchaseOrderById;
    if (!order) throw new Error("Order not found.");
    return buildRow(order, (row.seqNo || 1) - 1);
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          {...actions}
          title="Manage Purchase Orders"
          columns={columns}
          data={tableData}
          serverPaging={serverPaging}
          showPrint={actions.showPrint}
          onPrint={async (row) => {
            // Full order is fetched only on Print click — the listing query
            // carries just the table columns.
            dispatch(showLoading());
            try {
              setPrintOrder(await loadPrintable(row));
            } catch (e: any) {
              console.error("Failed to load order for print:", e);
              dispatch(showMessage({ message: e?.message || "Failed to load order.", type: "error" }));
            } finally {
              dispatch(hideLoading());
            }
          }}
          showWhatsApp={actions.showWhatsApp}
          onWhatsApp={handleWhatsAppShare}
          onView={(row) => navigate(`/purchaseorder/view/${row.id}`)}
          onEdit={(row) => navigate(`/purchaseorder/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete order ${row.billnumber}?`)) {
              try {
                await deletePurchaseOrderMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Order deleted successfully.", type: "success" }));
              } catch (error) {
                dispatch(showMessage({ message: "Failed to delete order.", type: "error" }));
              }
            }
          }}
          onAdd={() => navigate("/purchaseorder/addedit")}
          showConvert={false}
          onConvert={(row) => navigate(`/purchaseinvoice/addedit?orderId=${row.id}`)}
          showCancel={false}
          onShowDeleted={() => navigate("/purchaseorder/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={ordersLoading || isLoading}
        />

        {/* Hidden printable copy, parked offscreen so it stays mounted while
            react-to-print reads it. */}
        {printOrder && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <PrintableInvoice
              ref={componentRef}
              invoice={printOrder}
              title="PURCHASE ORDER"
              docNoLabel="Order No."
            />
          </div>
        )}

      </div>
    </HomeLayout>
  );
};

export default PurchaseOrders;
