import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import LoginLayout from "../../../layouts/login";
import {
  useResetAdminMutation,
  useGetDeletedAdminsQuery
} from "../../../graphql/hooks/admin";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedAdmins = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "adminregister"));
  const dispatch = useAppDispatch();
  const { data, refetch } = useGetDeletedAdminsQuery();
  const [resetAdmin] = useResetAdminMutation();

  const adminList = data?.getDeletedAdmins || [];

  useEffect(() => {
    if (!data || !data.getDeletedAdmins || data.getDeletedAdmins.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  // Same columns as the Manage Admins list so both screens look identical
  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Admin Code", key: "admincode" },
    { label: "Company", key: "companyName" },
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Mobile", key: "mobile" },
    { label: "Branches", key: "noOfBranches" },
    { label: "Subscription", key: "subscriptionType" },
    { label: "Business Type", key: "businesstype" },
  ];

  const cap = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const tableData = [...adminList].reverse().map((admin: any, index: number) => ({
    ...admin,
    seqNo: index + 1,
    admincode: admin.admincode || "-",
    companyName: cap(admin.companyName),
    name: cap(admin.name),
    subscriptionType: cap(admin.subscriptionType),
    businesstype: cap(admin.businesstype),
  }));

  return (
    <LoginLayout>
      <div className="w-[95vw] max-w-7xl px-2 sm:px-4 py-2">
        <DataTable
          {...actions}
          title="Manage Deleted Admins"
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
            if (window.confirm(`Are you sure you want to restore admin "${row.name}"?`)) {
              try {
                await resetAdmin({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Admin reset successfully.",
                    type: "success",
                  })
                );
                navigate("/adminregister/list");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset admin.",
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
    </LoginLayout>
  );
};

export default DeletedAdmins;
