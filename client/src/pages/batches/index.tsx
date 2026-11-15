import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import DataTable from "../../components/datatable";
import FormField from "../../components/formfiled";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { ADD_OPENING_BATCH, EDIT_BATCH, GET_BATCHES, GET_UNBATCHED_STOCK } from "../../graphql/queries/batches";
import { formatDateDMY } from "../../utils/helper";

type View = "all" | "expiring" | "expired" | "unbatched";
const VIEWS: [View, string][] = [["all", "All Batches"], ["expiring", "Expiring in 90 Days"], ["expired", "Expired"], ["unbatched", "Not in a Batch"]];
const itemName = (r: any) => [r.productname, r.variantname].filter(Boolean).join(" - ");

/** Put stock already on hand into a batch. */
function OpeningDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [f, setF] = useState({ batchno: "", expirydate: "", mfgdate: "", qty: String(row.unbatched) });
  const [save, { loading }] = useMutation(ADD_OPENING_BATCH, { refetchQueries: ["GetBatches", "GetUnbatchedStock"] });
  const submit = async () => {
    try {
      await save({ variables: { input: { branchid: row.branchid, productid: row.productid, variantid: row.variantid, batchno: f.batchno.trim(), expirydate: f.expirydate || null, mfgdate: f.mfgdate || null, qty: Number(f.qty) } } });
      dispatch(showMessage({ message: "Batch saved.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save the batch.", type: "error" }));
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-slate-800">Put in Batch</div>
        <div className="text-slate-600">{itemName(row)} · {row.branchname} · {row.unbatched} not in a batch</div>
        <FormField label="Batch No." name="batchno" type="text" value={f.batchno} onChange={(e: any) => setF({ ...f, batchno: e.target.value.toUpperCase() })} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Expiry Date" name="expirydate" type="date" value={f.expirydate} onChange={(e: any) => setF({ ...f, expirydate: e.target.value })} />
          <FormField label="Mfg Date" name="mfgdate" type="date" value={f.mfgdate} onChange={(e: any) => setF({ ...f, mfgdate: e.target.value })} />
        </div>
        <FormField label="Quantity (base unit)" name="qty" type="number" value={f.qty} onChange={(e: any) => setF({ ...f, qty: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={onClose}>Cancel</button>
          <button type="button" disabled={loading || !f.batchno.trim() || !(Number(f.qty) > 0)} onClick={submit}
            className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Save</button>
        </div>
      </div>
    </div>
  );
}

/** Correct a batch's dates. */
function EditDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [f, setF] = useState({ expirydate: row.expirydate || "", mfgdate: row.mfgdate || "" });
  const [save, { loading }] = useMutation(EDIT_BATCH, { refetchQueries: ["GetBatches"] });
  const submit = async () => {
    try {
      await save({ variables: { id: row.id, expirydate: f.expirydate || "", mfgdate: f.mfgdate || "" } });
      dispatch(showMessage({ message: "Batch updated.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not update the batch.", type: "error" }));
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-slate-800">Batch {row.batchno}</div>
        <div className="text-slate-600">{itemName(row)} · {row.branchname}</div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Expiry Date" name="expirydate" type="date" value={f.expirydate} onChange={(e: any) => setF({ ...f, expirydate: e.target.value })} />
          <FormField label="Mfg Date" name="mfgdate" type="date" value={f.mfgdate} onChange={(e: any) => setF({ ...f, mfgdate: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={onClose}>Cancel</button>
          <button type="button" disabled={loading} onClick={submit} className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Save</button>
        </div>
      </div>
    </div>
  );
}

const Batches = () => {
  const actions = useAppSelector((s) => selectModuleActions(s, "batches"));
  const auth = useAppSelector((s: any) => s.auth);
  const isAdmin = String(auth?.type || "").toLowerCase() === "admin";
  const [view, setView] = useState<View>("all");
  const [branchid, setBranchid] = useState("");
  const { data: branchData } = useBranchesQuery();
  const [opening, setOpening] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const filter = { branchid: branchid || null, ...(view === "expired" ? { expired: true } : view === "expiring" ? { expiringdays: 90 } : {}) };
  const { data, loading } = useQuery(GET_BATCHES, { variables: { filter }, skip: view === "unbatched", fetchPolicy: "cache-and-network" });
  const { data: unData, loading: unLoading } = useQuery(GET_UNBATCHED_STOCK, { variables: { branchid: branchid || null }, skip: view !== "unbatched", fetchPolicy: "cache-and-network" });

  const rows = useMemo(() => (data?.getBatches || []).map((r: any, i: number) => ({
    id: r.id, seqNo: i + 1, item: itemName(r), batchno: r.batchno, branch: r.branchname || "—",
    mfgdate: r.mfgdate ? formatDateDMY(r.mfgdate) : "—",
    expirydate: r.expirydate ? <span className={r.daysleft < 0 ? "font-semibold text-rose-600" : r.daysleft <= 90 ? "font-semibold text-amber-600" : ""}>{formatDateDMY(r.expirydate)}</span> : "—",
    daysleft: r.daysleft == null ? "—" : r.daysleft < 0 ? <span className="text-rose-600">Expired {-r.daysleft}d ago</span> : `${r.daysleft} days`,
    qty: r.qty, raw: r,
  })), [data]);
  const unRows = useMemo(() => (unData?.getUnbatchedStock || []).map((r: any, i: number) => ({
    id: `${r.branchid}|${r.productid}|${r.variantid || ""}`, seqNo: i + 1, item: itemName(r), branch: r.branchname || "—",
    stock: r.stock, inbatches: r.inbatches, unbatched: r.unbatched, raw: r,
  })), [unData]);

  return (
    <HomeLayout>
      <div className="w-full space-y-3 px-2 pb-6 pt-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
            {VIEWS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={`px-3 ${view === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
          {isAdmin && (
            <div className="w-56">
              <FormField label="Branch" name="branchid" type="select" searchable value={branchid} placeholder="All Branches"
                options={(branchData?.getBranches || []).map((b: any) => ({ value: b.id, label: b.branchname }))} onChange={(e: any) => setBranchid(e.target.value || "")} />
            </div>
          )}
        </div>
        {view === "unbatched" ? (
          <DataTable
            title="Stock Not in a Batch"
            columns={[{ label: "Seq", key: "seqNo" }, { label: "Item", key: "item" }, { label: "Branch", key: "branch" }, { label: "Stock", key: "stock" }, { label: "In Batches", key: "inbatches" }, { label: "Not in a Batch", key: "unbatched" }]}
            data={unRows}
            isLoading={unLoading && !unData}
            showAdd={false} showDelete={false} showImport={false} showExport={false} showView={false}
            showEdit={actions.showEdit}
            onEdit={(row: any) => setOpening(row.raw)}
          />
        ) : (
          <DataTable
            title={view === "expired" ? "Expired Batches" : view === "expiring" ? "Batches Expiring in 90 Days" : "Batches"}
            columns={[{ label: "Seq", key: "seqNo" }, { label: "Item", key: "item" }, { label: "Batch No", key: "batchno" }, { label: "Branch", key: "branch" },
              { label: "Mfg", key: "mfgdate" }, { label: "Expiry", key: "expirydate" }, { label: "Left", key: "daysleft" }, { label: "Stock", key: "qty" }]}
            data={rows}
            isLoading={loading && !data}
            showAdd={false} showDelete={false} showImport={false} showView={false}
            showExport={actions.showExport}
            showEdit={actions.showEdit}
            onEdit={(row: any) => setEditing(row.raw)}
          />
        )}
        <p className="text-[12px] text-slate-500">
          Batches fill from Purchase Invoices (Batch No. and Expiry per line). Sales take the batch you pick, or the one that expires first. Stock bought before batches were used shows under Not in a Batch: edit a row to put it into a batch.
        </p>
      </div>
      {opening && <OpeningDialog row={opening} onClose={() => setOpening(null)} />}
      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} />}
    </HomeLayout>
  );
};

export default Batches;
