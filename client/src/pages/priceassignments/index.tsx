import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import { useAppSelector, useAppDispatch } from "../../redux/hooks";
import { usePriceListQuery, usePriceAssignmentQuery, usePriceAssignmentMutations } from "../../graphql/hooks/pricelists";
import { useChannelsQuery } from "../../graphql/hooks/channels";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { showMessage } from "../../redux/slices/message";
import { regionOptions } from "../../utils/constants";

const PriceAssignments = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { admin } = useAppSelector((state) => state.auth);
  const adminId = admin?.id;

  const { data: assignmentData, refetch, loading } = usePriceAssignmentQuery();
  const { data: priceListData, refetch: priceListRefetch } = usePriceListQuery();
  const { data: channelData, refetch: channelRefetch } = useChannelsQuery();
  const { data: accountData, refetch: accountRefetch } = useAccountsQuery();
  const { createPriceAssignment, updatePriceAssignment, deletePriceAssignment } = usePriceAssignmentMutations();

  useEffect(() => {
    priceListRefetch();
    channelRefetch();
    accountRefetch();
    refetch();
  }, []);

  const [isAdding, setIsAdding] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    pricelistid: "",
    targettype: "channel",
    targetid: "" as any,
  });

  const priceLists = priceListData?.getPriceLists || [];
  const channels = channelData?.getChannels || [];
  const accounts = accountData?.getAccounts || [];
  const assignments = assignmentData?.getPriceAssignments || [];

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

  const tableData = assignments.map((item: any, index: number) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.pricelistid || !formData.targetid) return alert("All fields are required");

    try {
      if (editId) {
        await updatePriceAssignment({
          variables: {
            id: editId,
            input: {
              pricelistid: formData.pricelistid,
              targettype: formData.targettype,
              targetid: Array.isArray(formData.targetid) ? formData.targetid[0] : formData.targetid,
              adminid: adminId,
              status: true
            }
          }
        });
        dispatch(showMessage({ message: "Assignment updated successfully", type: "success" }));
      } else {
        const targetIds = Array.isArray(formData.targetid) ? formData.targetid : [formData.targetid];
        for (const tid of targetIds) {
          await createPriceAssignment({
            variables: {
              input: {
                ...formData,
                adminid: adminId,
                targetid: tid,
                status: true,
              },
            },
          });
        }
        dispatch(showMessage({ message: "Assignment(s) created successfully", type: "success" }));
      }

      setEditId(null);
      setFormData({ pricelistid: "", targettype: "channel", targetid: "" });
      refetch();
    } catch (error) {
      console.error(error);
      dispatch(showMessage({ message: "Error saving assignment", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">


        {isAdding && (
          <div className="bg-white p-6 rounded-xl border shadow-sm mb-8">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <FormField
                label="Price List"
                type="select"
                options={priceLists.map((pl: any) => ({ value: pl.id, label: pl.name }))}
                value={formData.pricelistid}
                onChange={(e) => setFormData({ ...formData, pricelistid: e.target.value })}
                required
              />
              <FormField
                label="Target Type"
                type="select"
                options={[
                  { value: "channel", label: "Channel" },
                  { value: "customer", label: "Customer" },
                  { value: "region", label: "Region" },
                  { value: "channel_region", label: "Channel + Region" },
                ]}
                value={formData.targettype}
                onChange={(e) => setFormData({ ...formData, targettype: e.target.value, targetid: e.target.value === "customer" ? [] : "" })}
                required
              />
              {formData.targettype === "channel" ? (
                <FormField
                  label="Select Channel"
                  type="select"
                  options={channels.map((c: any) => ({ value: c.id, label: c.channelName }))}
                  value={formData.targetid}
                  onChange={(e) => setFormData({ ...formData, targetid: e.target.value })}
                  required
                />
              ) : formData.targettype === "customer" ? (
                <FormField
                  label="Select Customer(s)"
                  type="multiselect"
                  options={accounts.map((a: any) => ({ value: a.id, label: a.name }))}
                  value={formData.targetid}
                  onChange={(e) => setFormData({ ...formData, targetid: e.target.value })}
                  required
                  searchable
                />
              ) : formData.targettype === "channel_region" ? (
                <>
                  <FormField
                    label="Select Channel"
                    type="select"
                    options={channels.map((c: any) => ({ value: c.id, label: c.channelName }))}
                    value={(formData.targetid as string).split("--")[0] || ""}
                    onChange={(e) => {
                      const reg = (formData.targetid as string).split("--")[1] || "";
                      setFormData({ ...formData, targetid: `${e.target.value}--${reg}` });
                    }}
                    required
                  />
                  <FormField
                    label="Select Region"
                    type="select"
                    options={regionOptions}
                    value={(formData.targetid as string).split("--")[1] || ""}
                    onChange={(e) => {
                      const chan = (formData.targetid as string).split("--")[0] || "";
                      setFormData({ ...formData, targetid: `${chan}--${e.target.value}` });
                    }}
                    required
                    searchable
                  />
                </>
              ) : (
                <FormField
                  label="Select Region"
                  type="select"
                  options={regionOptions}
                  value={formData.targetid}
                  onChange={(e) => setFormData({ ...formData, targetid: e.target.value })}
                  required
                  searchable
                />
              )}
              <div className="flex gap-2">
                <Button type="submit" variant="outline">{editId ? "Update" : "Save"}</Button>
                <Button type="button" variant="outline" onClick={() => {
                  setEditId(null);
                  setFormData({ pricelistid: "", targettype: "channel", targetid: "" });
                }}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        <DataTable
          title="Price Assignments"
          columns={columns}
          data={tableData}
          showView={false}
          showAdd={false}
          showExport={false}
          showImport={false}
          showEdit={true}
          showDelete={true}
          onEdit={(row) => {
            setEditId(row.id);
            setFormData({
              pricelistid: row.pricelistid?.id || "",
              targettype: row.targettype,
              targetid: row.targetid,
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          showDeleted={true}
          onShowDeleted={() => navigate("/priceassignments/deletedentries")}
          onDelete={async (row) => {
            if (window.confirm("Delete this assignment?")) {
              await deletePriceAssignment({ variables: { id: row.id } });
              refetch();
            }
          }}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default PriceAssignments;
