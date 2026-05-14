import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useDeletedProductServicesQuery,
  useProductServiceMutations,
} from "../../../graphql/hooks/products";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedProducts = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "products"));
  const dispatch = useAppDispatch();

  const { data: deletedData, refetch } = useDeletedProductServicesQuery();
  const deletedList = deletedData?.getProductServices ?? [];
  const { resetProductServiceMutation } = useProductServiceMutations();

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

  const capitalize = (str: string | undefined) => 
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "-";

  const tableData = deletedList?.map((item: any, index: number) => {
    const variants = item.isservice ? item.servicevariants : item.productvariants;

    return {
      ...item,
      seqNo: index + 1,
      code: item.isservice
        ? variants?.[0]?.servicecode || "-"
        : variants?.[0]?.productcode || "-",
      name: item.name,

      // ✅ Show stock vertically
      currentstock: (
        <div>
          {variants?.map((variant: any, i: number) => (
            <div key={i}>
              {item.isservice ? capitalize(variant?.locationType) || "-" : variant?.currentstock ?? 0}
            </div>
          ))}
        </div>
      ),

      salesrate: (
      <div>
        {variants?.map((variant: any, i: number) => (
          <div key={i} className="border-b border-gray-200 pb-1 mb-1">
            {item.isservice
              ? `${variant?.servicerate || 0}` // service rate
              : variant?.unitprices?.map((up: any, j: number) => (
                  <div key={j}>
                    {up.salesrate} 
                  </div>
                )) || "-"}
          </div>
        ))}
      </div>
    ),

    // Sales Unit / UOM
    salesunit: (
      <div>
        {variants?.map((variant: any, i: number) => (
          <div key={i} className="border-b border-gray-200 pb-1 mb-1">
            {item.isservice
              ? capitalize(variant?.uom) || "-" // service unit
              : variant?.unitprices?.map((up: any, j: number) => (
                  <div key={j}>
                    {up.quantity} {up.unitid?.unitname || "-"}
                  </div>
                )) || "-"}
          </div>
        ))}
      </div>
    ),

      status: item.status ? "Active" : "Inactive",
    };
  });


  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
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
