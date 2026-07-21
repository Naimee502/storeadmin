import React, { useEffect } from "react";
import HomeLayout from "../../../layouts/home";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import { useDeletedPriceAssignmentQuery, usePriceAssignmentMutations } from "../../../graphql/hooks/pricelists";
import { useChannelsQuery } from "../../../graphql/hooks/channels";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { regionOptions } from "../../../utils/constants";
import { useNavigate } from "react-router";

const DeletedPriceAssignments = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "priceassignments"));
  const dispatch = useAppDispatch();
  const { data: assignmentData, refetch, loading } = useDeletedPriceAssignmentQuery();
  const { data: channelData } = useChannelsQuery();
  const { data: accountData } = useAccountsQuery();
  const { resetPriceAssignment } = usePriceAssignmentMutations();

  const channels = channelData?.getChannels || [];
  const accounts = accountData?.getAccounts || [];
  const assignments = assignmentData?.getDeletedPriceAssignments || [];

  useEffect(() => {
    refetch();
  }, [refetch]);

  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Price List", key: "priceListName" },
    { label: "Target Type", key: "targetTypeDisplay" },
    { label: "Channel", key: "channelName" },
    { label: "Region", key: "regionName" },
    { label: "Customer", key: "customerName" },
    { label: "Status", key: "status" },
  ];

  const getTargetName = (type: string, id: string) => {
    if (type === "channel") return channels.find((c: any) => c.id === id)?.channelName || id;
    if (type === "customer") return accounts.find((a: any) => a.id === id)?.name || id;
    if (type === "region") return regionOptions.find((r: any) => r.value === id)?.label || id;
    if (type === "channel_region") {
      const [cid, reg] = id.split("--");
      const cname = channels.find((c: any) => c.id === cid)?.channelName || cid;
      const rname = regionOptions.find((r: any) => r.value === reg)?.label || reg;
      return `${cname} + ${rname}`;
    }
    return id;
  };

  const tableData = [...assignments].reverse().map((item: any, index: number) => {
    const targetType = item.targettype;
    const targetId = item.targetid;
    
    let channelName = "-";
    let regionName = "-";
    let customerName = "-";

    if (targetType === "channel") {
      channelName = channels.find((c: any) => c.id === targetId)?.channelName || targetId;
    } else if (targetType === "customer") {
      customerName = accounts.find((a: any) => a.id === targetId)?.name || targetId;
    } else if (targetType === "region") {
      regionName = regionOptions.find((r: any) => r.value === targetId)?.label || targetId;
    } else if (targetType === "channel_region") {
      const [cid, reg] = targetId.split("--");
      channelName = channels.find((c: any) => c.id === cid)?.channelName || cid;
      regionName = regionOptions.find((r: any) => r.value === reg)?.label || reg;
    }

    const displayType = targetType === "channel_region" 
      ? "Channel + Region" 
      : targetType.charAt(0).toUpperCase() + targetType.slice(1).replace('_', ' ');

    return {
      ...item,
      seqNo: index + 1,
      priceListName: item.pricelistid?.name,
      targetTypeDisplay: displayType,
      channelName,
      regionName,
      customerName,
      status: item.status ? "Active" : "Inactive",
    };
  });

  const handleReset = async (row: any) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore this price assignment?`
    );
    if (!confirmed) return;

    try {
      await resetPriceAssignment({
        variables: { id: row.id },
      });
      await refetch();
      dispatch(
        showMessage({
          message: "Price assignment restored successfully.",
          type: "success",
        })
      );
      navigate(-1);
    } catch (error) {
      console.error("Reset failed", error);
      dispatch(
        showMessage({
          message: "Failed to restore price assignment.",
          type: "error",
        })
      );
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Manage Deleted Price Assignments"
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
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedPriceAssignments;
