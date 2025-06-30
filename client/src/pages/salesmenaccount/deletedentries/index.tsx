import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useSalesmanMutations,
  useDeletedSalesmenQuery,
} from "../../../graphql/hooks/salesmenaccount";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedSalesmenAccounts = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data, refetch } = useDeletedSalesmenQuery();
  const { resetSalesmanMutation } = useSalesmanMutations();
  const salesmenList = data?.getDeletedSalesmenAccounts || [];

  useEffect(() => {
    if (!data || !data.getDeletedSalesmenAccounts || data.getDeletedSalesmenAccounts.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
        { label: "Seq Number", key: "seqNo" },
        { label: "Name", key: "name" },
        { label: "Mobile", key: "mobile" },
        { label: "Email", key: "email" },
        { label: "Commission", key: "commission" },
        { label: "Status", key: "status" },
  ];

  const tableData = salesmenList.map((salesman: any, index: number) => ({
        ...salesman,
        seqNo: index + 1,
        status: salesman.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Salesmen Accounts"
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
            if (
              window.confirm(
                `Are you sure you want to reset deleted salesman "${row.name}"?`
              )
            ) {
              try {
                await resetSalesmanMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Salesman reset successfully.",
                    type: "success",
                  })
                );
                navigate("/salesmenaccount");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset salesman.",
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

export default DeletedSalesmenAccounts;
