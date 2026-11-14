import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useSalesOrderMutations, useSalesOrdersListQuery } from "../../graphql/hooks/salesorder";
import { useStaffQuery } from "../../graphql/hooks/staffaccounts";
import { partyLabel } from "../../utils/partylabel";
import { formatDateDMY } from "../../utils/helper";

const btn = "inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primary = "inline-flex h-8 items-center rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Shop-side delivery queue: new orders, ready to send, and out for delivery. */
const DeliveryBoard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "salesorder"));
  const challanOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "deliverychallan") && selectModuleActions(s, "deliverychallan").showAdd);
  const pending = useSalesOrdersListQuery({ deliveryStatus: "pending", includeConverted: true });
  const outNow = useSalesOrdersListQuery({ deliveryStatus: "dispatched", includeConverted: true });
  const { data: staffData } = useStaffQuery();
  const { confirmSalesOrderMutation, dispatchSalesOrderMutation, deliverSalesOrderMutation } = useSalesOrderMutations();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const riders = useMemo(
    () => (staffData?.getStaffAccounts || []).filter((s: any) => String(s.role || "").toLowerCase() === "deliveryboy" && s.status !== false),
    [staffData]
  );
  const riderName = (id?: string) => riders.find((r: any) => r.id === id)?.name || "-";
  const live = (o: any) => o.status !== false && o.cancelStatus !== "cancelled";
  const pendingRows = (pending.data?.getSalesOrders || []).filter(live);
  const columns = [
    { key: "new", title: "New Orders", rows: pendingRows.filter((o: any) => o.orderStatus === "pending") },
    { key: "ready", title: "Ready to Send", rows: pendingRows.filter((o: any) => o.orderStatus !== "pending") },
    { key: "out", title: "Out for Delivery", rows: (outNow.data?.getSalesOrders || []).filter(live) },
  ];

  const run = async (id: string, job: () => Promise<any>, done: string) => {
    setBusy(id);
    try {
      await job();
      await Promise.all([pending.refetch(), outNow.refetch()]);
      dispatch(showMessage({ message: done, type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not update the order.", type: "error" }));
    } finally {
      setBusy("");
    }
  };

  const card = (o: any, col: string) => (
    <div key={o.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-[13px]">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(`/salesorder/addedit/${o.id}`)} className="font-semibold text-indigo-700 hover:underline">SO-{o.billnumber}</button>
        <span className="text-slate-500">{formatDateDMY(o.billdate)}</span>
      </div>
      <div className="text-slate-900">{partyLabel(o.partyacc)}</div>
      <div className="text-slate-600">{(o.productservice || []).length} item(s) · ₹{money(o.totalamount)}</div>
      {col === "new" && actions.showEdit && (
        <button type="button" className={primary} disabled={busy === o.id}
          onClick={() => run(o.id, () => confirmSalesOrderMutation({ variables: { id: o.id } }), "Order confirmed.")}>Confirm Order</button>
      )}
      {col === "ready" && actions.showEdit && (challanOn ? (
        <button type="button" className={primary} onClick={() => navigate(o.invoiceid ? `/deliverychallan/addedit?from=invoice&id=${o.invoiceid}` : `/deliverychallan/addedit?from=order&id=${o.id}`)}>
          Make Delivery Challan
        </button>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField label="Delivery Boy" name={`rider-${o.id}`} type="select" searchable value={pick[o.id] ?? o.deliveryboyid ?? ""}
              options={riders.map((r: any) => ({ value: r.id, label: r.name }))} onChange={(e: any) => setPick((p) => ({ ...p, [o.id]: e.target.value }))} />
          </div>
          <button type="button" className={primary} disabled={busy === o.id || !(pick[o.id] || o.deliveryboyid)}
            onClick={() => run(o.id, () => dispatchSalesOrderMutation({ variables: { id: o.id, deliveryboyid: pick[o.id] || o.deliveryboyid } }), "Order sent out.")}>Send</button>
        </div>
      ))}
      {col === "out" && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-600">With {riderName(o.deliveryboyid)}</span>
          {actions.showEdit && (
            <button type="button" className={btn} disabled={busy === o.id}
              onClick={() => run(o.id, () => deliverSalesOrderMutation({ variables: { id: o.id, byType: "admin" } }), "Marked delivered.")}>Mark Delivered</button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <HomeLayout>
      <div className="w-full space-y-3 px-2 pt-4 pb-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-slate-900">Delivery Board</h1>
          <button type="button" className={btn} onClick={() => Promise.all([pending.refetch(), outNow.refetch()])}>Refresh</button>
        </div>
        {!riders.length && !challanOn && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
            Add a staff member with type Delivery Boy to send orders out from here.
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {columns.map((c) => (
            <div key={c.key} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center justify-between px-1 text-[13px] font-semibold text-slate-900">
                {c.title}<span className="rounded bg-white px-2 text-slate-600">{c.rows.length}</span>
              </div>
              {c.rows.length ? c.rows.map((o: any) => card(o, c.key)) : <div className="px-1 py-4 text-center text-[12px] text-slate-500">Nothing here.</div>}
            </div>
          ))}
        </div>
      </div>
    </HomeLayout>
  );
};

export default DeliveryBoard;
