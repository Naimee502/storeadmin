import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { PRICING_UNITS, useServiceMasterMutations, useServicesPageQuery } from "../../graphql/hooks/services";

const SERVER_FILTER_KEYS = ["code", "name", "category", "rates", "gst", "duration", "status"];
const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const basisLabel = (v?: string) => PRICING_UNITS.find((p) => p.value === v)?.label || "";
export const durationText = (d?: { amount?: number; unit?: string }) =>
  d?.amount ? `${d.amount} ${d.unit === "minutes" ? "min" : d.amount === 1 ? "hour" : "hours"}` : "—";

/** Services list; with `deleted` it shows the deleted ones with Restore. */
const Services = ({ deleted = false }: { deleted?: boolean }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "services"));
  const table = useServerTable(deleted ? "services:deleted" : "services", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useServicesPageQuery(table.variables, !deleted);
  const serverPaging = useServerPaging(table, total, loading);
  const { deleteService, resetService } = useServiceMasterMutations();

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Code", key: "code" },
    { label: "Name", key: "name" },
    { label: "Category", key: "category" },
    { label: "Variants / Rate", key: "rates" },
    { label: "GST %", key: "gst" },
    { label: "Duration", key: "duration" },
    { label: "Status", key: "status" },
  ];

  const rows = items.map((s: any, i: number) => {
    const vs = s.servicevariants || [];
    return {
      id: s.id,
      seqNo: table.offset + i + 1,
      code: vs[0]?.servicecode || "—",
      name: s.name,
      category: s.categoryid?.categoryname || "—",
      rates: (
        <div className="space-y-0.5">
          {vs.map((v: any) => (
            <div key={v.id || v.name} className="whitespace-nowrap text-[12px]">
              <span className="text-slate-600">{v.name}</span> <b>₹{money(v.servicerate)}</b>
              {v.pricingunit && <span className="text-slate-500"> {basisLabel(v.pricingunit).replace("Fixed Price", "").toLowerCase()}</span>}
            </div>
          ))}
        </div>
      ),
      gst: vs[0]?.gst !== undefined && vs[0]?.gst !== null ? `${vs[0].gst}%` : "—",
      duration: durationText(vs[0]?.duration),
      status: s.status ? "Active" : "Inactive",
      raw: s,
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title={deleted ? "Services — Deleted Entries" : "Services"}
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showAdd={!deleted && actions.showAdd}
          showEdit={!deleted && actions.showEdit}
          showDelete={!deleted && actions.showDelete}
          showDeleted={!deleted && (actions.showDelete || actions.canReset)}
          showReset={deleted && actions.canReset}
          showView={false}
          showImport={false}
          showExport={false}
          requireBranchForAdd
          onAdd={() => navigate("/services/addedit")}
          onEdit={(row) => navigate(`/services/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete "${row.name}"?`)) return;
            try {
              await deleteService({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Service deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onReset={async (row: any) => {
            if (!window.confirm(`Restore "${row.name}"?`)) return;
            try {
              await resetService({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Service restored.", type: "success" }));
              navigate("/services");
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to restore.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/services/deletedentries")}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default Services;
