import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useDeletedProductServicesQuery,
  useProductServiceMutations,
} from "../../../graphql/hooks/products";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useUnitsQuery } from "../../../graphql/hooks/units";

const DeletedProducts = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data: deletedData, refetch } = useDeletedProductServicesQuery();
    const deletedList = deletedData?.getProductServices ?? [];
  const { resetProductServiceMutation } = useProductServiceMutations();

  const { data: unitData } = useUnitsQuery();
  const unitList = unitData?.getUnits || [];

  useEffect(() => {
    if (!deletedList?.length) {
      refetch();
    }
  }, [deletedList, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Code", key: "code" },
    { label: "Name", key: "name" },
    { label: "Current Stock / Location Type", key: "currentstock" },
    { label: "Sales Rate / Service Rate", key: "salesrate" },
    { label: "Sales Unit / UOM", key: "salesunit" },
    { label: "Status", key: "status" },
  ];

  const tableData = deletedList.map((item: any, index: number) => {
    const variant = item.isservice
      ? item.servicevariants?.[0]
      : item.productvariants?.[0];

    const matchedUnit = !item.isservice && variant
      ? unitList.find((unit) => unit.id === variant.salesunitid)
      : null;

    return {
      ...item,
      seqNo: index + 1,
      code: item.isservice
        ? variant?.servicecode || "-"
        : variant?.productcode || "-",
      name: item.name,
      currentstock: item.isservice
        ? variant?.locationType || "-" // service → show location type
        : variant?.currentstock ?? 0,  // product → show current stock
      salesrate: item.isservice
        ? variant?.servicerate ?? 0
        : variant?.salesrate?.[0]?.enduser ?? 0,
      salesunit: item.isservice
        ? variant?.uom || "-"
        : matchedUnit?.unitname || "-",
      status: item.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Products / Services"
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
            const confirmed = window.confirm(
              `Are you sure you want to reset deleted item "${row.name}"?`
            );
            if (!confirmed) return;

            try {
              await resetProductServiceMutation({
                variables: { id: row.id },
              });
              await refetch();
              dispatch(
                showMessage({
                  message: "Product/Service reset successfully.",
                  type: "success",
                })
              );
              navigate(-1); // go back
            } catch (error) {
              console.error("Reset failed", error);
              dispatch(
                showMessage({
                  message: "Failed to reset product/service.",
                  type: "error",
                })
              );
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
