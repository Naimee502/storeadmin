import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showMessage } from "../../../redux/slices/message";
import {
  useDeletedAccountsQuery,
  useAccountMutations
} from "../../../graphql/hooks/accounts";
import {
  useAccountGroupsQuery
} from "../../../graphql/hooks/accountgroups";

const DeletedAccounts = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Fetch deleted accounts
    const branchid = localStorage.getItem("branchid") || "";
  const { data, refetch } = useDeletedAccountsQuery(branchid);
  // Fetch account groups for displaying name instead of ID
  const { data: accountGroupsData } = useAccountGroupsQuery();
  const { resetAccountMutation } = useAccountMutations();

  const deletedAccounts = data?.getDeletedAccounts || [];
  const accountGroups = accountGroupsData?.getAccountGroups || [];

  useEffect(() => {
    if (!data || !data.getDeletedAccounts || data.getDeletedAccounts.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Account Code", key: "accountcode" },
    { label: "Name", key: "name" },
    { label: "Account Group", key: "accountgroupname" },
    { label: "Mobile", key: "mobile" },
    { label: "Email", key: "email" },
    { label: "Status", key: "status" },
  ];

  const tableData = deletedAccounts.map((account: any, index: number) => {
    const group = accountGroups.find((g:any) => g.id === account.accountgroupid);
    return {
      ...account,
      seqNo: index + 1,
      status: account.status ? "Active" : "Inactive",
      accountgroupname: group ? group.accountgroupname : "-",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Accounts"
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
          onReset={async (row:any) => {
            if (window.confirm(`Are you sure you want to reset deleted account "${row.name}"?`)) {
              try {
                await resetAccountMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Account reset successfully.", type: "success" }));
                navigate("/accounts");
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to reset account.", type: "error" }));
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

export default DeletedAccounts;
