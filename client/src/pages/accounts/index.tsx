import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
    useAccountsQuery,
    useAccountMutations
} from "../../graphql/hooks/accounts";
import {
    useAccountGroupsQuery
} from "../../graphql/hooks/accountgroups";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addAccounts } from "../../redux/slices/accounts";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import FormSwitch from "../../components/formswitch";
import { FaCity, FaEnvelope, FaLocationArrow, FaMobileAlt, FaUser } from "react-icons/fa";

const Accounts = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { type, admin, branch } = useAppSelector((state) => state.auth);
    const adminId = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;
    const branchid = useAppSelector((state) => state.selectedBranch.branchId);

    const { data, refetch } = useAccountsQuery();
    // Fetch account groups for dropdown
    const { data: accountGroupsData } = useAccountGroupsQuery();

    const { addAccountMutation, editAccountMutation, deleteAccountMutation } = useAccountMutations();
    const accountsList = data?.getAccounts || [];
    const accountGroupsList = accountGroupsData?.getAccountGroups || [];

    const isLoading = useAppSelector((state) => state.loader.isLoading);

    // Form state including accountgroupid for dropdown selection
    const [formValues, setFormValues] = useState({
        branchid: "",
        name: "",
        accountgroupid: "",   // dropdown value
        mobile: "",
        email: "",
        address: "",
        city: "",
        pincode: "",
        status: true,
    });

    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Handle form field changes
    const handleFormChange = (name: string, value: string | boolean) => {
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    // Basic form validation
    const validateForm = () => {
        const errors: { [key: string]: string } = {};
        if (!formValues.name.trim()) errors.name = "Name is required";
        if (!formValues.accountgroupid) errors.accountgroupid = "Account group is required";
        if (!formValues.mobile) errors.mobile = "Mobile is required";
         if (!formValues.email) errors.email = "Email is required";
        // You can add more validation here
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Populate form for editing
    const handleEdit = (row: any) => {
        setFormValues({
            branchid: row.name,
            name: row.name,
            accountgroupid: row.accountgroupid,
            mobile: row.mobile || "",
            email: row.email || "",
            address: row.address || "",
            city: row.city || "",
            pincode: row.pincode || "",
            status: row.status === "Active",
        });
        setIsEditing(true);
        setEditingId(row.id);
    };

    // Fetch and dispatch data on mount
    useEffect(() => {
        const fetchAndDispatch = async () => {
            dispatch(showLoading());
            try {
                const { data } = await refetch();
                if (data?.getAccounts) {
                    dispatch(addAccounts(data.getAccounts));
                }
            } catch (error) {
                console.error("Error fetching accounts:", error);
            } finally {
                dispatch(hideLoading());
            }
        };

        fetchAndDispatch();
    }, [dispatch, refetch]);

    // Handle add or edit submit
    const handleFormSubmit = async () => {
        if (!validateForm()) return;
        dispatch(showLoading());
        try {
            if (isEditing && editingId) {
                await editAccountMutation({
                    variables: {
                        id: editingId,
                        input: {
                            branchid: branchid,
                            name: formValues.name,
                            accountgroupid: formValues.accountgroupid,
                            mobile: formValues.mobile,
                            email: formValues.email,
                            address: formValues.address,
                            city: formValues.city,
                            pincode: formValues.pincode,
                            status: formValues.status,
                            admin: adminId
                        },
                    },
                });
                dispatch(showMessage({ message: "Account updated successfully.", type: "success" }));
            } else {
                await addAccountMutation({
                    variables: {
                        input: {
                            branchid: branchid,
                            name: formValues.name,
                            accountgroupid: formValues.accountgroupid,
                            mobile: formValues.mobile,
                            email: formValues.email,
                            address: formValues.address,
                            city: formValues.city,
                            pincode: formValues.pincode,
                            status: formValues.status,
                            admin: adminId
                        },
                    },
                });
                dispatch(showMessage({ message: "Account added successfully.", type: "success" }));
            }

            await refetch();
            setFormValues({
                branchid: "",
                name: "",
                accountgroupid: "",
                mobile: "",
                email: "",
                address: "",
                city: "",
                pincode: "",
                status: true,
            });
            setIsEditing(false);
            setEditingId(null);
        } catch (error: any) {
            console.error("Error saving account:", error);
            dispatch(showMessage({ message: "Failed to save account. Please try again.", type: "error" }));
        } finally {
            dispatch(hideLoading());
        }
    };

    const columns = [
        { label: "Seq Number", key: "seqNo" },
        { label: "Account Code", key: "accountcode" },
        { label: "Name", key: "name" },
        { label: "Account Group", key: "accountgroupname" }, // show name from group
        { label: "Mobile", key: "mobile" },
        { label: "Email", key: "email" },
        { label: "Status", key: "status" },
    ];

    // Prepare data for table, including mapping group name by id
    const tableData = accountsList.map((account: any, index: number) => {
        const group = accountGroupsList.find((g) => g.id === account.accountgroupid);
        return {
            ...account,
            seqNo: index + 1,
            status: account.status ? "Active" : "Inactive",
            accountgroupname: group ? group.accountgroupname : "-",
        };
    });

    // Export to Excel
    const handleExport = () => {
        const exportData = accountsList.map((account: any, index: number) => {
            const group = accountGroupsList.find((g) => g.id === account.accountgroupid);
            return {
                ID: index + 1,
                AccountCode: account.accountcode || "-",
                Name: account.name || "-",
                AccountGroup: group ? group.accountgroupname : "-",
                Mobile: account.mobile || "-",
                Email: account.email || "-",
                Address: account.address || "-",
                City: account.city || "-",
                Pincode: account.pincode || "-",
                Status: account.status ? "true" : "false",
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Accounts");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(dataBlob, "accounts.xlsx");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            const importedAccounts = jsonData.map((row) => ({
                accountcode: row.AccountCode || "",
                name: row.Name || "",
                accountgroupid: "", // you might want to map from group name or code here if needed
                mobile: row.Mobile || "",
                email: row.Email || "",
                address: row.Address || "",
                city: row.City || "",
                pincode: row.Pincode || "",
                status: row.Status === "true" || row.Status === "1" || row.Status === true,
            }));

            console.log("Imported Accounts:", importedAccounts);
            // TODO: Add mutation to insert bulk accounts if required
        };

        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <HomeLayout>
            <div className="w-full px-2 sm:px-6 pt-4 pb-6">
                <input
                    type="file"
                    accept=".xlsx"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />

                <div className="mt-6 max-w-full">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleFormSubmit();
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <FormField
                                label="Name"
                                name="name"
                                type="text"
                                value={formValues.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                error={formErrors.name}
                                icon={<FaUser />}                     
                                placeholder="Enter your full name"   
                            />

                            <FormField
                                label="Account Group"
                                name="accountgroupid"
                                type="select"
                                value={formValues.accountgroupid}
                                onChange={(e) => handleFormChange('accountgroupid', e.target.value)}
                                options={accountGroupsList.map((group: any) => ({
                                    label: group.accountgroupname,
                                    value: group.id,
                                }))}
                                error={formErrors.accountgroupid}
                            />

                            <FormField
                                label="Mobile"
                                name="mobile"
                                type="text"
                                value={formValues.mobile}
                                onChange={(e) => handleFormChange('mobile', e.target.value)}
                                error={formErrors.mobile}
                                icon={<FaMobileAlt />} placeholder="Mobile Number"
                            />

                            <FormField
                                label="Email"
                                name="email"
                                type="email"
                                value={formValues.email}
                                onChange={(e) => handleFormChange('email', e.target.value)}
                                error={formErrors.email}
                                icon={<FaEnvelope />} placeholder="Email"
                            />

                            <FormField
                                label="Address"
                                name="address"
                                value={formValues.address}
                                onChange={(e) => handleFormChange('address', e.target.value)}
                                icon={<FaLocationArrow />} 
                                placeholder="Address"
                            />

                            <FormField
                                label="City"
                                name="city"
                                type="text"
                                value={formValues.city}
                                onChange={(e) => handleFormChange('city', e.target.value)}
                                icon={<FaCity />} 
                                placeholder="City"
                            />

                            <FormField
                                label="Pincode"
                                name="pincode"
                                type="text"
                                value={formValues.pincode}
                                onChange={(e) => handleFormChange('pincode', e.target.value)}
                                icon={<FaLocationArrow />} 
                                placeholder="Pincode"
                            />

                            <div className="flex items-center justify-between max-w-full space-x-4 mt-4">
                                <fieldset className="flex items-center space-x-2">
                                    <legend className="text-sm sm:text-base font-medium">Status</legend>
                                    <FormSwitch
                                    label=""
                                    name="status"
                                    checked={Boolean(formValues.status)}
                                    onChange={(checked) => handleFormChange("status", checked)}
                                    />
                                </fieldset>

                                <Button variant="outline">
                                    {isEditing ? 'Update Account' : 'Add Account'}
                                </Button>
                            </div>
                            </div>
                    </form>
                </div>


                <DataTable
                    title="Manage Accounts"
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
                    onDelete={async (row) => {
                        try {
                            await deleteAccountMutation({ variables: { id: row.id } });
                            dispatch(showMessage({ message: "Account deleted successfully.", type: "success" }));
                            await refetch();
                        } catch (error) {
                            dispatch(showMessage({ message: "Failed to delete account.", type: "error" }));
                        }
                    }}
                    onShowDeleted={() =>navigate("/accounts/deletedentries")}
                    onImport={handleImportClick}
                    onExport={handleExport}
                    isLoading={isLoading}
                />
            </div>
        </HomeLayout>
    );
};

export default Accounts;
