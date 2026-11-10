import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { WORK_STATUS, mfgNo, useManufacturingMutations, useWorkOrdersPageQuery } from "../../graphql/hooks/manufacturing";
import { formatDateDMY, todayYMD } from "../../utils/helper";
import { itemName } from "../bom";

const WorkOrders = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "workorders"));
  const peActions = useAppSelector((s) => selectModuleActions(s, "production"));
  const peOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "production"));
  const table = useServerTable("workorders", ["no", "date", "due", "item", "qty", "produced", "pending", "status"]);
  const { items, total, loading, refetch } = useWorkOrdersPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("workorder", table.page);
  const { deleteWorkOrder, setWorkOrderStatus } = useManufacturingMutations();

  const optionsFor = (w: any) => {
    if (!actions.showEdit) return [];
    const o = Object.entries(WORK_STATUS).filter(([k]) => k !== (w.workStatus || "planned")).map(([value, label]) => ({ value, label }));
    if (peOn && peActions.showAdd && w.workStatus !== "cancelled" && w.workStatus !== "completed" && !w.isOffline) o.unshift({ value: "produce", label: "Record Production" });
    return o;
  };

  const onStatus = async (w: any, v: string) => {
    if (v === "produce") return navigate(`/production/addedit?workOrderId=${w.id}`);
    try {
      await setWorkOrderStatus({ variables: { id: w.id, workStatus: v, expectedUpdatedAt: w.updatedAt } });
      dispatch(showMessage({ message: `Marked ${WORK_STATUS[v]}.`, type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
    }
  };

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "WO No", key: "no" },
    { label: "Date", key: "date" },
    { label: "Due", key: "due" },
    { label: "Item", key: "item" },
    { label: "Qty", key: "qty" },
    { label: "Produced", key: "produced" },
    { label: "Pending", key: "pending" },
    { label: "Status", key: "status" },
  ];

  const today = todayYMD();
  const buildRow = (w: any, i: number) => {
    const unit = w.salesunitid?.unitname || "";
    const pending = Math.max(Number(w.qty) - Number(w.qtyproduced || 0), 0);
    const late = w.duedate && w.duedate < today && !["completed", "cancelled"].includes(w.workStatus);
    return {
      id: w.id,
      seqNo: i >= 0 ? table.offset + i + 1 : "",
      no: mfgNo(w, "WO-"),
      date: formatDateDMY(w.billdate),
      due: w.duedate ? <span className={late ? "font-semibold text-rose-600" : ""}>{formatDateDMY(w.duedate)}{late ? " (late)" : ""}</span> : "—",
      item: itemName(w),
      qty: `${w.qty} ${unit}`,
      produced: `${w.qtyproduced || 0} ${unit}`,
      pending: `${pending} ${unit}`,
      status: <StatusDropdown current={w.workStatus || "planned"} options={optionsFor(w)} onSelect={(v) => onStatus(w, v)} />,
      raw: w,
    };
  };
  const serverRows = items.map((w: any, i: number) => offline.decorate(buildRow(w, i), "seqNo"));
  const rows = offline.rows.length ? [...offline.rows.map((w: any) => offline.decorate(buildRow(w, -1), "seqNo")), ...serverRows] : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Work Orders"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showAdd={actions.showAdd}
          showEdit={(row: any) => actions.showEdit && row.raw?.workStatus !== "cancelled"}
          showDelete={actions.showDelete}
          showDeleted={actions.showDelete || actions.canReset}
          showView={false}
          showImport={false}
          showExport={false}
          onAdd={() => navigate("/workorders/addedit")}
          onEdit={(row) => navigate(`/workorders/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${row.no}?`)) return;
            try {
              await deleteWorkOrder({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Work order deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/workorders/deletedentries")}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default WorkOrders;
