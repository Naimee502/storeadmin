// Website "My Parties" (party under party): the sub-parties of the logged-in
// party, an Add Party form (the new party goes under this one), and a detail
// view per party with its Orders / Payments (/ Stock with "Track party stock").
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, Search, Tag, X, Phone, ShoppingCart } from "lucide-react";
import { useCart } from "../../contexts/cart";
import {
  ADD_ACCOUNT, GET_ACCOUNT_GROUPS, GET_CHANNELS, GET_SALES_ORDERS, GET_PAYMENTS, GET_PARTY_STOCK,
} from "../../graphql/queries/accounts";
import { formatPrice } from "../../utils/format";
import { orderStatus, formatBillNumber, formatDate, titleCase } from "../../utils/orders";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  dispatched: "bg-violet-50 text-violet-700",
  delivered: "bg-brand-50 text-brand-700",
  cancelled: "bg-rose-50 text-rose-700",
};

type Props = {
  me: { id: string; channelId?: string | null };
  adminid: string | null;
  branchid: string | null;
  parties: any[];
  trackStock: boolean;
  onChanged: () => void;
};

export default function SubPartiesPanel({ me, adminid, branchid, parties, trackStock, onChanged }: Props) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return parties
      .filter((p: any) => !s || [p.name, p.mobile, p.city, p.channelName].some((x: any) => String(x || "").toLowerCase().includes(s)))
      .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [parties, q]);
  const totalDue = parties.reduce((a: number, p: any) => a + Math.max(0, Number(p.outstanding) || 0), 0);
  const open = parties.find((p: any) => p.id === openId);
  // Sub-parties' orders: pending ones wait on me; this month's sale through my parties.
  const { data: ordData } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: me.id, includeDownline: true }, skip: !adminid, fetchPolicy: "cache-and-network",
  });
  const downOrders: any[] = (ordData?.getSalesOrders ?? []).filter((o: any) => o.partyacc?.id && o.partyacc.id !== me.id && o.cancelStatus !== "cancelled");
  const pendingOrders = downOrders.filter((o: any) => orderStatus(o) === "pending").length;
  const now = new Date();
  const monthSale = downOrders.reduce((a: number, o: any) => {
    const raw = o.billdate || o.createdAt;
    const d = raw ? new Date(/^\d+$/.test(String(raw)) ? Number(raw) : raw) : null;
    return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() ? a + (Number(o.totalamount) || 0) : a;
  }, 0);

  if (open) return <PartyDetail party={open} adminid={adminid} trackStock={trackStock} onBack={() => setOpenId(null)} />;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">My Parties</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, city" className="w-44 text-sm outline-none" />
          </label>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            <Plus className="h-4 w-4" /> Add Party
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-100 p-3"><p className={`text-lg font-bold ${pendingOrders > 0 ? "text-amber-600" : "text-ink-900"}`}>{pendingOrders}</p><p className="text-xs text-slate-500">Pending orders</p></div>
        <div className="rounded-2xl border border-slate-100 p-3"><p className="text-lg font-bold text-brand-700">{formatPrice(monthSale)}</p><p className="text-xs text-slate-500">This month</p></div>
        <div className="rounded-2xl border border-slate-100 p-3"><p className="text-lg font-bold text-rose-600">{formatPrice(totalDue)}</p><p className="text-xs text-slate-500">Total due</p></div>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{q ? "No party matches your search." : "No parties under you yet."}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((p: any) => {
            const due = Math.max(0, Number(p.outstanding) || 0);
            return (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-brand-300">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{String(p.name || "P").charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{[p.mobile, p.city].filter(Boolean).join(" · ") || "—"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {p.channelName && <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700"><Tag className="h-3 w-3" /> {p.channelName}</span>}
                    {p.parentId && p.parentId !== me.id && <span className="text-[11px] text-slate-500">under {p.parentName}</span>}
                  </div>
                </div>
                <div className="text-right">
                  {due > 0 ? (<><p className="text-sm font-bold text-rose-600">{formatPrice(due)}</p><p className="text-[11px] text-slate-500">Due</p></>) : <p className="text-xs font-semibold text-brand-700">No dues</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {adding && (
        <AddPartyModal me={me} adminid={adminid} branchid={branchid} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged(); }} />
      )}
    </div>
  );
}

