import React, { useEffect, useState } from "react";
import FormField from "../../components/formfiled";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { 
  useChannelsQuery, 
  useCreateChannelMutation, 
  useUpdateChannelMutation, 
  useDeleteChannelMutation 
} from "../../graphql/hooks/channels";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useNavigate } from "react-router";

const Channels = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "channels"));
  const { type, admin, branch } = useAppSelector((state: any) => state.auth);
  const adminId = admin?.id;
  
  const { data, refetch } = useChannelsQuery(adminId);
  const [createChannel] = useCreateChannelMutation();
  const [updateChannel] = useUpdateChannelMutation();
  const [deleteChannel] = useDeleteChannelMutation();
  
  const channelList = data?.getChannels || [];
  const isLoading = useAppSelector((state: any) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({
    channelName: "",
    status: true,
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formValues.channelName.trim()) {
      errors.channelName = "Channel name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row: any) => {
    setFormValues({
      channelName: row.channelName,
      status: row.status === "Active",
    });
    setIsEditing(true);
    setEditingId(row.id);
  };

  // Save handled-channels for a row directly from the listing dropdown.
  const handleSaveHandles = async (id: string, handlesChannels: string[]) => {
    try {
      await updateChannel({ variables: { id, input: { handlesChannels } } });
      await refetch();
      dispatch(showMessage({ message: "Channel hierarchy updated.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Failed to update.", type: "error" }));
    }
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching channels:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
  }, [dispatch, refetch]);

  const handleFormSubmit = async () => {
    if (!validateForm()) return;
    dispatch(showLoading());
    try {
      if (isEditing && editingId) {
        await updateChannel({
          variables: {
            id: editingId,
            input: {
              channelName: formValues.channelName,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Channel updated successfully.", type: "success" }));
      } else {
        await createChannel({
          variables: {
            input: {
              channelName: formValues.channelName,
              status: formValues.status,
              admin: adminId,
            },
          },
        });
        dispatch(showMessage({ message: "Channel added successfully.", type: "success" }));
      }
      await refetch();
      setFormValues({ channelName: "", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error: any) {
      dispatch(showMessage({ message: error.message || "Failed to save channel.", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Code", key: "channelCode" },
    { label: "Channel Name", key: "channelName" },
    { label: "Handles", key: "handlesText" },
    { label: "Default", key: "isDefaultText" },
    { label: "Status", key: "status" },
  ];

  const tableData = channelList.map((channel: any, index: number) => ({
    ...channel,
    seqNo: index + 1,
    isDefaultText: channel.isDefault ? "Yes" : "No",
    handlesText: (
      <HandlesCell
        channel={channel}
        allChannels={channelList}
        onSave={handleSaveHandles}
      />
    ),
    status: channel.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Manage Channels"
          columns={columns}
          data={tableData}
          showAdd={false}
          showImport={false}
          showExport={false}
          onEdit={(row: any) => handleEdit(row)}
          onDelete={async (row: any) => {
            if (row.isDefault) {
              dispatch(showMessage({ message: "Cannot delete the default channel.", type: "error" }));
              return;
            }
            if (window.confirm(`Are you sure you want to delete \"${row.channelName}\"?`)) {
              try {
                await deleteChannel({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Channel deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete channel.", type: "error" }));
              }
            }
          }}
          onShowDeleted={() => navigate("/channels/deletedentries")}
          isLoading={isLoading}
          formFields={[
            { name: "channelName", label: "Channel Name", type: "text", placeholder: "Enter channel name" },
          ]}
          formValues={formValues}
          formErrors={formErrors}
          onFormChange={handleFormChange}
          onFormSubmit={handleFormSubmit}
        />
      </div>
    </HomeLayout>
  );
};

export default Channels;

// Inline per-row multiselect (FormField/react-select) for "which channels
// this channel handles". Saves immediately on change.
const HandlesCell: React.FC<{
  channel: any;
  allChannels: any[];
  onSave: (id: string, handles: string[]) => void;
}> = ({ channel, allChannels, onSave }) => {
  const [value, setValue] = useState<string[]>(
    (channel.handlesChannels || []).map((c: any) => c.id)
  );

  useEffect(() => {
    setValue((channel.handlesChannels || []).map((c: any) => c.id));
  }, [channel.handlesChannels]);

  const options = allChannels
    .filter((c: any) => c.id !== channel.id)
    .map((c: any) => ({ value: c.id, label: c.channelName }));

  return (
    <div className="min-w-[200px]">
      <FormField
        label=""
        name={`handles-${channel.id}`}
        type="multiselect"
        searchable
        value={value}
        options={options}
        placeholder="Select channels"
        onChange={(e: any) => {
          const next = e.target.value as string[];
          setValue(next);
          onSave(channel.id, next);
        }}
      />
    </div>
  );
};
