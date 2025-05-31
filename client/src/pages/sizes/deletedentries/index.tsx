import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useSizeMutations,
  useDeletedSizesQuery,
} from "../../../graphql/hooks/sizes";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedSizes = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedSizesQuery();
  const { resetSizeMutation } = useSizeMutations();
  const sizeList = data?.getDeletedSizes || [];

  useEffect(() => {
    if (!data || !data.getDeletedSizes || data.getDeletedSizes.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Size Code", key: "sizecode" },
    { label: "Size Name", key: "sizename" },
    { label: "Status", key: "status" },
  ];

  const tableData = sizeList.map((size: any, index: number) => ({
    ...size,
    seqNo: index + 1,
    status: size.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Sizes"
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
                `Are you sure you want to reset deleted size "${row.sizename}"?`
              )
            ) {
              try {
                await resetSizeMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Size reset successfully.",
                    type: "success",
                  })
                );
                navigate("/sizes");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset size.",
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

export default DeletedSizes;
