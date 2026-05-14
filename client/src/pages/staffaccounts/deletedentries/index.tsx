import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";

import {
  useStaffMutations,
  useDeletedStaffQuery,
} from "../../../graphql/hooks/staffaccounts";

import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedStaffAccounts = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "staffaccounts"));
  const dispatch = useAppDispatch();

  const { data, refetch } = useDeletedStaffQuery();
  const { resetStaffMutation } = useStaffMutations();

  const staffList = data?.getDeletedStaffAccounts || [];

  useEffect(() => {
    if (!data || !data.getDeletedStaffAccounts || data.getDeletedStaffAccounts.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Name", key: "name" },
    { label: "Mobile", key: "mobile" },
    { label: "Email", key: "email" },
    { label: "Salary", key: "salary" },
    { label: "Commission", key: "commission" },
    { label: "Target", key: "target" },
    { label: "Account Group", key: "accountgroupname" },
    { label: "Role", key: "role" },
    { label: "Status", key: "status" },
  ];

  const tableData = staffList.map((s: any, i: number) => {
    const role = s.role
      ? s.role.charAt(0).toUpperCase() + s.role.slice(1)
      : "Staff";

    return {
      ...s,
      seqNo: i + 1,
      salary: s.salary?.toFixed(2),
      commission: s.commission?.toFixed(2),
      target: s.target?.toFixed(2),
      accountgroupname: s.accountgroupid?.accountgroupname || "-",
      role,
      status: s.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Manage Deleted Staff Accounts"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          
          onReset={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to restore deleted staff "${row.name}"?`
              )
            ) {
              try {
                await resetStaffMutation({ variables: { id: row.id } });
                await refetch();

                dispatch(
                  showMessage({
                    message: "Staff restored successfully.",
                    type: "success",
                  })
                );

                navigate("/staffaccounts");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to restore staff.",
                    type: "error",
                  })
                );
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

export default DeletedStaffAccounts;
