import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showMessage } from "../../../redux/slices/message";
import {
  useDeletedBranchesQuery,   // you need to create this hook similar to useDeletedAccountsQuery
  useBranchMutations
} from "../../../graphql/hooks/branches";  // make sure this path is correct

const DeletedBranches = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Fetch deleted branches (status: false)
  const { data, refetch } = useDeletedBranchesQuery();
  const { resetBranchMutation } = useBranchMutations();

  const deletedBranches = data?.getDeletedBranches || [];

  useEffect(() => {
    if (!data || !data.getDeletedBranches || data.getDeletedBranches.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Branch Code", key: "branchcode" },
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Mobile Number", key: "mobile" },
    { label: "Location", key: "location" },
    { label: "Address", key: "address" },
    { label: "Status", key: "status" },
    ];

    const tableData = deletedBranches.map((branch: any, index: number) => ({
    ...branch,
    seqNo: index + 1,
    name: branch.branchname,
    status: branch.status ? "Active" : "Inactive",
    }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Branches"
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
          onReset={async (row: any) => {
            if (window.confirm(`Are you sure you want to reset deleted branch "${row.branchname}"?`)) {
              try {
                await resetBranchMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Branch reset successfully.", type: "success" }));
                navigate(-1);
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to reset branch.", type: "error" }));
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

export default DeletedBranches;
