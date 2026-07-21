import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { 
  useDeletedChannelsQuery, 
  useResetChannelMutation 
} from "../../../graphql/hooks/channels";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";

const ChannelDeletedEntries = () => {
  const dispatch = useAppDispatch();
  const actions = useAppSelector(state => selectModuleActions(state, "channels"));
  const { type, admin, branch } = useAppSelector((state: any) => state.auth);
  const adminId = admin?.id;
  
  const { data, refetch } = useDeletedChannelsQuery(adminId);
  const [resetChannel] = useResetChannelMutation();
  
  const deletedChannels = data?.getDeletedChannels || [];
  const isLoading = useAppSelector((state: any) => state.loader.isLoading);

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching deleted channels:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
  }, [dispatch, refetch]);

  const handleReset = async (row: any) => {
    if (window.confirm(`Are you sure you want to restore \"${row.channelName}\"?`)) {
      dispatch(showLoading());
      try {
        await resetChannel({ variables: { id: row.id } });
        await refetch();
        dispatch(showMessage({ message: "Channel restored successfully.", type: "success" }));
      } catch (error: any) {
        dispatch(showMessage({ message: error.message || "Failed to restore channel.", type: "error" }));
      } finally {
        dispatch(hideLoading());
      }
    }
  };

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Code", key: "channelCode" },
    { label: "Channel Name", key: "channelName" },
    { label: "Status", key: "status" },
  ];

  const tableData = [...deletedChannels].reverse().map((channel: any, index: number) => ({
    ...channel,
    seqNo: index + 1,
    status: "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Channel Deleted Entries"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showAdd={false}
          showImport={false}
          showExport={false}
          showDeleted={false}
          showReset={actions.canReset}
          onReset={(row: any) => handleReset(row)}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default ChannelDeletedEntries;
