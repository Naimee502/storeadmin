import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { QC_STATUS, mfgNo, useManufacturingMutations, useProductionEntriesPageQuery } from "../../graphql/hooks/manufacturing";
import { formatDateDMY } from "../../utils/helper";
import { itemName, money } from "../bom";

export const producedText = (p: any) => (p.outputs || []).map((l: any) => `${itemName(l)} × ${l.qty} ${l.salesunitid?.unitname || ""}`.trim()).join(", ");

const Production = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "production"));
  const table = useServerTable("production", ["no", "date", "wo", "produced", "qc", "cost"]);
  const { items, total, loading, refetch } = useProductionEntriesPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("production", table.page);
  const { deleteProductionEntry } = useManufacturingMutations();

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Entry No", key: "no" },
    { label: "Date", key: "date" },
    { label: "Work Order", key: "wo" },
    { label: "Produced", key: "produced" },
    { label: "Materials", key: "materials" },
    { label: "Total Cost", key: "cost" },
    { label: "QC", key: "qc" },
  ];

  const buildRow = (p: any, i: number) => ({
    id: p.id,
    seqNo: i >= 0 ? table.offset + i + 1 : "",
    no: mfgNo(p, "PE-"),
    date: formatDateDMY(p.billdate),
    wo: p.workordernumber ? `WO-${String(p.workordernumber).replace(/^WO-/, "")}` : "—",
    produced: producedText(p),
    materials: (p.components || []).length,
    cost: `₹${money(p.totalcost)}`,
    qc: QC_STATUS[p.qcstatus] || "—",
    raw: p,
  });
  const serverRows = items.map((p: any, i: number) => offline.decorate(buildRow(p, i), "seqNo"));
  const rows = offline.rows.length ? [...offline.rows.map((p: any) => offline.decorate(buildRow(p, -1), "seqNo")), ...serverRows] : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Production"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showAdd={actions.showAdd}
          showEdit={actions.showEdit}
          showDelete={actions.showDelete}
          showDeleted={actions.showDelete || actions.canReset}
          showView={false}
          showImport={false}
          showExport={false}
          onAdd={() => navigate("/production/addedit")}
          onEdit={(row) => navigate(`/production/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${row.no}? Its stock moves are reversed.`)) return;
            try {
              await deleteProductionEntry({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Production entry deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/production/deletedentries")}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default Production;
