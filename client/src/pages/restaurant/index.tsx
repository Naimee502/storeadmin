import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router";
import { ArrowRightLeft, ChefHat, Pencil, Printer, Receipt, Trash2, X } from "lucide-react";
import HomeLayout from "../../layouts/home";
import Modal from "../../components/modal";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import ServiceLines, { toInvoiceProducts, type SvcLine } from "../../components/servicelines";
import { ShortcutButton } from "../followups";
import { useCompany } from "../deliverychallan";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useProductServicesPickerQuery } from "../../graphql/hooks/products";
import { esc, printHtml } from "../../utils/billprint";
import {
  CANCEL_TABLE_ORDER, CANCEL_TABLE_ORDER_LINE, DELETE_DINING_TABLE, GET_DINING_TABLES, GET_OPEN_TABLE_ORDERS,
  MOVE_TABLE_ORDER, OPEN_TABLE_ORDER, SAVE_DINING_TABLE, SAVE_TABLE_ORDER,
} from "../../graphql/queries/restaurant";

const num = (v: any) => Number(v) || 0;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const money = (n: number) => num(n).toFixed(2);
const left = (l: any) => r3(num(l.qty) - num(l.billedqty));
const since = (iso?: string) => {
  const m = iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0;
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");

/** Kitchen slip of one KOT (80 mm). */
function printKot(order: any, kotno: number, company: any) {
  const lines = order.lines.filter((l: any) => l.kotno === kotno && !l.cancelled);
  const rows = lines.map((l: any) => `<tr><td class="q">${esc(l.qty)}</td><td>${esc(l.name)}${l.note ? `<div class="n">${esc(l.note)}</div>` : ""}</td></tr>`).join("");
  printHtml(`<!DOCTYPE html><html><head><title>KOT ${kotno}</title><style>
    @page{size:80mm auto;margin:3mm}body{font-family:Arial,sans-serif;font-size:13px;margin:0;width:72mm}
    h1{font-size:16px;text-align:center;margin:0 0 4px}.c{text-align:center;font-size:12px}.row{display:flex;justify-content:space-between;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:4px}td{padding:3px 0;vertical-align:top;border-bottom:1px dashed #999}
    .q{width:12mm;font-weight:bold;font-size:14px}.n{font-size:11px;font-style:italic}
  </style></head><body>
    <div class="c">${esc(company?.companyName || company?.name || "")}</div><h1>KOT ${kotno}</h1>
    <div class="row"><b>Table: ${esc(order.tablename)}</b><span>${esc(timeOf(lines[0]?.kotAt) || timeOf(new Date().toISOString()))}</span></div>
    <div class="row"><span>${order.covers ? `Guests: ${esc(order.covers)}` : ""}</span><span>${order.waitername ? `Waiter: ${esc(order.waitername)}` : ""}</span></div>
    <table>${rows}</table></body></html>`);
}

/** Add / edit a table. */
function TableForm({ table, branchid, onClose }: { table: any; branchid?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [f, setF] = useState({ name: table?.name || "", area: table?.area || "", seats: table?.seats ?? "", sortorder: table?.sortorder ?? "" });
  const [save, { loading }] = useMutation(SAVE_DINING_TABLE, { refetchQueries: ["GetDiningTables"] });
  const submit = async () => {
    try {
      await save({ variables: { id: table?.id, input: { name: f.name, area: f.area || null, seats: f.seats === "" ? null : num(f.seats),
        sortorder: f.sortorder === "" ? null : num(f.sortorder), ...(table?.id ? {} : { branchid: branchid || null }) } } });
      dispatch(showMessage({ message: "Table saved.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save the table.", type: "error" }));
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Table Name" name="name" value={f.name} placeholder="T1" onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <FormField label="Area" name="area" value={f.area} placeholder="AC Hall, Garden…" onChange={(e: any) => setF({ ...f, area: e.target.value })} />
        <FormField label="Seats" name="seats" type="number" value={f.seats} onChange={(e: any) => setF({ ...f, seats: e.target.value })} />
        <FormField label="Sort Order" name="sortorder" type="number" value={f.sortorder} onChange={(e: any) => setF({ ...f, sortorder: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading || !f.name.trim()}>Save Table</Button>
      </div>
    </div>
  );
}

/** Split bill: how much of each item goes on this invoice. */
function BillDialog({ order, onClose, onBill }: { order: any; onClose: () => void; onBill: (lines: { id: string; qty: number }[]) => void }) {
  const open = order.lines.filter((l: any) => !l.cancelled && left(l) > 0);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(open.map((l: any) => [l.id, String(left(l))])));
  const [parts, setParts] = useState("2");
  const total = open.reduce((s: number, l: any) => s + num(qty[l.id]) * num(l.rate), 0);
  const chosen = open.map((l: any) => ({ id: l.id, qty: r3(Math.min(num(qty[l.id]), left(l))) })).filter((x: any) => x.qty > 0);
  return (
    <div className="space-y-3 text-[13px]">
      <p className="text-[12px] text-slate-500">Bill everything, or lower the quantities to split the bill. The rest stays on the table for the next bill.</p>
      <table className="w-full">
        <thead><tr className="text-left text-[12px] text-slate-500"><th className="py-1">Item</th><th className="py-1 text-right">Left</th><th className="w-24 py-1 text-right">This Bill</th><th className="w-24 py-1 text-right">Amount</th></tr></thead>
        <tbody>
          {open.map((l: any) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="py-1.5">{l.name}</td>
              <td className="py-1.5 text-right text-slate-600">{left(l)}</td>
              <td className="py-1 pl-2"><input type="number" min="0" step="any" className="h-8 w-full rounded-md border border-slate-300 px-2 text-right" value={qty[l.id] ?? ""} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} /></td>
              <td className="py-1.5 text-right">{money(num(qty[l.id]) * num(l.rate))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Split equally in</span>
          <input type="number" min="2" className="h-8 w-16 rounded-md border border-slate-300 px-2 text-right" value={parts} onChange={(e) => setParts(e.target.value)} />
          <Button variant="outline" onClick={() => setQty(Object.fromEntries(open.map((l: any) => [l.id, String(r3(left(l) / Math.max(1, num(parts))))])))}>Split</Button>
          <Button variant="ghost" onClick={() => setQty(Object.fromEntries(open.map((l: any) => [l.id, String(left(l))])))}>All</Button>
        </div>
        <span className="font-semibold text-slate-800">This bill ₹{money(total)} + tax</span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onBill(chosen)} disabled={!chosen.length}>Make Sales Invoice</Button>
      </div>
    </div>
  );
}

/** Running bill of one table: items sent to the kitchen, new items, KOT and bill. */
function TableOrderPanel({ order: initial, tables, busy, onClose }: { order: any; tables: any[]; busy: Set<string>; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const company = useCompany();
  const actions = useAppSelector((s) => selectModuleActions(s, "restaurant"));
  const { data: productData } = useProductServicesPickerQuery();
  const products = useMemo(() => productData?.getProductServices || [], [productData]);
  const [order, setOrder] = useState<any>(initial);
  const [draft, setDraft] = useState<SvcLine[]>(() => initial.lines.filter((l: any) => !l.kotno).map((l: any) => ({ ...l, qty: l.qty, rate: l.rate })));
  const [covers, setCovers] = useState<string>(initial.covers ? String(initial.covers) : "");
  const [waiter, setWaiter] = useState<string>(initial.waitername || "");
  const [billing, setBilling] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const refetch = { refetchQueries: ["GetOpenTableOrders"] };
  const [saveOrder, { loading: saving }] = useMutation(SAVE_TABLE_ORDER, refetch);
  const [cancelLine] = useMutation(CANCEL_TABLE_ORDER_LINE, refetch);
  const [moveOrder] = useMutation(MOVE_TABLE_ORDER, refetch);
  const [cancelOrder] = useMutation(CANCEL_TABLE_ORDER, refetch);

  const fail = (e: any, msg: string) => dispatch(showMessage({ message: e?.message || msg, type: "error" }));
  const sent = order.lines.filter((l: any) => l.kotno);
  const kots = Array.from(new Set(sent.map((l: any) => l.kotno))).sort((a: any, b: any) => a - b) as number[];
  const draftLines = draft.filter((l) => l.productserviceid && num(l.qty) > 0).map((l) => ({
    productserviceid: l.productserviceid, variantid: l.variantid || null, salesunitid: l.salesunitid || null, qty: num(l.qty), rate: num(l.rate), note: (l as any).note || null,
  }));
  const total = sent.filter((l: any) => !l.cancelled).reduce((s: number, l: any) => s + num(l.qty) * num(l.rate), 0)
    + draftLines.reduce((s, l) => s + l.qty * l.rate, 0);

  const save = async (sendKot = false) => {
    try {
      const { data } = await saveOrder({ variables: { id: order.id, lines: draftLines, covers: covers === "" ? 0 : num(covers), waitername: waiter, sendKot } });
      const next = data.saveTableOrder;
      setOrder(next);
      setDraft(next.lines.filter((l: any) => !l.kotno));
      if (sendKot) {
        if (actions.showPrint) printKot(next, next.kotcount, company);
        dispatch(showMessage({ message: `KOT ${next.kotcount} sent to the kitchen.`, type: "success" }));
      }
      return next;
    } catch (e: any) {
      fail(e, "Could not save the table.");
      return null;
    }
  };

  const makeBill = (lines: { id: string; qty: number }[]) => {
    const picked = lines.map((b) => ({ ...order.lines.find((l: any) => l.id === b.id), qty: b.qty }));
    navigate("/salesinvoice/addedit", { state: { fromService: {
      kind: "tableorder", id: order.id, billlines: lines, notes: `Table ${order.tablename}${order.covers ? ` (${order.covers} guests)` : ""}`,
      products: toInvoiceProducts(picked, products),
    } } });
  };

  const free = tables.filter((t) => t.id !== order.tableid && !busy.has(t.id) && String(t.branchid || "") === String(order.branchid || ""));
  return (
    <div className="space-y-3 text-[13px]">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <FormField label="Guests" name="covers" type="number" value={covers} onChange={(e: any) => setCovers(e.target.value)} />
        <FormField label="Waiter" name="waiter" value={waiter} onChange={(e: any) => setWaiter(e.target.value)} />
        <div className="md:col-span-2 flex items-end justify-end text-[12px] text-slate-500">Open {since(order.createdAt)}{order.createdby_name ? ` · by ${order.createdby_name}` : ""}</div>
      </div>

      {kots.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          {kots.map((k) => (
            <div key={k} className="border-b border-slate-100 last:border-0">
              <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                <span>KOT {k} · {timeOf(sent.find((l: any) => l.kotno === k)?.kotAt)}</span>
                {actions.showPrint && <button type="button" title="Print KOT again" className="text-indigo-600 hover:text-indigo-800" onClick={() => printKot(order, k, company)}><Printer size={14} /></button>}
              </div>
              {sent.filter((l: any) => l.kotno === k).map((l: any) => (
                <div key={l.id} className={`flex items-center gap-2 px-3 py-1.5 ${l.cancelled ? "text-slate-400 line-through" : ""}`}>
                  <span className="flex-1">{l.name}{l.note ? <span className="ml-1 text-[12px] italic text-slate-500">({l.note})</span> : null}</span>
                  <span className="w-16 text-right">{l.qty}</span>
                  <span className="w-20 text-right">{money(l.rate)}</span>
                  <span className="w-24 text-right">{money(num(l.qty) * num(l.rate))}</span>
                  <span className="w-20 text-right text-[11px] text-emerald-700">{num(l.billedqty) > 0 ? `billed ${l.billedqty}` : ""}</span>
                  <span className="w-8">
                    {actions.showDelete && !l.cancelled && num(l.billedqty) === 0 && (
                      <button type="button" title="Cancel item" className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={async () => {
                          if (!window.confirm(`Cancel ${l.name}?`)) return;
                          try { setOrder((await cancelLine({ variables: { id: order.id, lineid: l.id } })).data.cancelTableOrderLine); } catch (e) { fail(e, "Could not cancel the item."); }
                        }}><X size={14} /></button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {actions.showEdit && <ServiceLines title="New Items" lines={draft} setLines={setDraft} products={products} kind="all" hint="Items here go to the kitchen with the next KOT." />}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          {actions.showEdit && free.length > 0 && (
            <>
              <div className="w-40"><FormField label="" name="moveto" type="select" searchable value={moveTo} placeholder="Move to table" options={free.map((t) => ({ value: t.id, label: t.name }))} onChange={(e: any) => setMoveTo(e.target.value || "")} /></div>
              <Button variant="outline" disabled={!moveTo} onClick={async () => {
                try { setOrder((await moveOrder({ variables: { id: order.id, tableid: moveTo } })).data.moveTableOrder); setMoveTo(""); dispatch(showMessage({ message: "Table moved.", type: "success" })); } catch (e) { fail(e, "Could not move the table."); }
              }}><ArrowRightLeft size={14} className="mr-1" /> Move</Button>
            </>
          )}
          {actions.showDelete && !order.invoiceids?.length && (
            <Button variant="ghost" onClick={async () => {
              if (!window.confirm(`Cancel the running bill of ${order.tablename}?`)) return;
              try { await cancelOrder({ variables: { id: order.id } }); onClose(); } catch (e) { fail(e, "Could not cancel the bill."); }
            }}><Trash2 size={14} className="mr-1" /> Cancel Bill</Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">₹{money(total)} + tax</span>
          {actions.showEdit && <Button variant="outline" disabled={saving} onClick={() => save(false)}>Save</Button>}
          {actions.showEdit && <Button variant="outline" disabled={saving || !draftLines.length} onClick={() => save(true)}><ChefHat size={14} className="mr-1" /> Send KOT</Button>}
          {actions.showConvert && (
            <Button disabled={saving} onClick={async () => {
              const o = draftLines.length || covers !== String(order.covers || "") || waiter !== (order.waitername || "") ? await save(false) : order;
              if (o && o.lines.some((l: any) => !l.cancelled && left(l) > 0)) setBilling(true);
              else if (o) dispatch(showMessage({ message: "There is nothing left to bill.", type: "error" }));
            }}><Receipt size={14} className="mr-1" /> Bill</Button>
          )}
        </div>
      </div>
      <Modal isOpen={billing} onClose={() => setBilling(false)} type="custom" title={`Bill ${order.tablename}`} size="lg">
        {billing && <BillDialog order={order} onClose={() => setBilling(false)} onBill={makeBill} />}
      </Modal>
    </div>
  );
}

const Restaurant = () => {
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "restaurant"));
  const { type } = useAppSelector((s: any) => s.auth);
  const selectedBranch = useAppSelector((s: any) => s.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranch || undefined : undefined;
  const { data: tableData, loading } = useQuery(GET_DINING_TABLES, { variables: { branchid }, fetchPolicy: "cache-and-network" });
  const { data: orderData, refetch } = useQuery(GET_OPEN_TABLE_ORDERS, { variables: { branchid }, fetchPolicy: "cache-and-network", pollInterval: 30000 });
  const [openOrder] = useMutation(OPEN_TABLE_ORDER, { refetchQueries: ["GetOpenTableOrders"] });
  const [deleteTable] = useMutation(DELETE_DINING_TABLE, { refetchQueries: ["GetDiningTables"] });
  const [editing, setEditing] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(t); }, []);

  const tables: any[] = tableData?.getDiningTables || [];
  const orders: any[] = orderData?.getOpenTableOrders || [];
  const byTable = useMemo(() => new Map(orders.map((o) => [o.tableid, o])), [orders]);
  const busy = useMemo(() => new Set(orders.map((o) => o.tableid)), [orders]);
  const areas = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of tables) { const a = t.area || "Tables"; m.set(a, [...(m.get(a) || []), t]); }
    return Array.from(m.entries());
  }, [tables]);

  const openTable = async (t: any) => {
    const running = byTable.get(t.id);
    if (running) return setCurrent(running);
    if (!actions.showAdd) return dispatch(showMessage({ message: "You do not have permission to open a table.", type: "error" }));
    try {
      setCurrent((await openOrder({ variables: { tableid: t.id } })).data.openTableOrder);
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not open the table.", type: "error" }));
    }
  };

  const running = orders.reduce((s, o) => s + num(o.total), 0);
  return (
    <HomeLayout>
      <div className="w-full space-y-3 px-2 pb-6 pt-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Tables</h1>
            <p className="text-[12px] text-slate-500">{orders.length} running · ₹{money(running)} + tax on tables. Tap a table to take the order, send KOT and bill.</p>
          </div>
          {actions.showAdd && <ShortcutButton label="Add Table" keyCode="N" onClick={() => setEditing({})} />}
        </div>
        {loading && !tableData && <div className="text-slate-400">Loading…</div>}
        {!loading && !tables.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">No tables yet. Add your tables (T1, T2…) to start taking orders.</div>}
        {areas.map(([area, list]) => (
          <div key={area} className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{area}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {list.map((t) => {
                const o = byTable.get(t.id);
                return (
                  <div key={t.id} role="button" tabIndex={0} onClick={() => openTable(t)} onKeyDown={(e) => e.key === "Enter" && openTable(t)}
                    className={`group relative cursor-pointer rounded-lg border p-3 transition-shadow hover:shadow ${o ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-[15px] font-semibold text-slate-800">{t.name}</span>
                      <span className="flex gap-1 opacity-0 group-hover:opacity-100">
                        {actions.showEdit && <button type="button" title="Edit table" className="text-slate-400 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); setEditing(t); }}><Pencil size={13} /></button>}
                        {actions.showDelete && !o && <button type="button" title="Delete table" className="text-slate-400 hover:text-rose-600" onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Delete table ${t.name}?`)) return;
                          try { await deleteTable({ variables: { id: t.id } }); } catch (err: any) { dispatch(showMessage({ message: err?.message || "Could not delete.", type: "error" })); }
                        }}><Trash2 size={13} /></button>}
                      </span>
                    </div>
                    {o ? (
                      <div className="mt-1 space-y-0.5 text-[12px] text-amber-900">
                        <div className="font-semibold">₹{money(o.total)}</div>
                        <div>{o.kotcount ? `KOT ${o.kotcount}` : "No KOT yet"} · {since(o.createdAt)}</div>
                      </div>
                    ) : <div className="mt-1 text-[12px] text-emerald-700">Free{t.seats ? ` · ${t.seats} seats` : ""}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} type="custom" title={editing?.id ? "Edit Table" : "Add Table"} size="md">
        {editing && <TableForm table={editing} branchid={branchid} onClose={() => setEditing(null)} />}
      </Modal>
      <Modal isOpen={!!current} onClose={() => { setCurrent(null); refetch(); }} type="custom" title={current ? `Table ${current.tablename}` : ""} size="2xl">
        {current && <TableOrderPanel key={current.id} order={current} tables={tables} busy={busy} onClose={() => { setCurrent(null); refetch(); }} />}
      </Modal>
    </HomeLayout>
  );
};

export default Restaurant;
