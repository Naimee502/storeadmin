import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import DataTable from "../../components/datatable";
import FormField from "../../components/formfiled";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useAccountsLiteQuery } from "../../graphql/hooks/accounts";
import { useAddNew, PARTY_QUERIES } from "../../hooks/useaddnew";
import { ADJUST_LOYALTY_POINTS, GET_LOYALTY_SUMMARY, GET_PARTY_LOYALTY } from "../../graphql/queries/loyalty";
import { partyLabel } from "../../utils/partylabel";
import { formatDateDMY } from "../../utils/helper";

const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KIND: Record<string, string> = { earn: "Earned", redeem: "Redeemed", expire: "Expired", adjust: "Adjusted" };

/** Add or remove a party's points by hand (owner only, with a note). */
function AdjustDialog({ partyid, onClose }: { partyid?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { data: accountData } = useAccountsLiteQuery();
  const addParty = useAddNew("/accounts/addedit", PARTY_QUERIES);
  const [f, setF] = useState({ partyid: partyid || "", points: "", note: "" });
  const [adjust, { loading }] = useMutation(ADJUST_LOYALTY_POINTS, { refetchQueries: ["GetLoyaltySummary", "GetPartyLoyalty"] });
  const save = async () => {
    try {
      await adjust({ variables: { partyid: f.partyid, points: Number(f.points), note: f.note } });
      dispatch(showMessage({ message: "Points updated.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not update points.", type: "error" }));
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-slate-800">Adjust Points</div>
        <FormField label="Party" name="partyid" type="select" searchable addable onAddNew={addParty} value={f.partyid}
          options={(accountData?.getAccounts || []).map((a: any) => ({ value: a.id, label: partyLabel(a) }))}
          onChange={(e: any) => setF({ ...f, partyid: e.target.value })} />
        <FormField label="Points (minus to remove)" name="points" type="number" value={f.points} onChange={(e: any) => setF({ ...f, points: e.target.value })} />
        <FormField label="Note" name="note" type="text" value={f.note} placeholder="Reason" onChange={(e: any) => setF({ ...f, note: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={onClose}>Cancel</button>
          <button type="button" disabled={loading || !f.partyid || !Number(f.points) || !f.note.trim()} onClick={save}
            className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Save</button>
        </div>
      </div>
    </div>
  );
}

/** One party's points history. */
function HistoryDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const { data, loading } = useQuery(GET_PARTY_LOYALTY, { variables: { partyid: row.partyid }, fetchPolicy: "network-only" });
  const acc = data?.getPartyLoyalty;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <div className="font-semibold text-slate-800">{row.party}</div>
          {acc && <div className="text-slate-600">Balance <b className="text-indigo-700">{acc.balance}</b> pts · ₹{money(acc.value)}</div>}
        </div>
        <div className="max-h-[60vh] overflow-auto rounded border border-slate-200">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 text-[12px] text-slate-500">
              <tr><th className="px-3 py-1.5">Date</th><th className="px-3 py-1.5">Type</th><th className="px-3 py-1.5">Bill / Note</th><th className="px-3 py-1.5 text-right">Points</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="px-3 py-3 text-slate-400">Loading…</td></tr>}
              {(acc?.history || []).map((h: any) => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{h.createdAt ? formatDateDMY(h.createdAt) : "—"}</td>
                  <td className="px-3 py-1.5">{KIND[h.kind] || h.kind}</td>
                  <td className="px-3 py-1.5">{h.docno || h.note || "—"}</td>
                  <td className={`px-3 py-1.5 text-right font-medium ${h.points < 0 ? "text-rose-600" : "text-emerald-700"}`}>{h.points > 0 ? "+" : ""}{h.points}</td>
                </tr>
              ))}
              {!loading && !acc?.history?.length && <tr><td colSpan={4} className="px-3 py-3 text-slate-400">No points yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end"><button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

const Loyalty = () => {
  const actions = useAppSelector((s) => selectModuleActions(s, "loyalty"));
  const isOwner = useAppSelector((s: any) => String(s.auth?.type || "").toLowerCase() === "admin");
  const { data, loading } = useQuery(GET_LOYALTY_SUMMARY, { fetchPolicy: "cache-and-network" });
  const [adjusting, setAdjusting] = useState<{ partyid?: string } | null>(null);
  const [viewing, setViewing] = useState<any>(null);
  const s = data?.getLoyaltySummary;
  const r = s?.rules;

  const rows = (s?.parties || []).map((p: any, i: number) => ({
    id: p.partyid, seqNo: i + 1, partyid: p.partyid, party: partyLabel(p),
    earned: p.earned, redeemed: p.redeemed, expired: p.expired,
    balance: <b className="text-indigo-700">{p.balance}</b>,
    value: `₹${money(p.balance * (r?.pointValue || 1))}`,
  }));
  const tiles = [
    ["Points Given", s?.earned ?? 0], ["Points Used", s?.redeemed ?? 0], ["Points Expired", s?.expired ?? 0],
    ["Points Unused", s?.balance ?? 0], ["Unused Value", `₹${money(s?.liability)}`],
  ];

  return (
    <HomeLayout>
      <div className="w-full space-y-3 px-2 pb-6 pt-4 sm:px-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map(([label, v]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className="text-lg font-semibold text-slate-800">{v}</div>
            </div>
          ))}
        </div>
        {r && (
          <p className="text-[12px] text-slate-500">
            {r.earnPer100} point{r.earnPer100 === 1 ? "" : "s"} per ₹100 · 1 point = ₹{r.pointValue}
            {r.minBill > 0 ? ` · bills from ₹${r.minBill}` : ""}{r.maxEarn > 0 ? ` · max ${r.maxEarn} per bill` : ""}
            {r.expiryDays > 0 ? ` · expire after ${r.expiryDays} days` : " · never expire"}
            {r.maxRedeemPercent < 100 ? ` · up to ${r.maxRedeemPercent}% of a bill` : ""}. Change these in Settings → General.
          </p>
        )}
        <DataTable
          title="Loyalty Points"
          columns={[
            { label: "Seq", key: "seqNo" }, { label: "Party", key: "party" }, { label: "Earned", key: "earned" },
            { label: "Used", key: "redeemed" }, { label: "Expired", key: "expired" }, { label: "Balance", key: "balance" }, { label: "Value", key: "value" },
          ]}
          data={rows}
          isLoading={loading && !s}
          showAdd={isOwner && actions.showEdit}
          onAdd={() => setAdjusting({})}
          showView
          onView={(row: any) => setViewing(row)}
          showEdit={isOwner && actions.showEdit}
          onEdit={(row: any) => setAdjusting({ partyid: row.partyid })}
          showDelete={false}
          showImport={false}
          showExport={false}
        />
      </div>
      {adjusting && <AdjustDialog partyid={adjusting.partyid} onClose={() => setAdjusting(null)} />}
      {viewing && <HistoryDialog row={viewing} onClose={() => setViewing(null)} />}
    </HomeLayout>
  );
};

export default Loyalty;