// ── Party detail ───────────────────────────────────────────────────────────
function PartyDetail({ party, adminid, trackStock, onBack }: { party: any; adminid: string | null; trackStock: boolean; onBack: () => void }) {
  const navigate = useNavigate();
  const { startOrderFor, orderFor, count } = useCart();
  const [tab, setTab] = useState<"orders" | "payments" | "stock">("orders");
  // New Order: fill the cart for this party (its prices) from the shop.
  const newOrder = () => {
    if (orderFor?.id !== party.id && count > 0
      && !window.confirm(`Your cart has items for ${orderFor ? orderFor.name : "yourself"}. Start a new cart for ${party.name}?`)) return;
    startOrderFor({ id: party.id, name: party.name });
    navigate("/shop");
  };
  const { data: ordData, loading: ordLoading } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: party.id }, skip: !adminid, fetchPolicy: "cache-and-network",
  });
  const { data: payData, loading: payLoading } = useQuery(GET_PAYMENTS, {
    variables: { adminid, partyid: party.id }, skip: !adminid, fetchPolicy: "cache-and-network",
  });
  const { data: stockData } = useQuery(GET_PARTY_STOCK, {
    variables: { partyid: party.id }, skip: !trackStock, fetchPolicy: "cache-and-network",
  });
  const orders: any[] = useMemo(() => [...(ordData?.getSalesOrders ?? [])].reverse(), [ordData]);
  const payments: any[] = useMemo(() => (payData?.getPayments ?? []).filter((p: any) => p.status !== false).reverse(), [payData]);
  const stock: any[] = stockData?.getPartyStock ?? [];
  const orderValue = orders.reduce((a, o) => a + (o.cancelStatus === "cancelled" ? 0 : Number(o.totalamount) || 0), 0);
  const received = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const due = Math.max(0, Number(party.outstanding) || 0);

  const tabs = [
    { key: "orders", label: "Orders", count: orders.length },
    { key: "payments", label: "Payments", count: payments.length },
    ...(trackStock ? [{ key: "stock", label: "Stock", count: stock.length }] : []),
  ] as const;

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> My Parties
      </button>
      <div className="mb-5 rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">{String(party.name || "P").charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink-900">{party.name}</p>
            <p className="text-xs text-slate-500">{[party.mobile, party.city, party.channelName].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <button onClick={newOrder} className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            <ShoppingCart className="h-4 w-4" /> New Order
          </button>
          {party.mobile && (
            <a href={`tel:${party.mobile}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-700"><Phone className="h-4 w-4" /> Call</a>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Orders", v: String(orders.length), c: "text-ink-900" },
            { l: "Order value", v: formatPrice(orderValue), c: "text-brand-700" },
            { l: "Received", v: formatPrice(received), c: "text-brand-700" },
            { l: "Due", v: formatPrice(due), c: due > 0 ? "text-rose-600" : "text-slate-500" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-slate-50 p-3"><p className={`text-sm font-bold ${s.c}`}>{s.v}</p><p className="text-[11px] text-slate-500">{s.l}</p></div>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-1 rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`rounded-md py-2 text-xs font-semibold transition ${tab === t.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === "orders" && (ordLoading && !ordData ? <p className="py-10 text-center text-sm text-slate-400">Loading orders…</p> : orders.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">No orders yet.</p> : (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = orderStatus(o);
            return (
              <button key={o.id} onClick={() => navigate(`/account/orders/${o.id}`)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 p-4 text-left hover:border-brand-300">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{formatBillNumber(o)}</p>
                  <p className="text-xs text-slate-500">{formatDate(o.billdate || o.createdAt)} · {o.productservice?.length ?? 0} items</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[st] || "bg-slate-100 text-slate-600"}`}>{titleCase(st)}</span>
                  <p className="text-sm font-bold text-ink-900">{formatPrice(Number(o.totalamount) || 0)}</p>
                </div>
              </button>
            );
          })}
        </div>
      ))}

      {tab === "payments" && (payLoading && !payData ? <p className="py-10 text-center text-sm text-slate-400">Loading payments…</p> : payments.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">No payments yet.</p> : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 p-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">{p.paymentcode || "Payment"}</p>
                <p className="text-xs text-slate-500">{formatDate(p.paymentdate || p.createdAt)}{p.mode ? ` · ${titleCase(p.mode)}` : ""}{p.reference ? ` · ${p.reference}` : ""}</p>
              </div>
              <p className="text-sm font-bold text-brand-700">{formatPrice(Number(p.amount) || 0)}</p>
            </div>
          ))}
        </div>
      ))}

      {tab === "stock" && (stock.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">No stock yet.</p> : (
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Variant</th><th className="px-4 py-2 text-right">Stock</th></tr></thead>
            <tbody>
              {stock.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-ink-900">{r.productname}</td>
                  <td className="px-4 py-2.5 text-slate-500">{[r.variantname, r.productcode].filter(Boolean).join(" · ") || "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${Number(r.qty) < 0 ? "text-rose-600" : "text-ink-900"}`}>{Number(r.qty).toLocaleString("en-IN")} {r.unitname || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── Add party ──────────────────────────────────────────────────────────────
// Customer type, filed under the business's debtors group — same rule the app
// uses (TYPE_GROUP_MAP.customer). The new party goes under the logged-in one.
const DEBTOR_NAMES = ["sundry debtor", "debtor", "trade receivable", "receivable"];

function AddPartyModal({ me, adminid, branchid, onClose, onSaved }: {
  me: { id: string; channelId?: string | null }; adminid: string | null; branchid: string | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", mobile: "", email: "", city: "", address: "", pincode: "", gstnumber: "", channel: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: groupData } = useQuery(GET_ACCOUNT_GROUPS, { variables: { adminId: adminid }, skip: !adminid });
  const { data: chData } = useQuery(GET_CHANNELS, { variables: { adminId: adminid }, skip: !adminid });
  const [addAccount] = useMutation(ADD_ACCOUNT);

  // Only channels my own channel handles (e.g. a Distributor adds Retail Stores).
  const channels: any[] = useMemo(() => {
    const all: any[] = chData?.getChannels ?? [];
    const mine = all.find((c) => c.id === me.channelId);
    const handled: string[] = (mine?.handlesChannels || []).map((h: any) => h.id);
    return handled.length ? all.filter((c) => handled.includes(c.id)) : all;
  }, [chData, me.channelId]);

  const group = useMemo(() => {
    const groups: any[] = groupData?.getAccountGroups ?? [];
    return groups.find((g) => DEBTOR_NAMES.some((n) => String(g.accountgroupname || "").toLowerCase().includes(n)))
      || groups.find((g) => g.category === "assets") || null;
  }, [groupData]);

  const save = async () => {
    if (!form.name.trim()) return setErr("Party name is required.");
    if (!/^\d{10}$/.test(form.mobile.trim())) return setErr("Enter a valid 10-digit mobile number.");
    if (!group) return setErr("No customer account group is set up for this business. Please contact the company.");
    setErr(null);
    setSaving(true);
    try {
      await addAccount({
        variables: {
          input: {
            name: form.name.trim(),
            type: "customer",
            accountgroupid: group.id,
            mobile: form.mobile.trim(),
            email: form.email.trim() || null,
            gstnumber: form.gstnumber.trim() || null,
            address: form.address.trim() || null,
            city: form.city.trim() || null,
            pincode: form.pincode.trim() || null,
            country: "India",
            channel: form.channel || null,
            region: "default",
            assignaccountid: me.id,
            salesmanid: null,
            admin: adminid,
            branchid: branchid || null,
            status: true,
          },
        },
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Could not add the party. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Add Party</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-500 sm:col-span-2">Party name *<input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="text-xs text-slate-500">Mobile *<input className={input} inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="text-xs text-slate-500">Email<input className={input} value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
          {channels.length > 0 && (
            <label className="text-xs text-slate-500 sm:col-span-2">Channel
              <select className={input} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
                <option value="">Select channel (optional)</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.channelName}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs text-slate-500">City<input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
          <label className="text-xs text-slate-500">Pincode<input className={input} inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="text-xs text-slate-500 sm:col-span-2">Address<input className={input} value={form.address} onChange={(e) => set("address", e.target.value)} /></label>
          <label className="text-xs text-slate-500 sm:col-span-2">GSTIN<input className={input} maxLength={15} value={form.gstnumber} onChange={(e) => set("gstnumber", e.target.value.toUpperCase())} /></label>
        </div>
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add Party"}</button>
        </div>
      </div>
    </div>
  );
}
