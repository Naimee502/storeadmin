import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions, selectIsModuleBusinessEnabled } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesOrdersQuery,
  useSalesOrderMutations,
} from "../../graphql/hooks/salesorder";
import { formatDateDMY } from "../../utils/helper";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { shareElementAsPdfOnWhatsApp } from "../../utils/sharepdf";
import { stateOptions } from "../../utils/constants";

// Party's `state` is stored as a slug (e.g. "gujarat") — map it to the
// proper display label for the printed document's Place of Supply.
const stateLabel = (slug?: string) =>
  stateOptions.find((s) => s.value === slug)?.label || "";

const SalesOrders = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "salesorder"));
  // When invoicing is enabled, an order is "confirmed" by converting it to an
  // invoice — so the status dropdown offers "Convert to Invoice" instead of a
  // separate "Confirmed". Order-only businesses keep plain "Confirmed".
  // Business-level check (not staff-restricted) so every role at a branch —
  // staff included — sees the same order→invoice workflow as the branch does.
  const salesInvoiceEnabled = useAppSelector(state => selectIsModuleBusinessEnabled(state, "salesinvoice"));
  const dispatch = useAppDispatch();
  
  const { data, refetch } = useSalesOrdersQuery();
  const {
    deleteSalesOrderMutation,
    cancelSalesOrderMutation,
    confirmSalesOrderMutation,
    dispatchSalesOrderMutation,
    deliverSalesOrderMutation,
    reopenSalesOrderMutation,
  } = useSalesOrderMutations();

  // Drive the order through its lifecycle from the listing dropdown.
  // Options depend on whether invoicing is enabled, and whether THIS order is
  // already converted (a converted order is never re-offered "convert").
  const optionsFor = (order: any) => {
    // "Pending" reopens a CANCELLED order. Once an order is converted — which
    // in order-only mode happens silently on Confirm — stock and the ledger
    // have been posted and there is no safe way back, so don't offer a path
    // that can only fail.
    const opts: { label: string; value: string }[] = order.isConverted
      ? []
      : [{ label: "Pending", value: "pending" }];
    if (salesInvoiceEnabled) {
      if (!order.isConverted && actions.showConvert) opts.push({ label: "Convert to Invoice", value: "convert" });
    } else {
      if (actions.showConvert) opts.push({ label: "Confirmed", value: "confirmed" });
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
  const orderList = data?.getSalesOrders || [];
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

  /* ---------- Print ----------
     Same two-step mount-then-print dance the invoice pages use: the printable
     node has to exist in the DOM before react-to-print can read it, so the row
     is put into state first and the print is fired once the ref is populated. */
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

  /* ---------- WhatsApp share ----------
     Shares the very same printable layout as a PDF, so what the party receives
     on WhatsApp is byte-for-byte what Print produces. */
  const waRef = useRef<HTMLDivElement>(null);
  const [waOrder, setWaOrder] = useState<any>(null);
  const waMeta = useRef<{ phone: string; message: string; fileName: string } | null>(null);

  const handleWhatsAppShare = (row: any) => {
    const orig = orderList.find((o: any) => o.id === row.id);
    if (!orig) return;

    // Business Settings -> Invoice Print -> "Show company name in signature"
    // governs the chat sign-off too, so the company name never leaks into a
    // message when the admin has chosen to keep it off the document.
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
    setWaOrder(row);
  };

  useEffect(() => {
    if (!waOrder || !waRef.current || !waMeta.current) return;
    const run = async () => {
      dispatch(showLoading());
      try {
        const result = await shareElementAsPdfOnWhatsApp({
          element: waRef.current!,
          ...waMeta.current!,
        });
        if (result === "downloaded") {
          dispatch(showMessage({
            message: "Order PDF downloaded — attach it in the WhatsApp chat that just opened.",
            // The message slice only types 'success' | 'error'; this is an
            // informational note, and 'success' is the truthful one of the two
            // (the PDF really was produced and downloaded).
            type: "success",
          }));
        }
      } catch (e) {
        console.error("WhatsApp PDF share error:", e);
        dispatch(showMessage({ message: "Failed to share order PDF.", type: "error" }));
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
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchOrders();
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

  const tableData = [...orderList].reverse().map((order: any, index: number) => {
    const totalqty = order.productservice.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...order,
      seqNo: index + 1,
      // Flattened for the printable document — it expects these ready-made
      // rather than digging into the partyacc object itself.
      partyname: order.partyacc?.accountname || "",
      gstin: order.partyacc?.gstnumber || "",
      placeofsupply: [order.partyacc?.city, stateLabel(order.partyacc?.state)].filter(Boolean).join(" - "),
      partyacc: `${order.partyacc?.accountname ?? "N/A"} - ${order.partyacc?.mobile ?? "N/A"}`,
      totalitem: order.productservice.length,
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
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          {...actions}
          title="Manage Sales Orders"
          columns={columns}
          data={tableData}
          showPrint={actions.showPrint}
          onPrint={(row) => setPrintOrder(row)}
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
          isLoading={isLoading}
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

        {/* Hidden copy rendered only while the WhatsApp PDF is generated. The
            explicit width matters: html2canvas rasterises at the laid-out
            width, and offscreen content would otherwise collapse. */}
        {waOrder && (
          <div style={{ position: "absolute", left: "-9999px", top: 0, width: "800px" }}>
            <PrintableInvoice
              ref={waRef}
              invoice={waOrder}
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
