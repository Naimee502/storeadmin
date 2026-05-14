import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import HomeLayout from "../../../layouts/home";
import DataTable from "../../../components/datatable";
import Modal from "../../../components/modal";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAdminsQuery, useDeleteAdminMutation, useUpdateAdminMutation } from "../../../graphql/hooks/admin";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";
import { ADMIN_REGISTER_MODULES, SECTION_LABELS, findModule } from "../../../config/modules";
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
  const [formValues, setFormValues] = useState<{
    name: string;
    email: string;
    companyName: string;
    mobile: string;
    noOfBranches: number;
    subscriptionType: string;
    businesstype: string;
    allowedmodules: string[];
    status: boolean;
  }>({
    name: "",
    email: "",
    companyName: "",
    mobile: "",
    noOfBranches: 1,
    subscriptionType: "monthly",
    businesstype: "retail",
    allowedmodules: [],
    status: true,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // All catalog module ids — used for "Select all" + as the source for
  // the grouped checklist, identical to the Admin Register page.
  const allModules = ADMIN_REGISTER_MODULES.map((m) => m.id);

  const handleModuleToggle = (module: string) => {
    setFormValues((prev) => ({
      ...prev,
      allowedmodules: prev.allowedmodules.includes(module)
        ? prev.allowedmodules.filter((m) => m !== module)
        : [...prev.allowedmodules, module],
    }));
  };

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
      noOfBranches: Number(raw.noOfBranches) || 1,
      subscriptionType: raw.subscriptionType || "monthly",
      businesstype: raw.businesstype || "retail",
      allowedmodules: Array.isArray(raw.allowedmodules) ? raw.allowedmodules : [],
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
        noOfBranches: 1,
        subscriptionType: "monthly",
        businesstype: "retail",
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

  // Columns mirror the fields on the Admin Register form so the list view
  // is consistent with what was captured at sign-up.
  const columns = [
    { label: "Seq No", key: "seqNo" },
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
    companyName: cap(admin.companyName),
    name: cap(admin.name),
    subscriptionType: cap(admin.subscriptionType),
    businesstype: cap(admin.businesstype),
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Admins"
          columns={columns}
          data={tableData}
          {...actions}
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

            {/* Allowed Modules — grouped by section, identical to register page */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Allowed Modules
                </label>
                <div className="flex gap-3 text-[11px]">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() =>
                      handleFormChange("allowedmodules", allModules)
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => handleFormChange("allowedmodules", [])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="border p-3 rounded bg-gray-50 max-h-72 overflow-y-auto shadow-inner space-y-3">
                {Object.entries(
                  ADMIN_REGISTER_MODULES.reduce<
                    Record<string, typeof ADMIN_REGISTER_MODULES>
                  >((acc, m) => {
                    (acc[m.section] ||= [] as any).push(m);
                    return acc;
                  }, {})
                ).map(([section, items]) => (
                  <div key={section}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {items.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center space-x-2 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formValues.allowedmodules.includes(m.id)}
                            onChange={() => handleModuleToggle(m.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span
                            className="truncate select-none"
                            title={`${m.label} (${m.id})`}
                          >
                            {findModule(m.id)?.label || m.id}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
    </HomeLayout>
  );
};

export default AdminList;
