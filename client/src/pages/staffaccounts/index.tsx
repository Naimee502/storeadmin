import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useStaffQuery,
  useStaffMutations,
} from "../../graphql/hooks/staffaccounts";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addStaff } from "../../redux/slices/staffaccounts"; // reducer name unchanged
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import FormSwitch from "../../components/formswitch";

import {
  FaEnvelope,
  FaMobileAlt,
  FaUser,
  FaHome,
  FaPercent,
  FaBullseye,
  FaMoneyBillWave,
} from "react-icons/fa";

import { useImageUpload } from "../../graphql/hooks/uploads";
import { useAccountLedgersQuery } from "../../graphql/hooks/accountledgers";
import { useAccountGroupsQuery } from "../../graphql/hooks/accountgroups";

import { useChannelsQuery } from "../../graphql/hooks/channels";
import { selectModuleActions } from "../../redux/slices/permissions";

type FormValues = {
  branchid: string;
  accountgroupid: string;
  name: string;
  mobile: string;
  email: string;
  password: string;
  profilepicture: string;
  imageurl: string;
  address: string;
  salary: number | "";
  commission: number | "";
  target: number | "";
  status: boolean;
  role: string; 
  assignedChannels: string[];
};

const StaffAccounts = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "staffaccounts"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { type, admin, branch } = useAppSelector((state: any) => state.auth);
  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? branch?.admin?.id
      : undefined;

  const branchId = useAppSelector((state: any) => state.selectedBranch.branchId);

  // HOOKS UPDATED
  const { data, refetch } = useStaffQuery();
  const { addStaffMutation, editStaffMutation, deleteStaffMutation } =
    useStaffMutations();

  // Account Groups & Ledgers
  const { data: accountGroupData } = useAccountGroupsQuery();
  const accountGroupList = accountGroupData?.getAccountGroups || [];

  const { data: channelData } = useChannelsQuery(adminId);
  const channelList = channelData?.getChannels || [];

  const staffList = data?.getStaffAccounts || [];

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploadImageMutation } = useImageUpload();

  const isLoading = useAppSelector((state: any) => state.loader.isLoading);

  const [formValues, setFormValues] = useState<FormValues>({
    branchid: branchId || "",
    accountgroupid: "",
    name: "",
    mobile: "",
    email: "",
    password: "",
    profilepicture: "",
    imageurl: "",
    address: "",
    salary: "",
    commission: "",
    target: "",
    status: true,
    role: "staff", 
    assignedChannels: [],
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = useCallback((name, value) => {
    setFormValues((prev) => ({
      ...prev,
      [name]:
        name === "commission" ||
        name === "target" ||
        name === "salary"
          ? value === ""
            ? ""
            : Number(value)
          : value,
    }));
  }, []);

  // ===== VALIDATION (PASSWORD NOT REQUIRED WHILE EDITING) =====
  const validateForm = useCallback(() => {
    const errors: any = {};

    if (!formValues.name.trim()) errors.name = "Name is required";
    if (!formValues.mobile.trim()) errors.mobile = "Mobile is required";
    if (!formValues.email.trim()) errors.email = "Email is required";
    if (!formValues.accountgroupid.trim())
      errors.accountgroupid = "Account group is required";

    // role required
    if (!formValues.role || !formValues.role.trim())
      errors.role = "Role is required";

    // Password required only for ADD
    if (!isEditing && !formValues.password.trim())
      errors.password = "Password is required";

    if (formValues.commission === "" && !isEditing)
      errors.commission = "Commission is required";

    if (formValues.salary === "" && !isEditing)
      errors.salary = "Salary is required";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formValues, isEditing]);

  // LOAD INTO FORM WHILE EDIT
  const handleEdit = useCallback((row: any) => {
    setFormValues({
      branchid: row.branchid?.id || branchId || "",
      accountgroupid: row.accountgroupid?.id || "",
      name: row.name || "",
      mobile: row.mobile || "",
      email: row.email || "",
      password: "", // not shown while editing
      profilepicture: "",
      imageurl: row.imageurl || "",
      address: row.address || "",
      salary: row.salary || 0,
      commission: row.commission || 0,
      target: row.target || 0,
      status: Boolean(row.status),
      role: row.role?.toLowerCase() || "staff", // <-- load existing role (lowercase to match select options)
      assignedChannels: row.assignedChannels?.map((c: any) => c.id) || [],
    });

    setIsEditing(true);
    setEditingId(row.id);
  }, [branchId]);

  useEffect(() => {
    const fn = async () => {
      dispatch(showLoading());
      await refetch();
      if (data?.getStaffAccounts) {
        dispatch(addStaff(data.getStaffAccounts)); // reducer name unchanged
      }
      dispatch(hideLoading());
    };

    fn();
  }, [data?.getStaffAccounts]);

  // UPLOAD IMAGE
  const uploadProfilePicture = useCallback(async () => {
    if (!selectedFile) return null;

    const { data } = await uploadImageMutation({
      variables: { file: selectedFile },
    });

    return data?.uploadImage?.url || null;
  }, [selectedFile]);

  // SUBMIT
  const handleFormSubmit = useCallback(async () => {
    if (!validateForm()) return;

    dispatch(showLoading());

    let uploadedUrl = formValues.imageurl || "";

    if (selectedFile) {
      const url = await uploadProfilePicture();
      if (url) uploadedUrl = url;
    }

    // main payload
    const payload: any = {
      branchid: formValues.branchid || branchId || null,
      accountgroupid: formValues.accountgroupid,
      name: formValues.name,
      mobile: formValues.mobile,
      email: formValues.email,
      imageurl: uploadedUrl,
      address: formValues.address,
      salary: Number(formValues.salary) || 0,
      commission: Number(formValues.commission) || 0,
      target: Number(formValues.target) || 0,
      status: Boolean(formValues.status),
      admin: adminId,
      role: formValues.role, // <-- include role in payload
      assignedChannels: formValues.role === 'salesman' ? formValues.assignedChannels : [],
    };

    // 🔥 Password only included if user typed something
    if (!isEditing && formValues.password.trim() !== "") {
      payload.password = formValues.password;
    } else if (isEditing && formValues.password.trim() !== "") {
      payload.password = formValues.password; // updating password
    }

    try {
      if (isEditing && editingId) {
        await editStaffMutation({
          variables: { id: editingId, input: payload },
        });

        dispatch(showMessage({ message: "Staff updated.", type: "success" }));
      } else {
        await addStaffMutation({ variables: { input: payload } });
        dispatch(showMessage({ message: "Staff added.", type: "success" }));
      }

      await refetch();

      // reset form
      setFormValues({
        branchid: branchId || "",
        accountgroupid: "",
        name: "",
        mobile: "",
        email: "",
        password: "",
        profilepicture: "",
        imageurl: "",
        address: "",
        salary: "",
        commission: "",
        target: "",
        status: true,
        role: "staff",
        assignedChannels: [],
      });

      setSelectedFile(null);
      setIsEditing(false);
      setEditingId(null);
    } catch (err) {
      dispatch(
        showMessage({
          message: "Failed to save staff.",
          type: "error",
        })
      );
    }

    dispatch(hideLoading());
  }, [formValues, selectedFile, isEditing, editingId]);

  // TABLE COLUMNS
  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Name", key: "name" },
    { label: "Mobile", key: "mobile" },
    { label: "Email", key: "email" },
    { label: "Salary", key: "salary" },
    { label: "Commission", key: "commission" },
    { label: "Target", key: "target" },
    { label: "Account Group", key: "accountgroupname" },
    { label: "Role", key: "role" }, 
    { label: "Status", key: "status" },
  ];

  const tableData = staffList.map((s: any, i: number) => {
    const role = s.role
      ? s.role.charAt(0).toUpperCase() + s.role.slice(1)
      : "Staff";

    return {
      ...s,
      seqNo: i + 1,
      salary: s.salary?.toFixed(2),
      commission: s.commission?.toFixed(2),
      target: s.target?.toFixed(2),
      accountgroupname: s.accountgroupid?.accountgroupname || "-",
      role,
      status: s.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Name */}
            <FormField
              label="Name"
              name="name"
              type="text"
              value={formValues.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              error={formErrors.name}
              icon={<FaUser />}
              placeholder="Enter full name"
            />

            {/* Mobile */}
            <FormField
              label="Mobile"
              name="mobile"
              type="text"
              value={formValues.mobile}
              onChange={(e) => handleFormChange("mobile", e.target.value)}
              error={formErrors.mobile}
              icon={<FaMobileAlt />}
              placeholder="Enter mobile number"
            />

            {/* Email */}
            <FormField
              label="Email"
              name="email"
              type="email"
              value={formValues.email}
              onChange={(e) => handleFormChange("email", e.target.value)}
              error={formErrors.email}
              icon={<FaEnvelope />}
              placeholder="Enter email address"
            />

            {/* Password */}
            <FormField
              label={
                isEditing
                  ? "New Password (leave blank to keep current)"
                  : "Password"
              }
              name="password"
              type="password"
              value={formValues.password}
              onChange={(e) => handleFormChange("password", e.target.value)}
              error={formErrors.password}
              placeholder={isEditing ? "Enter new password" : "Enter password"}
            />

            {/* Role SELECT */}
            <FormField
              label="Role"
              name="role"
              type="select"
              value={formValues.role}
              onChange={(e) => handleFormChange("role", e.target.value)}
              error={formErrors.role}
              options={[
                { label: "Staff", value: "staff" },
                { label: "Salesman", value: "salesman" },
                { label: "Delivery Boy", value: "deliveryboy" },
              ]}
              searchable={false}
            />

            {/* Account Groups */}
            <FormField
              label="Account Group"
              name="accountgroupid"
              type="select"
              value={formValues.accountgroupid}
              onChange={(e) => handleFormChange("accountgroupid", e.target.value)}
              error={formErrors.accountgroupid}
              options={accountGroupList?.map((group: any) => ({
                label: group.accountgroupname,
                value: group.id,
              }))}
              searchable
            />

            {/* Salary */}
            <FormField
              label="Salary"
              name="salary"
              type="number"
              value={formValues.salary}
              onChange={(e) => handleFormChange("salary", e.target.value)}
              icon={<FaMoneyBillWave />}
              error={formErrors.salary}
              placeholder="Enter fixed salary"
            />

            {/* Commission */}
            <FormField
              label="Commission"
              name="commission"
              type="number"
              value={formValues.commission}
              onChange={(e) => handleFormChange("commission", e.target.value)}
              icon={<FaPercent />}
              error={formErrors.commission}
              placeholder="Enter commission percentage or flat"
            />

            {/* Target */}
            <FormField
              label="Target Amount"
              name="target"
              type="number"
              value={formValues.target}
              onChange={(e) => handleFormChange("target", e.target.value)}
              icon={<FaBullseye />}
              placeholder="Enter sales target"
            />

            {/* Address */}
            <FormField
              label="Address"
              name="address"
              type="text"
              value={formValues.address}
              onChange={(e) => handleFormChange("address", e.target.value)}
              icon={<FaHome />}
              placeholder="Enter address"
            />

            {/* Assigned Channels (Only for Salesman) */}
            {formValues.role === "salesman" && (
              <FormField
                label="Assigned Channels"
                name="assignedChannels"
                type="multiselect"
                value={formValues.assignedChannels}
                onChange={(e) => handleFormChange("assignedChannels", e.target.value)}
                error={formErrors.assignedChannels}
                options={channelList?.map((channel: any) => ({
                  label: channel.channelName,
                  value: channel.id,
                }))}
                searchable
                placeholder="Select channels"
              />
            )}

            {/* Profile Picture */}
            <FormField
              label="Profile Picture"
              name="profilepicture"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                setFormValues((prev) => ({
                  ...prev,
                  profilepicture: file?.name || "",
                }));
              }}
              previewUrl={
                selectedFile ? URL.createObjectURL(selectedFile) : formValues.imageurl || ""
              }
            />

            {/* Status */}
            <div className="flex items-center max-w-full space-x-4 mt-4">
              <fieldset className="flex items-center space-x-2">
                <legend className="text-sm sm:text-base font-medium">Status</legend>
                <FormSwitch
                  label=""
                  name="status"
                  checked={Boolean(formValues.status)}
                  onChange={(checked) => handleFormChange("status", checked)}
                />
              </fieldset>

              <Button variant="outline" type="submit">
                { isEditing
                  ? "Update Account"
                  : "Add Account"}
              </Button>
            </div>
          </div>
        </form>

        <DataTable
          title="Manage Staff Accounts"
          columns={columns}
          data={tableData}
          {...actions}
          // Inline form replaces the Add button here.
          showAdd={false}
          showView={false}
          onEdit={handleEdit}
          onDelete={async (row: any) => {
            if (window.confirm(`Are you sure you want to delete staff "${row.name}"?`)) {
              await deleteStaffMutation({ variables: { id: row.id } });
              dispatch(showMessage({ message: "Staff deleted successfully.", type: "success" }));
              await refetch();
            }
          }}
          onShowDeleted={() => navigate("/staffaccounts/deletedentries")}
          onImport={() => fileInputRef.current?.click()}
        />
      </div>
    </HomeLayout>
  );
};

export default StaffAccounts;
