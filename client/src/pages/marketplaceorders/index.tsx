import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { FileUp, ShoppingBag } from "lucide-react";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { useChannelsQuery } from "../../graphql/hooks/channels";
import { useAccountsLiteQuery } from "../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useSalesOrderMutations } from "../../graphql/hooks/salesorder";
import { partyLabel } from "../../utils/partylabel";
import { todayYMD } from "../../utils/helper";

// Column names we read from the marketplace file (case and spaces ignored); the first match wins.
const COLS: Record<string, string[]> = {
  orderid: ["orderid", "orderno", "ordernumber", "amazonorderid", "suborderno"],
  date: ["orderdate", "date", "purchasedate", "ordereddate"],
  sku: ["sku", "sellersku", "skucode", "productsku"],
  qty: ["qty", "quantity", "quantitypurchased", "units"],
  price: ["price", "itemprice", "sellingprice", "amount", "totalprice"],
  customer: ["customer", "customername", "buyername", "shiptoname", "name"],
  city: ["city", "shipcity"],
};
const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
const pick = (row: Record<string, any>, field: string) => {
  const keys = Object.keys(row);
  for (const want of COLS[field]) {
    const k = keys.find((x) => norm(x) === want);
    if (k && String(row[k] ?? "").trim() !== "") return String(row[k]).trim();
  }
  return "";
};
const toYMD = (v: string) => {
  const d = /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.slice(0, 10)) : (() => { const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(v); return m ? new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`) : new Date(v); })();
  return isNaN(d.getTime()) ? todayYMD() : d.toISOString().slice(0, 10);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Marketplace orders (Amazon / Flipkart / Meesho file) → one Sales Order each, matched by listing SKU. */
const MarketplaceOrders = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const selectedBranchId = useAppSelector((s: any) => s.selectedBranch.branchId);
  const adminId = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : staff?.admin?.id;
  const branchId = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : staff?.branchid?.id;
  const creator = type === "admin" ? { id: admin?.id, name: admin?.name, type: "admin" } : type === "branch" ? { id: branch?.id, name: branch?.branchname, type: "branch" } : { id: staff?.id, name: staff?.name, type: "staff" };

  const { data: channelData } = useChannelsQuery();
  const { data: partyData } = useAccountsLiteQuery();
  const { data: productData } = useProductServicesQuery();
  const { addSalesOrderMutation } = useSalesOrderMutations();
  const [channel, setChannel] = useState("");
  const [party, setParty] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, string>>({});

  // SKU → variant: this channel's listing SKU first, then any listing, then the variant's own SKU.
  const skuIndex = useMemo(() => {
    const exact = new Map<string, any>();
    const any = new Map<string, any>();
    for (const p of productData?.getProductServices || []) {
      for (const v of p.productvariants || []) {
        const line = { product: p, variant: v };
        for (const l of v.listings || []) {
          if (!l?.sku) continue;
          if (l.channel === channel) exact.set(l.sku.toLowerCase(), line);
          else any.set(l.sku.toLowerCase(), line);
        }
        if (v.sku && !any.has(String(v.sku).toLowerCase())) any.set(String(v.sku).toLowerCase(), line);
      }
    }
    return (sku: string) => exact.get(sku.toLowerCase()) || any.get(sku.toLowerCase()) || null;
  }, [productData, channel]);

  const orders = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of rows) {
      const id = pick(r, "orderid");
      if (!id) continue;
      const o = m.get(id) || { id, date: toYMD(pick(r, "date")), customer: pick(r, "customer"), city: pick(r, "city"), lines: [] as any[] };
      const sku = pick(r, "sku");
      o.lines.push({ sku, qty: Math.max(1, Math.round(Number(pick(r, "qty")) || 1)), price: Number(String(pick(r, "price")).replace(/[^0-9.]/g, "")) || 0, match: sku ? skuIndex(sku) : null });
      m.set(id, o);
    }
    return [...m.values()];
  }, [rows, skuIndex]);
  const ready = orders.filter((o) => o.lines.every((l: any) => l.match));

  const readFile = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    setRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }));
    setDone({});
  };

  const importAll = async () => {
    if (!channel || !party || !branchId) {
      dispatch(showMessage({ message: "Pick the channel, the party to bill and a branch first.", type: "error" }));
      return;
    }
    const chName = (channelData as any)?.getChannels?.find((c: any) => c.id === channel)?.channelName || "Marketplace";
    setBusy(true);
    const result: Record<string, string> = {};
    for (const o of ready) {
      // Price in the file includes GST: split it so the order total matches the marketplace.
      const lines = o.lines.map((l: any) => {
        const v = l.match.variant;
        const gst = Number(v.gst) || 0;
        const rate = r2(l.price / l.qty / (1 + gst / 100));
        const net = rate * l.qty;
        return {
          productserviceid: l.match.product.id, variantid: v.id, salesunitid: v.baseunitid?.id || v.baseunitid || undefined,
          unitqty: 1, gst, qty: l.qty, rate, amount: r2(net + (net * gst) / 100), discount: 0,
          salesaccountid: l.match.product.salesaccountid?.id || undefined,
        };
      });
      const subtotal = r2(lines.reduce((s: number, l: any) => s + l.rate * l.qty, 0));
      const totalgst = r2(lines.reduce((s: number, l: any) => s + (l.rate * l.qty * l.gst) / 100, 0));
      try {
        const res = await addSalesOrderMutation({
          variables: {
            input: {
              adminid: adminId, branchid: branchId, createdby_id: creator.id, createdby_name: creator.name, createdby_type: creator.type,
              ordersource: "marketplace", paymenttype: "credit", partyacc: party, taxorsupplytype: "taxInvoice", billtype: "taxInvoice",
              billdate: o.date, ordertype: "retail",
              notes: `${chName} order ${o.id}${o.customer ? ` — ${o.customer}` : ""}${o.city ? `, ${o.city}` : ""}`,
              subtotal, totaldiscount: 0, totalgst, totalamount: r2(subtotal + totalgst), productservice: lines, status: true,
              // Same order imported twice returns the first one.
              clientRequestId: `mkt-${channel}-${o.id}`,
            },
          },
        });
        result[o.id] = res?.data?.addSalesOrder?.billnumber ? `SO-${res.data.addSalesOrder.billnumber}` : "Saved";
      } catch (e: any) {
        result[o.id] = `Failed: ${e?.message || "error"}`;
      }
      setDone({ ...result });
    }
    setBusy(false);
    const ok = Object.values(result).filter((x) => !x.startsWith("Failed")).length;
    dispatch(showMessage({ message: `${ok} of ${ready.length} orders imported.`, type: ok ? "success" : "error" }));
  };

  const channelOptions = ((channelData as any)?.getChannels || []).map((c: any) => ({ value: c.id, label: c.channelName || c.channelCode }));
  const partyOptions = (partyData?.getAccounts || []).map((p: any) => ({ value: p.id, label: partyLabel(p) }));

  return (
    <HomeLayout>
      <div className="w-full space-y-3 px-2 pb-6 pt-4 sm:px-6 text-[13px]">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-indigo-600" />
          <h1 className="text-[15px] font-semibold text-slate-800">Marketplace Orders</h1>
        </div>
        <p className="text-[12px] text-slate-500">
          Upload the order file from Amazon, Flipkart, Meesho or any marketplace (CSV or Excel). Each order becomes a Sales Order for the party you pick, matched by the SKU on the product's Marketplace Listings. Importing the same file again does not make duplicates.
        </p>
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3">
          <FormField label="Channel" name="mkt-channel" type="select" searchable options={channelOptions} value={channel} onChange={(e: any) => setChannel(e.target.value || "")} />
          <FormField label="Bill To (Party)" name="mkt-party" type="select" searchable options={partyOptions} value={party} onChange={(e: any) => setParty(e.target.value || "")} placeholder="e.g. Amazon Customers" />
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-slate-600">Order File</span>
            <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50">
              <FileUp size={14} /> {rows.length ? `${rows.length} rows read` : "Choose CSV / Excel"}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            </span>
          </label>
        </div>

        {orders.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span>{orders.length} orders · <b className="text-emerald-700">{ready.length} ready</b>{orders.length > ready.length && <span className="text-rose-600"> · {orders.length - ready.length} with unknown SKU</span>}</span>
              <button type="button" disabled={busy || !ready.length} onClick={importAll}
                className="inline-flex h-8 items-center rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? "Importing…" : `Import ${ready.length} Orders`}
              </button>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                  <tr><th className="px-3 py-2">Order</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Result</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 font-medium">{o.id}</td>
                      <td className="px-3 py-2">{o.date}</td>
                      <td className="px-3 py-2 text-slate-600">{[o.customer, o.city].filter(Boolean).join(", ")}</td>
                      <td className="px-3 py-2">
                        {o.lines.map((l: any, i: number) => (
                          <div key={i} className={l.match ? "" : "text-rose-600"}>
                            {l.sku} × {l.qty} {l.match ? `→ ${l.match.product.name}${l.match.variant.name ? ` (${l.match.variant.name})` : ""}` : "— no product with this SKU"} · ₹{l.price}
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-2">{done[o.id] || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {Object.keys(done).length > 0 && (
          <button type="button" onClick={() => navigate("/salesorder")} className="text-indigo-600 hover:underline">Open Sales Orders</button>
        )}
      </div>
    </HomeLayout>
  );
};

export default MarketplaceOrders;
