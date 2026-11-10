import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showMessage } from "../../../redux/slices/message";
import { useClearDeleted } from "../../../graphql/hooks/common";
import { leadNo, useCrmLists, useDeletedLeadsQuery, useLeadMutations } from "../../../graphql/hooks/lead";

const DeletedLeads = () => {
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "leads"));
  const { stageOf } = useCrmLists();
  const { data, refetch, loading } = useDeletedLeadsQuery();
  const { resetLead } = useLeadMutations();
  const clear = useClearDeleted("leads", refetch, "lead");

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Lead No", key: "leadnumber" },
    { label: "Name", key: "name" },
    { label: "Mobile", key: "mobile" },
    { label: "City", key: "city" },
    { label: "Stage", key: "stage" },
  ];
  const rows = (data?.getDeletedLeads || []).map((l: any, i: number) => ({
    id: l.id,
    seqNo: i + 1,
    leadnumber: leadNo(l),
    name: l.name,
    mobile: l.mobile || "—",
    city: l.city || "—",
    stage: stageOf(l.stage)?.label || l.stage,
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Leads"
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
            if (!window.confirm(`Restore lead ${row.name}?`)) return;
            try {
              await resetLead({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Lead restored.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Could not restore.", type: "error" }));
            }
          }}
          {...clear}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedLeads;
