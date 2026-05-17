import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useDeletedPriceListQuery,
  usePriceListMutations,
} from "../../../graphql/hooks/pricelists";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";

const DeletedPriceLists = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector(state => selectModuleActions(state, "pricelists"));

  const { data: deletedData, refetch } = useDeletedPriceListQuery();
  const deletedList = deletedData?.getDeletedPriceLists ?? [];
  const { resetPriceList } = usePriceListMutations();

  useEffect(() => {
    refetch();
  }, [refetch]);

  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Name", key: "name" },
    { label: "Description", key: "description" },
    { label: "Status", key: "status" },
  ];

  const tableData = deletedList.map((item: any, index: number) => ({
    ...item,
    seqNo: index + 1,
    status: item.status ? "Active" : "Inactive",
  }));

  const handleReset = async (row: any) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore deleted price list "${row.name}"?`
    );
    if (!confirmed) return;

    try {
      await resetPriceList({
        variables: { id: row.id },
      });
      await refetch();
      dispatch(
        showMessage({
          message: "Price list restored successfully.",
          type: "success",
        })
      );
      navigate(-1);
    } catch (error) {
      console.error("Reset failed", error);
      dispatch(
        showMessage({
          message: "Failed to restore price list.",
          type: "error",
        })
      );
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Price Lists"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          showReset={actions.canReset}
          onReset={handleReset}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedPriceLists;
