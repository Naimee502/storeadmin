import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useModelMutations,
  useDeletedModelsQuery,
} from "../../../graphql/hooks/models";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedModels = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedModelsQuery();
  const { resetModelMutation } = useModelMutations();
  const modelList = data?.getDeletedModels || [];

  useEffect(() => {
    if (!data || !data.getDeletedModels || data.getDeletedModels.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Model Code", key: "modelcode" },
    { label: "Model Name", key: "modelname" },
    { label: "Status", key: "status" },
  ];

  const tableData = modelList.map((model: any, index: number) => ({
    ...model,
    seqNo: index + 1,
    status: model.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Models"
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
                `Are you sure you want to reset deleted model "${row.modelname}"?`
              )
            ) {
              try {
                await resetModelMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Model reset successfully.",
                    type: "success",
                  })
                );
                navigate("/models");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset model.",
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

export default DeletedModels;
