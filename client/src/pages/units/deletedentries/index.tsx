import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useUnitMutations,
  useDeletedUnitsQuery,
} from "../../../graphql/hooks/units";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedUnits = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedUnitsQuery();
  const { resetUnitMutation } = useUnitMutations();
  const unitList = data?.getDeletedUnits || [];

  useEffect(() => {
    if (!data || !data.getDeletedUnits || data.getDeletedUnits.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Unit Code", key: "unitcode" },
    { label: "Unit Name", key: "unitname" },
    { label: "Status", key: "status" },
  ];

  const tableData = unitList.map((unit: any, index: number) => ({
    ...unit,
    seqNo: index + 1,
    status: unit.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Units"
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
                `Are you sure you want to reset deleted unit "${row.unitname}"?`
              )
            ) {
              try {
                await resetUnitMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Unit reset successfully.",
                    type: "success",
                  })
                );
                navigate("/units");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset unit.",
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

export default DeletedUnits;
