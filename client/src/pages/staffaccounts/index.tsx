import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useOptInOn } from "../../hooks/useoptin";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useStaffPageQuery,
  useStaffMutations,
} from "../../graphql/hooks/staffaccounts";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import FormField from "../../components/formfiled";
import { FormDensityContext } from "../../components/formpage/density";
import FormSwitch from "../../components/formswitch";

import {
  FaEnvelope,
  FaMobileAlt,
  FaUser,
  FaHome,
  FaPercent,
  FaBullseye,
  FaMoneyBillWave,
  FaPlus,
  FaTrashRestore,
} from "react-icons/fa";

import { useImageUpload } from "../../graphql/hooks/uploads";
import { useAccountGroupsQuery } from "../../graphql/hooks/accountgroups";

import { useChannelsQuery } from "../../graphql/hooks/channels";
import { useAccessRolesQuery, useDepartmentsQuery } from "../../graphql/hooks/accessroles";
import { selectModuleActions } from "../../redux/slices/permissions";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { fieldOn } from "../../hooks/useformmode";

// Columns the server can filter (Seq Number is per page).
const SERVER_FILTER_KEYS = ["name", "mobile", "email", "salary", "commission", "target", "accountgroupname", "role", "status"];

const EMPTY_DOCTOR = { isdoctor: false, specialization: "", qualification: "", regno: "", experience: "" as any, fee: "" as any, about: "", online: true };

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
  departmentid: string;
  accessroleid: string;
};

// Staff types follow Business Modules: Salesman needs Sales Order or Sales Routes,
// Delivery Boy needs the Delivery report or delivery-boy mode. A saved type always stays.
const staffTypeOptions = (modules: string[] | null | undefined, deliveryMode: string | undefined, current: string) => {
  const on = (id: string) => !Array.isArray(modules) || modules.map((m) => String(m).toLowerCase()).includes(id);
  return [
    { label: "Staff", value: "staff" },
    ...(on("salesorder") || on("salesroutes") || current === "salesman" ? [{ label: "Salesman", value: "salesman" }] : []),
    ...(on("reports.delivery") || deliveryMode === "deliveryboy" || current === "deliveryboy" ? [{ label: "Delivery Boy", value: "deliveryboy" }] : []),
  ];
};

