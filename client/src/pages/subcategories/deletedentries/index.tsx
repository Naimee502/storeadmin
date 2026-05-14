import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useSubCategoryMutations,
  useDeletedSubCategoriesQuery,
} from "../../../graphql/hooks/subcategories";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedSubCategories = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "subcategories"));
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedSubCategoriesQuery();
  const { resetSubCategoryMutation } = useSubCategoryMutations();
  const subCategoryList = data?.getDeletedSubCategories || [];

  useEffect(() => {
    if (!data || !data.getDeletedSubCategories || data.getDeletedSubCategories.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "SubCategory Code", key: "subcategorycode" },
    { label: "SubCategory Name", key: "subcategoryname" },
    { label: "Parent Category", key: "categoryname" },
    { label: "Status", key: "status" },
  ];

  const tableData = subCategoryList.map((subcategory: any, index: number) => ({
    ...subcategory,
    seqNo: index + 1,
    status: subcategory.status ? "Active" : "Inactive",
    categoryname: subcategory.category?.categoryname || "-", // populate parent category
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Manage Deleted SubCategories"
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
                `Are you sure you want to reset deleted subcategory "${row.subcategoryname}"?`
              )
            ) {
              try {
                await resetSubCategoryMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "SubCategory reset successfully.",
                    type: "success",
                  })
                );
                navigate("/subcategories");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset subcategory.",
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

export default DeletedSubCategories;
