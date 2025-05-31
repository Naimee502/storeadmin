import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useProductGroupMutations,
  useDeletedProductGroupsQuery,
} from "../../../graphql/hooks/productgroups";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedProductGroups = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedProductGroupsQuery();
  const { resetProductGroupMutation } = useProductGroupMutations();
  const productGroupList = data?.getDeletedProductGroups || [];

  useEffect(() => {
    if (!data || !data.getDeletedProductGroups || data.getDeletedProductGroups.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Product Group Code", key: "productgroupcode" },
    { label: "Product Group Name", key: "productgroupname" },
    { label: "Status", key: "status" },
  ];

  const tableData = productGroupList.map((group: any, index: number) => ({
    ...group,
    seqNo: index + 1,
    status: group.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Product Groups"
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
                `Are you sure you want to reset deleted product group "${row.productgroupname}"?`
              )
            ) {
              try {
                await resetProductGroupMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Product group reset successfully.",
                    type: "success",
                  })
                );
                navigate("/productgroups");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset product group.",
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

export default DeletedProductGroups;
