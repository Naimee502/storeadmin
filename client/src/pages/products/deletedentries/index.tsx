import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useDeletedProductsQuery,
  useProductMutations,
} from "../../../graphql/hooks/products";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useUnitsQuery } from "../../../graphql/hooks/units";

const DeletedProducts = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedProductsQuery();
  const { resetProductMutation } = useProductMutations();
  const productList = data?.getDeletedProducts || [];
  const { data: unitData } = useUnitsQuery();
  const unitList = unitData?.getUnits || [];

  useEffect(() => {
    if (!data || !data.getDeletedProducts || data.getDeletedProducts.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Product Code", key: "productcode" },
    { label: "Name", key: "name" },
    { label: "Product Qty", key: "currentstock" },
    { label: "Sales Rate", key: "salesrate" },
    { label: "Sales Unit", key: "salesunit" },
    { label: "Status", key: "status" },
  ];

  const tableData = productList.map((product: any, index: number) => {
  const matchedUnit = unitList.find((unit: any) => unit.id === product.salesunitid);

  return {
    ...product,
    seqNo: index + 1,
    name: product.name,
    salesunit: matchedUnit?.unitname || "-",
    status: product.status ? "Active" : "Inactive",
  };
});

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Products"
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
                `Are you sure you want to reset deleted product "${row.name}"?`
              )
            ) {
              try {
                await resetProductMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Product reset successfully.",
                    type: "success",
                  })
                );
                navigate(-1);
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset product.",
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

export default DeletedProducts;
