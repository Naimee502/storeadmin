import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import LoginLayout from "../../../layouts/login";
import DataTable from "../../../components/datatable";
import Modal from "../../../components/modal";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAdminsQuery, useDeleteAdminMutation, useUpdateAdminMutation } from "../../../graphql/hooks/admin";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";
import { selectModuleActions } from "../../../redux/slices/permissions";

const AdminList = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "adminregister"));
  const { data, refetch } = useAdminsQuery();
  const [updateAdminMutation] = useUpdateAdminMutation();
  const [deleteAdminMutation] = useDeleteAdminMutation(); 
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  let adminList = data?.getAdmins || [];

  // Edit-form shape mirrors the Admin Register form exactly. Note that
  // legacy `isMultibranch` / `isChannelCustomers` flags were intentionally
  // dropped — they aren't on the register page so they don't belong here.
  // Allowed Modules is intentionally NOT part of this form — module
  // allowance is managed from Business Settings, not the admin edit modal.
  const [formValues, setFormValues] = useState<{
    name: string;
    email: string;
    companyName: string;
    mobile: string;
    address: string;
    noOfBranches: number;
    subscriptionType: string;
    businesstype: string;
    status: boolean;
  }>({
    name: "",
    email: "",
    companyName: "",
    mobile: "",
    address: "",
    noOfBranches: 1,
    subscriptionType: "monthly",
    businesstype: "retail",
    status: true,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

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
    // The row passed in here has been capitalised for display. Look up the
    // raw record from the GraphQL response so we don't write display-cased
    // values back to the database on save.
    const raw =
      adminList.find((a: any) => a.id === row.id) || row;

    setFormValues({
      name: raw.name || "",
      email: raw.email || "",
      companyName: raw.companyName || "",
      mobile: raw.mobile || "",
      address: raw.address || "",
      noOfBranches: Number(raw.noOfBranches) || 1,
      subscriptionType: raw.subscriptionType || "monthly",
      businesstype: raw.businesstype || "retail",
      status: typeof raw.status === "boolean" ? raw.status : true,
    });
    setEditingId(raw.id);
    setIsEditing(true);
    setEditModalOpen(true);
  };

  const closeEdit = () => {
    setEditModalOpen(false);
    setIsEditing(false);
    setEditingId(null);
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
          input: { ...formValues },
        },
      });
      dispatch(showMessage({ message: "Admin updated successfully", type: "success" }));
      setIsEditing(false);
      setEditingId(null);
      setEditModalOpen(false);
      setFormValues({
        name: "",
        email: "",
        companyName: "",
        mobile: "",
        address: "",
        noOfBranches: 1,
        subscriptionType: "monthly",
        businesstype: "retail",
        status: true,
      });
      await refetch();
    } catch (err) {
      dispatch(showMessage({ message: "Failed to update admin", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  // Columns mirror the fields on the Admin Register form so the list view
  // is consistent with what was captured at sign-up.
  const columns = [
    { label: "Seq No", key: "seqNo" },
    { label: "Admin Code", key: "admincode" },
    { label: "Company", key: "companyName" },
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Mobile", key: "mobile" },
    { label: "Branches", key: "noOfBranches" },
    { label: "Subscription", key: "subscriptionType" },
    { label: "Business Type", key: "businesstype" },
  ];

  // Capitalize the first letter of a string. Used so admin records show
  // "Retail" / "Monthly" / "John Doe" instead of "retail" / "monthly".
  // Email is intentionally left untouched (case-sensitive in many MTAs).
  const cap = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const tableData = adminList.map((admin: any, index: number) => ({
    ...admin,
    seqNo: index + 1,
    admincode: admin.admincode || "-",
    companyName: cap(admin.companyName),
    name: cap(admin.name),
    subscriptionType: cap(admin.subscriptionType),
    businesstype: cap(admin.businesstype),
  }));

  return (
    <LoginLayout>
      <div className="w-[95vw] max-w-7xl px-2 sm:px-4 py-2">
        <DataTable
          title="Manage Admins"
          columns={columns}
          data={tableData}
          {...actions}
          /* Super-admin page: not governed by Business Settings / Allowed
             Modules, so edit & delete are always available here. */
          showEdit={true}
          showDelete={true}
          showDeleted={true}
          showView={false}
          showImport={false}
          showExport={false}
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
          isLoading={isLoading}
        />

        {/* Edit modal — mirrors the Admin Register form so editing an admin
            uses the same grouped Allowed Modules checklist (catalog from
            config/modules.ts), business type, subscription, and toggles. */}
        <Modal
          isOpen={editModalOpen}
          onClose={closeEdit}
          type="custom"
          title={`Edit Admin${formValues.name ? ` — ${formValues.name}` : ""}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Row 1: Company Name + Name (matches register form Row 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Company Name"
                name="companyName"
                value={formValues.companyName}
                onChange={(e: any) =>
                  handleFormChange("companyName", e.target.value)
                }
                required
              />
              <FormField
                label="Name"
                name="name"
                value={formValues.name}
                onChange={(e: any) => handleFormChange("name", e.target.value)}
                required
              />
            </div>

            {/* Row 2: Mobile + Email (matches register form Row 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Mobile Number"
                name="mobile"
                value={formValues.mobile}
                onChange={(e: any) => handleFormChange("mobile", e.target.value)}
                required
              />
              <FormField
                label="Email"
                type="email"
                name="email"
                value={formValues.email}
                onChange={(e: any) => handleFormChange("email", e.target.value)}
                required
              />
            </div>

            {/* Address — shown on the Sales Invoice print header */}
            <FormField
              label="Address"
              name="address"
              value={formValues.address}
              onChange={(e: any) => handleFormChange("address", e.target.value)}
              multiline
            />

            {/* Row 3: No of Branches + Subscription + Business Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                label="No. of Branches"
                type="number"
                name="noOfBranches"
                value={formValues.noOfBranches}
                onChange={(e: any) =>
                  handleFormChange("noOfBranches", Number(e.target.value) || 1)
                }
              />
              <FormField
                label="Subscription"
                name="subscriptionType"
                type="select"
                value={formValues.subscriptionType}
                onChange={(e: any) =>
                  handleFormChange("subscriptionType", e.target.value)
                }
                options={[
                  { label: "Monthly", value: "monthly" },
                  { label: "Yearly", value: "yearly" },
                  { label: "Lifetime", value: "lifetime" },
                ]}
              />
              <FormField
                label="Business Type"
                name="businesstype"
                type="select"
                value={formValues.businesstype}
                onChange={(e: any) =>
                  handleFormChange("businesstype", e.target.value)
                }
                options={[
                  { label: "Retail", value: "retail" },
                  { label: "Wholesale", value: "wholesale" },
                  { label: "Manufacturer", value: "manufacturer" },
                  { label: "Service", value: "service" },
                  { label: "Trader", value: "trader" },
                  { label: "Other", value: "other" },
                ]}
              />
            </div>

            {/* Active toggle — only flag the register form keeps. The
                `isMultibranch` and `isChannelCustomers` legacy flags were
                removed because they don't exist on the register page. */}
            <div className="flex flex-wrap gap-6">
              <FormSwitch
                label="Active"
                name="status"
                checked={formValues.status}
                onChange={(v) => handleFormChange("status", v)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleFormSubmit}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </LoginLayout>
  );
};

export default AdminList;
