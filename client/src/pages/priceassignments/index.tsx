import React, { useState } from "react";
import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import { usePriceListQuery, usePriceAssignmentQuery, usePriceAssignmentMutations } from "../../graphql/hooks/pricelists";
import { useChannelsQuery } from "../../graphql/hooks/channels";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useAppDispatch } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";

const PriceAssignments = () => {
  const dispatch = useAppDispatch();
  const { data: assignmentData, refetch, loading } = usePriceAssignmentQuery();
  const { data: priceListData } = usePriceListQuery();
  const { data: channelData } = useChannelsQuery();
  const { data: accountData } = useAccountsQuery();
  const { createPriceAssignment, deletePriceAssignment } = usePriceAssignmentMutations();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    pricelistid: "",
    targettype: "channel",
    targetid: "",
    priority: 5,
  });

  const priceLists = priceListData?.getPriceLists || [];
  const channels = channelData?.getChannels || [];
  const accounts = accountData?.getAccounts || [];
  const assignments = assignmentData?.getPriceAssignments || [];

  const columns = [
    { label: "Priority", key: "priority" },
    { label: "Target Type", key: "targettype" },
    { label: "Target Name", key: "targetName" },
    { label: "Price List", key: "priceListName" },
    { label: "Status", key: "status" },
  ];

  const getTargetName = (type: string, id: string) => {
    if (type === "channel") return channels.find((c: any) => c.id === id)?.channelName || id;
    if (type === "customer") return accounts.find((a: any) => a.id === id)?.name || id;
    return id;
  };

  const tableData = assignments.map((item: any) => ({
    ...item,
    priceListName: item.pricelistid?.name,
    targetName: getTargetName(item.targettype, item.targetid),
    status: item.status ? "Active" : "Inactive",
  }));

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.pricelistid || !formData.targetid) return alert("All fields are required");

    try {
      await createPriceAssignment({
        variables: {
          input: {
            ...formData,
            priority: parseInt(formData.priority.toString()),
            status: true,
          },
        },
      });
      dispatch(showMessage({ message: "Assignment created successfully", type: "success" }));
      setIsAdding(false);
      refetch();
    } catch (error) {
      console.error(error);
      dispatch(showMessage({ message: "Error creating assignment", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Price Assignments</h2>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)}>+ New Assignment</Button>
          )}
        </div>

        {isAdding && (
          <div className="bg-white p-6 rounded-xl border shadow-sm mb-8">
            <h3 className="font-semibold mb-4">Create New Pricing Assignment</h3>
            <form onSubmit={handleAddAssignment} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
                ]}
                value={formData.targettype}
                onChange={(e) => setFormData({ ...formData, targettype: e.target.value, targetid: "" })}
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
                  label="Select Customer"
                  type="select"
                  options={accounts.filter((a: any) => a.type === "customer").map((a: any) => ({ value: a.id, label: a.name }))}
                  value={formData.targetid}
                  onChange={(e) => setFormData({ ...formData, targetid: e.target.value })}
                  required
                  searchable
                />
              ) : (
                <FormField
                  label="Region Name"
                  type="text"
                  value={formData.targetid}
                  onChange={(e) => setFormData({ ...formData, targetid: e.target.value })}
                  required
                />
              )}
              <div className="flex gap-2">
                <Button type="submit">Save</Button>
                <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        <DataTable
          columns={columns}
          data={tableData}
          showAdd={false}
          showEdit={false}
          showDelete={true}
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