const StaffAccounts = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "staffaccounts"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Alt+N saves the form, like Add New on other lists (⌥N on a Mac types "˜", so match the key position).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.code !== "KeyN" && e.key !== "˜")) return;
      e.preventDefault();
      e.stopPropagation();
      formRef.current?.requestSubmit();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const { type, admin, branch } = useAppSelector((state: any) => state.auth);
  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? branch?.admin?.id
      : undefined;

  const branchId = useAppSelector((state: any) => state.selectedBranch.branchId);

  const staffFormPermissions = useAppSelector((state: any) => state.permissions.permissions?.formPermissions?.staffaccounts || {});
  const isFieldEnabled = (fieldId: string) => {
    return fieldOn(staffFormPermissions, fieldId, isEditing ? "edit" : "add");
  };

  // One page from the server.
  const table = useServerTable("staffaccounts", SERVER_FILTER_KEYS);
  const { items: staffList, total, loading, refetch } = useStaffPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const { addStaffMutation, editStaffMutation, deleteStaffMutation } =
    useStaffMutations();

  // Account Groups & Ledgers
  const { data: accountGroupData } = useAccountGroupsQuery();
  const accountGroupList = accountGroupData?.getAccountGroups || [];

  const { data: channelData } = useChannelsQuery(adminId);
  const channelList = channelData?.getChannels || [];

  // Tally-style: auto-resolve "Staff Account" group (server also auto-creates it if missing)
  const staffAccountGroupId = useMemo(() => {
    const groups = accountGroupList as any[];
    const byName = groups.find(
      (g) => g.accountgroupname?.toLowerCase() === "staff account"
    );
    if (byName) return byName.id;
    const byCategory = groups.find((g) => g.category === "expenses");
    return byCategory?.id || "";
  }, [accountGroupList]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploadImageMutation } = useImageUpload();

  const isLoading = useAppSelector((state: any) => state.loader.isLoading);
  const { data: deptData } = useDepartmentsQuery(false);
  const businessModules: string[] | null | undefined = useAppSelector((s: any) => s.auth.admin?.allowedmodules);
  const deliveryMode = useAppSelector((s: any) => s.adminsettings.settings?.deliveryMode);
  const { data: roleData } = useAccessRolesQuery(false);

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
    departmentid: "",
    accessroleid: "",
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  // Clinic: doctor profile for this staff member.
  const clinicOn = useOptInOn("prescriptions");
  const [doctor, setDoctor] = useState<any>(EMPTY_DOCTOR);
  const [wasDoctor, setWasDoctor] = useState(false);
  const setDoc = (k: string, v: any) => setDoctor((d: any) => ({ ...d, [k]: v }));
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingRole = editingId ? String(staffList.find((r: any) => r.id === editingId)?.role || "").toLowerCase() : "";

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

  // VALIDATION (PASSWORD NOT REQUIRED WHILE EDITING)
  const validateForm = useCallback(() => {
    const errors: any = {};

    if (!formValues.name.trim()) errors.name = "Name is required";
    if (!formValues.mobile.trim()) errors.mobile = "Mobile is required";
    if (!formValues.email.trim()) errors.email = "Email is required";

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
      departmentid: row.departmentid || "",
      accessroleid: row.accessroleid || "",
    });
    setDoctor(row.doctor ? { ...EMPTY_DOCTOR, ...row.doctor, isdoctor: true, experience: row.doctor.experience ?? "", fee: row.doctor.fee ?? "", online: row.doctor.online !== false } : EMPTY_DOCTOR);
    setWasDoctor(!!row.doctor);

    setIsEditing(true);
    setEditingId(row.id);
  }, [branchId]);

  // Auto-set account group for new staff when group data loads
  useEffect(() => {
    if (isEditing) return;
    if (staffAccountGroupId) {
      setFormValues((prev) => ({ ...prev, accountgroupid: staffAccountGroupId }));
    }
  }, [staffAccountGroupId, isEditing]);

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
      departmentid: formValues.departmentid || null,
      accessroleid: formValues.accessroleid || null,
    };
    if (clinicOn && doctor.isdoctor) {
      const num = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));
      payload.doctor = { specialization: doctor.specialization || null, qualification: doctor.qualification || null, regno: doctor.regno || null,
        experience: num(doctor.experience), fee: num(doctor.fee), about: doctor.about || null, online: doctor.online !== false };
    } else if (clinicOn && wasDoctor) {
      payload.doctor = null;
    }

    // Password only included if user typed something
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

      resetForm();
    } catch (err) {
      dispatch(
        showMessage({
          message: "Failed to save staff.",
          type: "error",
        })
      );
    }

    dispatch(hideLoading());
  }, [formValues, selectedFile, isEditing, editingId, doctor, wasDoctor, clinicOn]);

  // Empty form with the staff account group pre-filled.
  function resetForm() {
    setFormValues({
      branchid: branchId || "",
      accountgroupid: staffAccountGroupId,
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
      departmentid: "",
      accessroleid: "",
    });
    setDoctor(EMPTY_DOCTOR);
    setWasDoctor(false);
    setFormErrors({});
    setSelectedFile(null);
    setIsEditing(false);
    setEditingId(null);
  }

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
      seqNo: table.offset + i + 1,
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
      <div className="w-full space-y-3 p-4">
        {/* Quick add / edit card — compact, Enter saves (Tally style) */}
        <FormDensityContext.Provider value="compact">
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit();
          }}
          className="rounded-lg border border-slate-200 bg-white"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {isEditing ? `Edit staff${formValues.name ? ` — ${formValues.name}` : ""}` : "Add staff"}
            </h2>
            <div className="ml-auto flex items-center gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/staffaccounts/deletedentries")}
                title="Deleted entries"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <FaTrashRestore className="text-rose-500" /> Deleted
              </button>
              <button
                type="submit"
                title={`${isEditing ? "Update" : "Add"} staff (Enter or Alt+N)`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                {!isEditing && <FaPlus className="text-[10px]" />}
                {isEditing ? "Update Staff" : "Add Staff"}
                <kbd className="ml-1 rounded border border-white/40 px-1 text-[10px] font-medium leading-4 text-white/80">Alt+N</kbd>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {/* Name */}
            {isFieldEnabled("name") && (
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
            )}

            {/* Mobile */}
            {isFieldEnabled("mobile") && (
              <FormField
              label="Mobile"
              name="mobile"
              type="text"
              value={formValues.mobile}
              onChange={(e) => handleFormChange("mobile", e.target.value)}
              error={formErrors.mobile}
              icon={<FaMobileAlt />}
              />
            )}

            {/* Email */}
            {isFieldEnabled("email") && (
              <FormField
              label="Email"
              name="email"
              type="email"
              value={formValues.email}
              onChange={(e) => handleFormChange("email", e.target.value)}
              error={formErrors.email}
              icon={<FaEnvelope />}
              />
            )}

            {/* Password */}
            {isFieldEnabled("password") && (
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
              />
            )}

            {/* Role SELECT */}
            {isFieldEnabled("role") && (
              <FormField
              label="Role"
              name="role"
              type="select"
              value={formValues.role}
              onChange={(e) => handleFormChange("role", e.target.value)}
              error={formErrors.role}
              options={staffTypeOptions(businessModules, deliveryMode, editingRole)}
              searchable={false}
            />
            )}

            {/* Account Group — auto-selected as "Staff Account", can be overridden */}
            {isFieldEnabled("accountgroupid") && (
              // The "auto-selected" hint is a tooltip.
              <div title="Auto-selected (Staff Account) — change if needed">
              <FormField
                label="Account Group"
                name="accountgroupid"
                type="select"
                value={formValues.accountgroupid}
                onChange={(e) => handleFormChange("accountgroupid", e.target.value)}
                error={formErrors.accountgroupid}
                options={(accountGroupList as any[]).map((group: any) => ({
                  label: group.accountgroupname,
                  value: group.id,
                }))}
                searchable
              />
            </div>
            )}

            {/* Salary */}
            {isFieldEnabled("salary") && (
              <FormField
              label="Salary"
              name="salary"
              type="number"
              value={formValues.salary}
              onChange={(e) => handleFormChange("salary", e.target.value)}
              icon={<FaMoneyBillWave />}
              error={formErrors.salary}
              />
            )}

            {/* Commission */}
            {isFieldEnabled("commission") && (
              <FormField
              label="Commission"
              name="commission"
              type="number"
              value={formValues.commission}
              onChange={(e) => handleFormChange("commission", e.target.value)}
              icon={<FaPercent />}
              error={formErrors.commission}
              />
            )}

            {/* Target */}
            {isFieldEnabled("target") && (
              <FormField
              label="Target Amount"
              name="target"
              type="number"
              value={formValues.target}
              onChange={(e) => handleFormChange("target", e.target.value)}
              icon={<FaBullseye />}
              />
            )}

            {/* Address */}
            {isFieldEnabled("address") && (
              <FormField
              label="Address"
              name="address"
              type="text"
              value={formValues.address}
              onChange={(e) => handleFormChange("address", e.target.value)}
              icon={<FaHome />}
              />
            )}

            {/* Department and access role (Settings -> Departments / Access Roles) */}
            <FormField
              label="Department"
              name="departmentid"
              type="select"
              value={formValues.departmentid}
              onChange={(e) => handleFormChange("departmentid", e.target.value)}
              options={(deptData?.getDepartments || []).map((d: any) => ({ label: d.name, value: d.id }))}
              searchable
              placeholder="No department"
            />
            <FormField
              label="Access Role"
              name="accessroleid"
              type="select"
              value={formValues.accessroleid}
              onChange={(e) => handleFormChange("accessroleid", e.target.value)}
              options={(roleData?.getAccessRoles || []).map((r: any) => ({ label: r.name, value: r.id }))}
              searchable
              placeholder="No role"
            />

            {/* Assigned Channels (Only for Salesman) */}
            {isFieldEnabled("assignedChannels") && formValues.role === "salesman" && (
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

            {clinicOn && formValues.role === "staff" && (
              <div className="col-span-full rounded-lg border border-slate-200 p-3 space-y-3">
                <FormSwitch label="This staff member is a Doctor" name="isdoctor" checked={!!doctor.isdoctor} onChange={(v) => setDoc("isdoctor", !!v)} />
                {doctor.isdoctor && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField label="Specialization" name="specialization" type="text" value={doctor.specialization || ""} placeholder="General Physician" onChange={(e) => setDoc("specialization", e.target.value)} />
                    <FormField label="Qualification" name="qualification" type="text" value={doctor.qualification || ""} placeholder="MBBS, MD" onChange={(e) => setDoc("qualification", e.target.value)} />
                    <FormField label="Registration No." name="regno" type="text" value={doctor.regno || ""} onChange={(e) => setDoc("regno", e.target.value)} />
                    <FormField label="Experience (Years)" name="experience" type="number" value={doctor.experience} onChange={(e) => setDoc("experience", e.target.value)} />
                    <FormField label="Consultation Fee (₹)" name="fee" type="number" value={doctor.fee} placeholder="Service rate" onChange={(e) => setDoc("fee", e.target.value)} />
                    <div className="sm:col-span-2"><FormField label="About" name="about" type="text" value={doctor.about || ""} onChange={(e) => setDoc("about", e.target.value)} /></div>
                    <FormSwitch label="Show for Online Booking" name="doctoronline" checked={doctor.online !== false} onChange={(v) => setDoc("online", !!v)} />
                  </div>
                )}
              </div>
            )}

            {/* Profile Picture */}
            {isFieldEnabled("profilepicture") && (
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
            )}

            {/* Status */}
            {isFieldEnabled("status") && (
              <FormSwitch
                label="Status"
                name="status"
                checked={Boolean(formValues.status)}
                onChange={(checked) => handleFormChange("status", checked)}
              />
            )}
          </div>
        </form>
        </FormDensityContext.Provider>

        <DataTable
          title="Manage Staff Accounts"
          columns={columns}
          data={tableData}
          {...actions}
          // Inline form replaces the Add button here.
          showAdd={false}
          onView={(row: any) => navigate(`/staffaccounts/view/${row.id}`)}
          onEdit={handleEdit}
          onDelete={async (row: any) => {
            if (window.confirm(`Are you sure you want to delete staff "${row.name}"?`)) {
              await deleteStaffMutation({ variables: { id: row.id } });
              dispatch(showMessage({ message: "Staff deleted successfully.", type: "success" }));
              await refetch();
            }
          }}
          // Deleted sits on the form header above.
          showDeleted={false}
          onImport={() => fileInputRef.current?.click()}
          serverPaging={serverPaging}
          isLoading={loading || isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default StaffAccounts;
