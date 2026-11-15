import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { GET_SERIAL_HISTORY, GET_SERIALS } from "../../graphql/queries/serials";
import { formatDateDMY, todayYMD } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";

type View = "" | "instock" | "sold" | "returned";
const VIEWS: [View, string][] = [["", "All"], ["instock", "In Stock"], ["sold", "Sold"], ["returned", "Sent Back to Vendor"]];
const STATUS: Record<string, string> = { instock: "In Stock", sold: "Sold", returned: "Sent Back" };
const ACTION: Record<string, string> = { bought: "Bought", sold: "Sold", "returned by customer": "Returned by customer", returned: "Sent back to vendor", undone: "Removed from the bill" };
const DOC: Record<string, string> = { PurchaseInvoice: "PUR", SalesInvoice: "INV", SalesReturn: "SR", PurchaseReturn: "PR" };

/** Everything that happened to one unit. */
function HistoryDialog({ unit, onClose }: { unit: any; onClose: () => void }) {
  const { data, loading } = useQuery(GET_SERIAL_HISTORY, { variables: { serialno: unit.serialno }, fetchPolicy: "network-only" });
  const rows: any[] = data?.getSerialHistory || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="font-mono text-base font-semibold text-slate-800">{unit.serialno}</div>
          <div className="text-slate-600">{[unit.productname, unit.variantname].filter(Boolean).join(" - ")} · {STATUS[unit.status] || unit.status}</div>
          {unit.warrantytill && <div className="text-slate-600">Warranty till {formatDateDMY(unit.warrantytill)}{unit.warrantytill < todayYMD() ? " (over)" : ""}</div>}
        </div>
        <div className="max-h-[50vh] overflow-auto rounded border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[12px] text-slate-500"><tr><th className="px-3 py-1.5">Date</th><th className="px-3 py-1.5">What</th><th className="px-3 py-1.5">Bill</th><th className="px-3 py-1.5">Party</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="px-3 py-3 text-slate-400">Loading…</td></tr>}
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{r.createdAt ? formatDateDMY(r.createdAt) : "—"}</td>
                  <td className="px-3 py-1.5">{ACTION[r.action] || r.action}</td>
                  <td className="px-3 py-1.5">{r.docno ? `${DOC[r.docmodel] || ""}-${r.docno}` : "—"}</td>
                  <td className="px-3 py-1.5">{r.partyname || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end"><button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

const Serials = () => {
  const [view, setView] = useState<View>("");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const { data, loading } = useQuery(GET_SERIALS, { variables: { filter: { status: view || null, search: search.trim() || null } }, fetchPolicy: "cache-and-network" });
  const today = todayYMD();
  const rows = useMemo(() => (data?.getSerials || []).map((u: any, i: number) => ({
    id: u.id, seqNo: i + 1, serialno: <span className="font-mono">{u.serialno}</span>,
    item: [u.productname, u.variantname].filter(Boolean).join(" - "),
    status: <span className={u.status === "instock" ? "text-emerald-700" : u.status === "sold" ? "text-indigo-700" : "text-slate-500"}>{STATUS[u.status] || u.status}</span>,
    branch: u.branchname || "—",
    purchase: u.purchasebill ? `PUR-${u.purchasebill} · ${formatDateDMY(u.purchasedate)}${u.vendorname ? ` · ${u.vendorname}` : ""}` : "—",
    customer: u.customername ? partyLabel({ name: u.customername, mobile: u.customermobile }) : "—",
    sale: u.salebill ? `INV-${u.salebill} · ${formatDateDMY(u.saledate)}` : "—",
    warranty: u.warrantytill ? <span className={u.warrantytill < today ? "text-rose-600" : "text-emerald-700"}>{formatDateDMY(u.warrantytill)}</span> : "—",
    raw: u,
  })), [data, today]);

  return (
    <HomeLayout>
      <div className="w-full space-y-3 px-2 pb-6 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
            {VIEWS.map(([k, label]) => (
              <button key={k || "all"} type="button" onClick={() => setView(k)} className={`px-3 ${view === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find IMEI / Serial, item or customer"
            className="h-8 w-72 rounded-md border border-slate-300 px-2 text-[13px] outline-none focus:border-indigo-500" />
        </div>
        <DataTable
          title="IMEI / Serial No."
          columns={[{ label: "Seq", key: "seqNo" }, { label: "IMEI / Serial", key: "serialno" }, { label: "Item", key: "item" }, { label: "Status", key: "status" },
            { label: "Branch", key: "branch" }, { label: "Purchase", key: "purchase" }, { label: "Customer", key: "customer" }, { label: "Sale", key: "sale" }, { label: "Warranty Till", key: "warranty" }]}
          data={rows}
          isLoading={loading && !data}
          showAdd={false} showEdit={false} showDelete={false} showImport={false}
          showView onView={(row: any) => setViewing(row.raw)}
        />
        <p className="text-[12px] text-slate-500">Units are added by Purchase Invoices (IMEI / Serial per line), sold by Sales Invoices and come back with Sales Returns. Open a row to see its history.</p>
      </div>
      {viewing && <HistoryDialog unit={viewing} onClose={() => setViewing(null)} />}
    </HomeLayout>
  );
};

export default Serials;
