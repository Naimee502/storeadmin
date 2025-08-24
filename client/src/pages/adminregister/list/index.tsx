import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import HomeLayout from "../../../layouts/home";
import DataTable from "../../../components/datatable";
import { useAdminsQuery, useDeleteAdminMutation, useUpdateAdminMutation } from "../../../graphql/hooks/admin";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";

const AdminList = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data, refetch } = useAdminsQuery();
  const [updateAdminMutation] = useUpdateAdminMutation();
  const [deleteAdminMutation] = useDeleteAdminMutation(); 
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  let adminList = data?.getAdmins || [];

  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    subscriptionType: "monthly",
    businesstype: "retail",
    isMultibranch: false,
    isChannelCustomers: false,
    allowedmodules: [],
    status: true,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
      const fetchAndDispatch = async () => {
        dispatch(showLoading());
        try {
          const { data } = await refetch();
          if (data?.getAdmins) {
            adminList=data?.getAdmins;
          }
        } catch (error) {
          console.error("Error fetching brands:", error);
        } finally {
          dispatch(hideLoading());
        }
      };
  
      fetchAndDispatch();
    }, [dispatch, refetch]);

  const handleEdit = (row: any) => {
    console.log("EDIT ADMIN>>", JSON.stringify(row,null,2))
    setFormValues({
      name: row.name,
      email: row.email,
      subscriptionType: row.subscriptionType,
      businesstype: row.businesstype,
      isMultibranch: row.isMultibranch === true || row.isMultibranch === "Yes",
      isChannelCustomers: row.isChannelCustomers === true || row.isChannelCustomers === "Yes",
      allowedmodules: row.allowedmodules,
      status: typeof row.status === "boolean" ? row.status : true,
    });
    setEditingId(row.id);
    setIsEditing(true);
  };

  const handleFormChange = (name: string, value: string | boolean | string[]) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async () => {
    if (!formValues.name || !formValues.email) {
      dispatch(showMessage({ message: "Name and Email are required", type: "error" }));
      return;
    }
    dispatch(showLoading());
    try {
      await updateAdminMutation({
        variables: {
          id: editingId,
          input: {
            ...formValues,
            isMultibranch: !!formValues.isMultibranch,
            isChannelCustomers: !!formValues.isChannelCustomers,
          },
        },
      });
      dispatch(showMessage({ message: "Admin updated successfully", type: "success" }));
      setIsEditing(false);
      setEditingId(null);
      setFormValues({
        name: "",
        email: "",
        subscriptionType: "monthly",
        businesstype: "retail",
        isMultibranch: false,
        isChannelCustomers: false,
        allowedmodules: [],
        status: true,
      });
      await refetch();
    } catch (err) {
      dispatch(showMessage({ message: "Failed to update admin", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Subscription Type", key: "subscriptionType" },
    { label: "Business Type", key: "businesstype" },
    { label: "Multibranch", key: "isMultibranch" },
    { label: "Channel Customers", key: "isChannelCustomers" },
  ];

  const tableData = adminList.map((admin: any, index: number) => ({
    ...admin,
    seqNo: index + 1,
    isMultibranch: admin.isMultibranch ? "Yes" : "No",
    isChannelCustomers: admin.isChannelCustomers ? "Yes" : "No",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Admins"
          columns={columns}
          data={tableData}
          showView={false}
          showImport={false}
          showExport={false}
          showEdit={true}
          showDelete={true}
          showAdd={false}
          onEdit={handleEdit}
          onAdd={() => navigate("/adminregister")}
          onShowDeleted={() =>navigate("/adminregister/deletedentries")}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete admin "${row.name}"?`)) {
              try {
                await deleteAdminMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Admin deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete admin.", type: "error" }));
              }
            }
          }}
          formFields={[
            { name: "name", label: "Name", type: "text", placeholder: "Enter name" },
            { name: "email", label: "Email", type: "text", placeholder: "Enter email" },
            {
              name: "subscriptionType",
              label: "Subscription",
              type: "select",
              options: [
                { label: "Monthly", value: "monthly" },
                { label: "Yearly", value: "yearly" },
              ],
            },
            {
              name: "businesstype",
              label: "Business Type",
              type: "select",
              options: [
                { label: "Retail", value: "retail" },
                { label: "Wholesale", value: "wholesale" },
                { label: "Manufacturer", value: "manufacturer" },
                { label: "Service", value: "service" },
                { label: "Trader", value: "trader" },
                { label: "Other", value: "other" },
              ],
            },
            {
              name: "isMultibranch",
              label: "Is Multibranch",
              type: "checkbox",
            },
            {
              name: "isChannelCustomers",
              label: "Channel Customers",
              type: "checkbox",
            },
          ]}
          formValues={formValues}
          onFormChange={handleFormChange}
          onFormSubmit={handleFormSubmit}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default AdminList;
