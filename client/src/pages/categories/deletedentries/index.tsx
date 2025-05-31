import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useCategoryMutations,
  useDeletedCategoriesQuery,
} from "../../../graphql/hooks/categories";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedCategories = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedCategoriesQuery();
  const { resetCategoryMutation } = useCategoryMutations();
  const categoryList = data?.getDeletedCategories || [];

  useEffect(() => {
    if (!data || !data.getDeletedCategories || data.getDeletedCategories.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Category Code", key: "categorycode" },
    { label: "Category Name", key: "categoryname" },
    { label: "Status", key: "status" },
  ];

  const tableData = categoryList.map((category: any, index: number) => ({
    ...category,
    seqNo: index + 1,
    status: category.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Categories"
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
                `Are you sure you want to reset deleted category "${row.categoryname}"?`
              )
            ) {
              try {
                await resetCategoryMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Category reset successfully.",
                    type: "success",
                  })
                );
                navigate("/categories");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset category.",
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

export default DeletedCategories;
