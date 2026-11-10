import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import { showMessage } from "../../../redux/slices/message";
import { useClearDeleted } from "../../../graphql/hooks/common";
import {
  customerLabel, jobCardNo, useDeletedAppointmentsQuery, useDeletedContractsQuery, useDeletedJobCardsQuery, useDeletedMembershipsQuery, useServiceMutations,
} from "../../../graphql/hooks/service";
import { formatDateDMY } from "../../../utils/helper";

type Kind = "appointments" | "jobcards" | "contracts" | "memberships";
const TITLE: Record<Kind, string> = { appointments: "Appointments", jobcards: "Job Cards", contracts: "AMC / Warranty", memberships: "Memberships" };

/** Deleted appointments, job cards, contracts or memberships (one screen, four routes). */
const ServiceDeletedEntries = ({ kind }: { kind: Kind }) => {
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, kind));
  const q = {
    appointments: useDeletedAppointmentsQuery(), jobcards: useDeletedJobCardsQuery(), contracts: useDeletedContractsQuery(), memberships: useDeletedMembershipsQuery(),
  }[kind];
  const m = useServiceMutations();
  const reset = { appointments: m.resetAppointment, jobcards: m.resetJobCard, contracts: m.resetContract, memberships: m.resetMembership }[kind];
  const clear = useClearDeleted(kind, q.refetch, TITLE[kind].toLowerCase());
  const field = { appointments: "getDeletedAppointments", jobcards: "getDeletedJobCards", contracts: "getDeletedContracts", memberships: "getDeletedMemberships" }[kind];

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: kind === "jobcards" ? "Job No" : "Date", key: "ref" },
    { label: "Customer", key: "partyacc" },
    { label: "Details", key: "details" },
    { label: "Deleted On", key: "updated" },
  ];
  const rows = (q.data?.[field] || []).map((d: any, i: number) => ({
    id: d.id,
    seqNo: i + 1,
    ref: kind === "jobcards" ? jobCardNo(d) : formatDateDMY(d.billdate || d.startdate),
    partyacc: customerLabel(d),
    details:
      kind === "appointments" ? `${d.starttime} - ${d.staffid?.name || "Unassigned"}`
        : kind === "jobcards" ? [d.devicename || d.productserviceid?.name, d.serial].filter(Boolean).join(" - ")
          : kind === "contracts" ? d.title || `Till ${formatDateDMY(d.enddate)}`
            : d.planid?.name || "",
    updated: formatDateDMY(d.updatedAt),
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title={`Deleted ${TITLE[kind]}`}
          columns={columns}
          data={rows}
          showView={false}
          showEdit={false}
          showDelete={false}
          showAdd={false}
          showImport={false}
          showExport={false}
          showDeleted={false}
          showReset={actions.canReset}
          onReset={async (row: any) => {
            if (!window.confirm("Restore this entry?")) return;
            try {
              await reset({ variables: { id: row.id } });
              await q.refetch();
              dispatch(showMessage({ message: "Restored.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Could not restore.", type: "error" }));
            }
          }}
          {...clear}
          isLoading={q.loading}
        />
      </div>
    </HomeLayout>
  );
};

export default ServiceDeletedEntries;
