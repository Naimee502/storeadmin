import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useSalesmenQuery,
  useSalesmanMutations,
} from "../../graphql/hooks/salesmenaccount";
import { useAccountGroupsQuery } from "../../graphql/hooks/accountgroups"; // New hook to fetch account groups
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addSalesmen } from "../../redux/slices/salesmenaccount";
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
  FaUsers,
} from "react-icons/fa";
import { useImageUpload } from "../../graphql/hooks/uploads";

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
};

const SalesmenAccount = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? branch?.admin?.id
      : undefined;
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);

  const { data, refetch } = useSalesmenQuery();
  const {
    addSalesmanMutation,
    editSalesmanMutation,
    deleteSalesmanMutation,
  } = useSalesmanMutations();

  // New: Fetch account groups for dropdown
  const { data: accountGroupsData } = useAccountGroupsQuery();
  const accountGroups = accountGroupsData?.getAccountGroups || [];

  const salesmenList = data?.getSalesmenAccounts || [];
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploadImageMutation } = useImageUpload();

  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState<FormValues>({
    branchid: branchId || "",
    accountgroupid: "", // required!
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
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = useCallback(
    (name: keyof FormValues, value: string | boolean | number) => {
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
    },
    []
  );

  const validateForm = useCallback(() => {
    const errors: { [key: string]: string } = {};
    if (!formValues.name.trim()) errors.name = "Name is required";
    if (!formValues.mobile.trim()) errors.mobile = "Mobile is required";
    if (!formValues.email.trim()) errors.email = "Email is required";
    if (!formValues.accountgroupid.trim())
      errors.accountgroupid = "Account Group is required";
    if (!isEditing && !formValues.password.trim())
      errors.password = "Password is required";
    if (formValues.commission === "" && !isEditing)
      errors.commission = "Commission is required";
    if (formValues.salary === "" && !isEditing)
      errors.salary = "Salary is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formValues, isEditing]);

  const handleEdit = useCallback(
    (row: any) => {
      setFormValues({
        branchid: row.branchid || branchId || "",
        accountgroupid: row.accountgroupid?._id || "", // Assuming populated object
        name: row.name || "",
        mobile: row.mobile || "",
        email: row.email || "",
        password: "", // don't fill password on edit
        profilepicture: "",
        imageurl: row.imageurl || "",
        address: row.address || "",
        salary: row.salary || 0,
        commission: row.commission || 0,
        target: row.target || 0,
        status: Boolean(row.status),
      });
      setIsEditing(true);
      setEditingId(row.id);
    },
    [branchId]
  );

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        await refetch();
        if (data?.getSalesmenAccounts) {
          dispatch(addSalesmen(data.getSalesmenAccounts));
        }
      } catch (error) {
        console.error("Error fetching salesmen:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
  }, [dispatch, refetch, data?.getSalesmenAccounts]);

  const uploadProfilePicture = useCallback(async (): Promise<string | null> => {
    if (!selectedFile) return null;
    try {
      const { data } = await uploadImageMutation({
        variables: { file: selectedFile },
      });
      const url = data?.uploadImage?.url || null;
      setSelectedFile(null);
      return url;
    } catch (err) {
      console.error("Upload failed", err);
      return null;
    }
  }, [selectedFile, uploadImageMutation]);

  const handleFormSubmit = useCallback(async () => {
    if (!validateForm()) return;

    dispatch(showLoading());

    let uploadedUrl = formValues.imageurl || "";

    if (selectedFile) {
      const url = await uploadProfilePicture();
      if (url) uploadedUrl = url;
    }

    try {
      const payload = {
        branchid: branchId || "",
        accountgroupid: formValues.accountgroupid,
        name: formValues.name,
        mobile: formValues.mobile,
        email: formValues.email,
        password: formValues.password || undefined,
        profilepicture: formValues.profilepicture,
        imageurl: uploadedUrl,
        address: formValues.address,
        salary: Number(formValues.salary) || 0,
        commission: Number(formValues.commission) || 0,
        target: Number(formValues.target) || 0,
        status: Boolean(formValues.status),
        admin: adminId,
        type: "salesman",
      };

      if (isEditing && editingId) {
        await editSalesmanMutation({
          variables: { id: editingId, input: payload },
        });
        dispatch(
          showMessage({ message: "Salesman updated successfully.", type: "success" })
        );
      } else {
        await addSalesmanMutation({ variables: { input: payload } });
        dispatch(
          showMessage({ message: "Salesman added successfully.", type: "success" })
        );
      }

      await refetch();

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
      });
      setSelectedFile(null);
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      console.error("Error saving salesman:", error);
      dispatch(
        showMessage({ message: "Failed to save salesman. Please try again.", type: "error" })
      );
    } finally {
      dispatch(hideLoading());
    }
  }, 
  
  [
    validateForm,
    selectedFile,
    uploadProfilePicture,
    formValues,
    isEditing,
    editingId,
    editSalesmanMutation,
    addSalesmanMutation,
    dispatch,
    refetch,
    branchId,
    adminId,
  ]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Name", key: "name" },
    { label: "Mobile", key: "mobile" },
    { label: "Email", key: "email" },
    { label: "Salary", key: "salary" },
    { label: "Commission", key: "commission" },
    { label: "Target", key: "target" },
    { label: "Account Group", key: "accountgroupname" },
    { label: "Status", key: "status" },
  ];

  const tableData = salesmenList.map((salesman: any, index: number) => ({
    ...salesman,
    seqNo: index + 1,
    salary: salesman.salary?.toFixed(2) || "0.00",
    commission: salesman.commission?.toFixed(2) || "0.00",
    target: salesman.target?.toFixed(2) || "0.00",
    accountgroupname: salesman.accountgroupid?.accountgroupname || "-", // Assuming populated
    status: salesman.status ? "Active" : "Inactive",
  }));

  // handleExport, handleImportClick, handleFileChange remain similar (add salary & accountgroupid)

  // ... rest of your component UI remains the same, just add new inputs:

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <input
          type="file"
          accept=".xlsx"
          ref={fileInputRef}
          onChange={(e) => {
            // your file change handler code here...
          }}
          style={{ display: "none" }}
        />

        <div className="mt-6 max-w-full">
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

              {/* Account Groups */}
              <FormField
                label="Account Group"
                name="accountgroupid"
                type="select"
                value={formValues.accountgroupid}
                onChange={(e) => handleFormChange("accountgroupid", e.target.value)}
                error={formErrors.accountgroupid}
                options={accountGroups.map((group: any) => ({
                    label: group.accountgroupname,
                    value: group.id || group._id,
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
                  selectedFile
                    ? URL.createObjectURL(selectedFile)
                    : formValues.imageurl || ""
                }
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

                <Button variant="outline" type="submit" disabled={isLoading}>
                  {isLoading
                    ? isEditing
                      ? "Updating..."
                      : "Adding..."
                    : isEditing
                    ? "Update Account"
                    : "Add Account"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        <DataTable
          title="Manage Salesmen Accounts"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={false}
          onView={(row) => console.log("View", row)}
          onEdit={handleEdit}
          onDelete={async (row: any) => {
            if (
              window.confirm(`Are you sure you want to delete salesman "${row.name}"?`)
            ) {
              try {
                await deleteSalesmanMutation({ variables: { id: row.id } });
                dispatch(
                  showMessage({ message: "Salesman deleted successfully.", type: "success" })
                );
                await refetch();
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(
                  showMessage({ message: "Failed to delete salesman.", type: "error" })
                );
              }
            }
          }}
          onShowDeleted={() => navigate("/salesmenaccount/deletedentries")}
          onImport={() => fileInputRef.current?.click()}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default SalesmenAccount;
