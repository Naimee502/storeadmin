import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {  
  useAccountGroupMutations,
  useDeletedAccountGroupsQuery
} from "../../../graphql/hooks/accountgroups";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedAccountGroups = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedAccountGroupsQuery();
  const { resetAccountGroupMutation } = useAccountGroupMutations();
  const accountGroupList = data?.getDeletedAccountGroups || [];
  console.log("DELETEDA:",JSON.stringify(accountGroupList));

  useEffect(() => {
    if (!data || !data.getDeletedAccountGroups || data.getDeletedAccountGroups.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Account Group Code", key: "accountgroupcode" },
    { label: "Account Group Name", key: "accountgroupname" },
    { label: "Status", key: "status" },
  ];

  const tableData = accountGroupList.map((ag: any, index: number) => ({
    ...ag,
    seqNo: index + 1,
    status: ag.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Account Groups"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          showReset={true}
          onReset={async (row) => {
            if (window.confirm(`Are you sure you want to reset deleted entry "${row.accountgroupname}"?`)) {
                try {
                await resetAccountGroupMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Account group reset successfully.", type: "success" }));
                navigate("/accountgroups")
                } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to reset account group.", type: "error" }));
                }
            }
          }}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedAccountGroups;
