import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions, selectIsModuleBusinessEnabled } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesOrdersPageQuery,
  useSalesOrderMutations,
} from "../../graphql/hooks/salesorder";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { GET_SALES_ORDER_PRINT } from "../../graphql/queries/salesorder";
import { formatDateDMY } from "../../utils/helper";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { shareBlobOnWhatsApp, copyPartyNumberForPicker } from "../../utils/sharepdf";
import { useInvoicePdf } from "../../components/invoicepdf";
import { stateOptions } from "../../utils/constants";
import { partyLabel } from "../../utils/partylabel";
import { useOfflineList } from "../../offline/listing";

// Party state is a slug; map it to the label for Place of Supply.
const stateLabel = (slug?: string) =>
  stateOptions.find((s) => s.value === slug)?.label || "";

// Columns the server can filter (Seq Number is per page, so it has none).
const SERVER_FILTER_KEYS = [
  "paymenttype", "partyacc", "totalitem", "totalqty", "billdate",
  "billtype_billnumber", "totalamount", "orderedByDisplay", "orderStatusCell", "activeStatus",
];

const SalesOrders = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "salesorder"));
  // With invoicing on, confirming means "Convert to Invoice" (business-level, same for all roles).
  const salesInvoiceEnabled = useAppSelector(state => selectIsModuleBusinessEnabled(state, "salesinvoice"));
  // Delivery Challans on: dispatch is done by making the challan, which then marks the order.
  const challanOn = useAppSelector(state => selectIsModuleBusinessEnabled(state, "deliverychallan") && selectModuleActions(state, "deliverychallan").showAdd);
  const dispatch = useAppDispatch();

  const apolloClient = useApolloClient();

  // Lite listing query; the full order is fetched by id on Print / WhatsApp.
  const table = useServerTable("salesorder", SERVER_FILTER_KEYS);
  const {
    items: orderList,
    total: orderTotal,
    loading: ordersLoading,
    refetch,
  } = useSalesOrdersPageQuery(table.variables);
  const serverPaging = useServerPaging(table, orderTotal, ordersLoading);
  // Offline mode only: unsynced orders on page 1 and badges for queued changes.
  const offline = useOfflineList("salesorder", table.page);
  const {
    deleteSalesOrderMutation,
    cancelSalesOrderMutation,
    confirmSalesOrderMutation,
    dispatchSalesOrderMutation,
    deliverSalesOrderMutation,
    reopenSalesOrderMutation,
  } = useSalesOrderMutations();

  // Status options depend on invoicing and whether this order is already converted.
  const optionsFor = (order: any) => {
    // Unsynced order: only convert, cancel and re-open can be queued.
    if (order.isOffline) {
      if (!actions.showConvert) return [];
      if (order.cancelStatus === "cancelled") return [{ label: "Pending", value: "pending" }];
      const opts: { label: string; value: string }[] = [];
      if (salesInvoiceEnabled) opts.push({ label: "Convert to Invoice", value: "convert" });
      opts.push({ label: "Cancelled", value: "cancelled" });
      return opts;
    }
    // "Pending" only reopens a cancelled order; a converted one has posted stock and ledger.
    const opts: { label: string; value: string }[] = order.isConverted
      ? []
      : [{ label: "Pending", value: "pending" }];
    if (salesInvoiceEnabled) {
      if (!order.isConverted && actions.showConvert) opts.push({ label: "Convert to Invoice", value: "convert" });
    } else {
      // Invoicing off: only Pending, Confirmed and Cancelled; dispatch and delivery are not used.
      if (actions.showConvert) opts.push({ label: "Confirmed", value: "confirmed" }, { label: "Cancelled", value: "cancelled" });
      return opts;
    }
    if (actions.showConvert) {
      opts.push(
        { label: "Dispatched", value: "dispatched" },
        { label: "Delivered",  value: "delivered" },
        { label: "Cancelled",  value: "cancelled" },
      );
    }
    return opts;
  };
  const handleStatusChange = async (row: any, status: string) => {
    try {
      if (status === "convert") {
        if (row.isConverted) { dispatch(showMessage({ message: "Order is already converted to an invoice.", type: "error" })); return; }
        navigate(`/salesinvoice/addedit?orderId=${row.id}`);
        return;
      }
      if (status === "dispatched" && challanOn) {
        // Already billed: the challan goes against the invoice, which took the stock.
        navigate(row.invoiceid ? `/deliverychallan/addedit?from=invoice&id=${row.invoiceid}` : `/deliverychallan/addedit?from=order&id=${row.id}`);
        return;
      }
      if (status === "confirmed")       await confirmSalesOrderMutation({ variables: { id: row.id } });
      else if (status === "dispatched") await dispatchSalesOrderMutation({ variables: { id: row.id } });
      else if (status === "delivered")  await deliverSalesOrderMutation({ variables: { id: row.id, byType: "admin" } });
      else if (status === "cancelled") {
        const reason = window.prompt(`Cancel SO-${row.billnumber}? Reason:`);
        if (reason === null) return;
        await cancelSalesOrderMutation({ variables: { id: row.id, reason } });
      }
      else if (status === "pending")    await reopenSalesOrderMutation({ variables: { id: row.id } });
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
    documentTitle: "Sales Order",
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
    const orig = [...offline.rows, ...orderList].find((o: any) => o.id === row.id);
    if (!orig) return;

    // Copy the party's number for WhatsApp's picker; keep the toast up long enough.
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
      `*Sales Order SO-${orig.billnumber}*\n` +
      `Date: ${formatDateDMY(orig.billdate)}\n` +
      `Total: ₹ ${Number(orig.totalamount).toFixed(2)}\n\n` +
      `${showSignatureCompanyName && companyName ? `— ${companyName}` : ""}`;

    waMeta.current = {
      phone: mobile,
      message,
      fileName: `Sales-Order-SO-${orig.billnumber}.pdf`,
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
          title: "SALES ORDER",
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
    { label: "Ordered By", key: "orderedByDisplay" },
    { label: "Order Status", key: "orderStatusCell" },
    { label: "Status", key: "activeStatus" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  // Show NAME (with role); if only an email is stored, fall back to the role.
  const personLabel = (name?: string, type?: string) => {
    const role = type ? capitalizeFirst(type) : "";
    if (name && !name.includes("@")) return role ? `${name} (${role})` : name;
    return role || "—";
  };

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
      partystate: order.partyacc?.state || "",
      partyacc: partyLabel(order.partyacc) || "N/A",
      totalitem: (order.productservice || []).length,
      totalqty,
      billdate: formatDateDMY(order.billdate),
      billdateRaw: order.billdate,
      billtype_billnumber: `SO-${order.billnumber}`,
      paymenttype: capitalizeFirst(order.paymenttype),
      orderedByDisplay: personLabel(order.createdby_name, order.createdby_type),
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

  const serverRows = orderList.map((order: any, i: number) => offline.decorate(buildRow(order, table.offset + i), "seqNo"));
  const tableData = offline.rows.length
    ? [...offline.rows.map((order: any) => offline.decorate(buildRow(order, -1), "seqNo")), ...serverRows]
    : serverRows;

  // Print / WhatsApp need the full order; fetch it by id.
  const loadPrintable = async (row: any) => {
    const { data: full } = await apolloClient.query({
      query: GET_SALES_ORDER_PRINT,
      variables: { id: row.id },
      fetchPolicy: "network-only",
    });
    const order = full?.getSalesOrderById;
    if (!order) throw new Error("Order not found.");
    return buildRow(order, (row.seqNo || 1) - 1);
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          {...actions}
          title="Manage Sales Orders"
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
          onView={(row) => navigate(`/salesorder/view/${row.id}`)}
          onEdit={(row) => navigate(`/salesorder/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete order ${row.billnumber}?`)) {
              try {
                await deleteSalesOrderMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Order deleted successfully.", type: "success" }));
              } catch (error) {
                dispatch(showMessage({ message: "Failed to delete order.", type: "error" }));
              }
            }
          }}
          onAdd={() => navigate("/salesorder/addedit")}
          showConvert={false}
          onConvert={(row) => navigate(`/salesinvoice/addedit?orderId=${row.id}`)}
          showCancel={false}
          onShowDeleted={() => navigate("/salesorder/deletedentries")}
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
              title="SALES ORDER"
              docNoLabel="Order No."
            />
          </div>
        )}

      </div>
    </HomeLayout>
  );
};

export default SalesOrders;
