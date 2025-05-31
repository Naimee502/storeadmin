import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useBrandMutations,
  useDeletedBrandsQuery,
} from "../../../graphql/hooks/brands";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedBrands = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedBrandsQuery();
  const { resetBrandMutation } = useBrandMutations();
  const brandList = data?.getDeletedBrands || [];

  useEffect(() => {
    if (!data || !data.getDeletedBrands || data.getDeletedBrands.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Brand Code", key: "brandcode" },
    { label: "Brand Name", key: "brandname" },
    { label: "Status", key: "status" },
  ];

  const tableData = brandList.map((brand: any, index: number) => ({
    ...brand,
    seqNo: index + 1,
    status: brand.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Brands"
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
                `Are you sure you want to reset deleted brand "${row.brandname}"?`
              )
            ) {
              try {
                await resetBrandMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Brand reset successfully.",
                    type: "success",
                  })
                );
                navigate("/brands");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset brand.",
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

export default DeletedBrands;
