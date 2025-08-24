import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useResetAdminMutation,
  useGetDeletedAdminsQuery
} from "../../../graphql/hooks/admin";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedAdmins = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useGetDeletedAdminsQuery();
  const [resetAdmin] = useResetAdminMutation();

  const adminList = data?.getDeletedAdmins || [];

  useEffect(() => {
    if (!data || !data.getDeletedAdmins || data.getDeletedAdmins.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Business Type", key: "businesstype" },
    { label: "Multibranch", key: "isMultibranch" },
    { label: "Channel Customers", key: "isChannelCustomers" },
  ];

  const tableData = adminList.map((admin: any, index: number) => ({
    ...admin,
    seqNo: index + 1,
    isMultibranch: admin.isMultibranch ? "Yes" : "No",
    isChannelCustomers: admin.isChannelCustomers ? "Yes" : "No",
    status: admin.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
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
    </HomeLayout>
  );
};

export default DeletedAdmins;
