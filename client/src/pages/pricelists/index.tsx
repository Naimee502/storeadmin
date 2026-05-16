import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { usePriceListQuery, usePriceListMutations } from "../../graphql/hooks/pricelists";

const PriceLists = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "pricelists"));
  const dispatch = useAppDispatch();
  const { data, refetch, loading } = usePriceListQuery();
  const priceLists = data?.getPriceLists ?? [];
  const { deletePriceList } = usePriceListMutations();

  useEffect(() => {
    refetch();
  }, [refetch]);

  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Name", key: "name" },
    { label: "Description", key: "description" },
    { label: "Status", key: "status" },
  ];

  const tableData = priceLists.map((item: any, index: number) => ({
    ...item,
    seqNo: index + 1,
    status: item.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Price List Master"
          columns={columns}
          data={tableData}
          
          
          
          
          
          
          onEdit={(row) => navigate(`/pricelists/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete "${row.name}"?`)) {
              try {
                await deletePriceList({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Price list deleted successfully.", type: "success" }));
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(showMessage({ message: "Failed to delete price list.", type: "error" }));
              }
            }
          }}
          onAdd={() => navigate("/pricelists/addedit")}
          showDeleted={actions.showDeleted}
          onShowDeleted={() => navigate("/pricelists/deletedentries")}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default PriceLists;
