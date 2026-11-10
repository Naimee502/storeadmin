import { useNavigate } from "react-router";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import { showMessage } from "../../../redux/slices/message";
import { useClearDeleted } from "../../../graphql/hooks/common";
import {
  mfgNo, useDeletedBomsQuery, useDeletedProductionEntriesQuery, useDeletedWorkOrdersQuery, useManufacturingMutations,
} from "../../../graphql/hooks/manufacturing";
import { formatDateDMY } from "../../../utils/helper";
import { itemName, money } from "..";

type Kind = "bom" | "workorder" | "production";

const META: Record<Kind, { title: string; module: string; clear: string; back: string; noun: string }> = {
  bom: { title: "Bill of Materials", module: "bom", clear: "bom", back: "/bom", noun: "BOM" },
  workorder: { title: "Work Orders", module: "workorders", clear: "workorders", back: "/workorders", noun: "work order" },
  production: { title: "Production", module: "production", clear: "production", back: "/production", noun: "production entry" },
};

/** Deleted BOMs, work orders or production entries (one screen, three routes). */
const MfgDeletedEntries = ({ kind }: { kind: Kind }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const m = META[kind];
  const actions = useAppSelector((s) => selectModuleActions(s, m.module));
  const boms = useDeletedBomsQuery();
  const wos = useDeletedWorkOrdersQuery();
  const pes = useDeletedProductionEntriesQuery();
  const q = kind === "bom" ? boms : kind === "workorder" ? wos : pes;
  const { resetBom, resetWorkOrder, resetProductionEntry } = useManufacturingMutations();
  const clear = useClearDeleted(m.clear, q.refetch, m.noun);

  const list: any[] =
    kind === "bom" ? boms.data?.getDeletedBoms || [] : kind === "workorder" ? wos.data?.getDeletedWorkOrders || [] : pes.data?.getDeletedProductionEntries || [];

  const columns =
    kind === "bom"
      ? [{ label: "S.No", key: "seqNo" }, { label: "Item", key: "item" }, { label: "BOM Name", key: "name" }, { label: "Deleted On", key: "updated" }]
      : kind === "workorder"
        ? [{ label: "S.No", key: "seqNo" }, { label: "WO No", key: "no" }, { label: "Date", key: "date" }, { label: "Item", key: "item" }, { label: "Qty", key: "qty" }]
        : [{ label: "S.No", key: "seqNo" }, { label: "Entry No", key: "no" }, { label: "Date", key: "date" }, { label: "Produced", key: "item" }, { label: "Cost", key: "cost" }];

  const rows = list.map((d, i) => ({
    id: d.id,
    seqNo: i + 1,
    item: kind === "production" ? (d.outputs || []).map((l: any) => `${itemName(l)} × ${l.qty}`).join(", ") : itemName(d),
    name: d.name || "—",
    updated: formatDateDMY(d.updatedAt),
    no: kind === "workorder" ? mfgNo(d, "WO-") : mfgNo(d, "PE-"),
    date: formatDateDMY(d.billdate),
    qty: `${d.qty ?? ""} ${d.salesunitid?.unitname || ""}`,
    cost: `₹${money(d.totalcost)}`,
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title={`${m.title} — Deleted Entries`}
          columns={columns}
          data={rows}
          showView={false}
          showEdit={false}
          showDelete={false}
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          showReset={actions.canReset}
          onReset={async (row: any) => {
            if (!window.confirm(`Restore this ${m.noun}?`)) return;
            try {
              const run = kind === "bom" ? resetBom : kind === "workorder" ? resetWorkOrder : resetProductionEntry;
              await run({ variables: { id: row.id } });
              await q.refetch();
              dispatch(showMessage({ message: "Restored.", type: "success" }));
              navigate(m.back);
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to restore.", type: "error" }));
            }
          }}
          {...clear}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default MfgDeletedEntries;
