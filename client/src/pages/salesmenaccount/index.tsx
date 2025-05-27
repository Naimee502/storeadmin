import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
    useSalesmenQuery,
    useSalesmanMutations
} from "../../graphql/hooks/salesmenaccount"; // you need to create these hooks for salesmen
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addSalesmen } from "../../redux/slices/salesmenaccount"; // salesmen redux slice
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import FormSwitch from "../../components/formswitch";
import { FaEnvelope, FaMobileAlt, FaUser, FaHome, FaPercent } from "react-icons/fa";

type FormValues = {
  name: string;
  mobile: string;
  email: string;
  password: string;
  profilepicture: "";
  address: string;
  commission: string;
  status: boolean;
};

const SalesmenAccount = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch salesmen data
    const { data, refetch } = useSalesmenQuery();
    const { addSalesmanMutation, editSalesmanMutation, deleteSalesmanMutation } = useSalesmanMutations();
    const salesmenList = data?.getSalesmenAccounts || [];
      console.log('Salesmen data:', JSON.stringify(data));

    const isLoading = useAppSelector((state) => state.loader.isLoading);

    const [formValues, setFormValues] = useState<FormValues>({
    name: "",
    mobile: "",
    email: "",
    password: "",
    profilepicture: "",
    address: "",
    commission: "",
    status: true,
    });

    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleFormChange = (name: string, value: string | boolean) => {
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        const errors: { [key: string]: string } = {};
        if (!formValues.name.trim()) errors.name = "Name is required";
        if (!formValues.mobile.trim()) errors.mobile = "Mobile is required";
        if (!formValues.email.trim()) errors.email = "Email is required";
        if (!formValues.password.trim() && !isEditing) errors.password = "Password is required";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleEdit = (row: any) => {
        console.log("Editing Row:", row); // ✅ This will show the full row object

        setFormValues({
            name: row.name || "",
            mobile: row.mobile || "",
            email: row.email || "",
            password: row.password || "",
            profilepicture: row.profilepicture || "",
            address: row.address || "",
            commission: row.commission || "",
            status: !!row.status,
        });

        setIsEditing(true);
        setEditingId(row.id);
    };


    useEffect(() => {
        const fetchAndDispatch = async () => {
            dispatch(showLoading());
            try {
                const { data } = await refetch();
                if (data?.getSalesmen) {
                    dispatch(addSalesmen(data.getSalesmen));
                }
            } catch (error) {
                console.error("Error fetching salesmen:", error);
            } finally {
                dispatch(hideLoading());
            }
        };

        fetchAndDispatch();
    }, [dispatch, refetch]);

    const handleFormSubmit = async () => {
        if (!validateForm()) return;
        try {
            if (isEditing && editingId) {
                await editSalesmanMutation({
                    variables: {
                        id: editingId,
                        input: {
                            name: formValues.name,
                            mobile: formValues.mobile,
                            email: formValues.email,
                            password: formValues.password || undefined, 
                            profilepicture: formValues.profilepicture,
                            address: formValues.address,
                            commission: formValues.commission,
                            status: Boolean(formValues.status),
                        },
                    },
                });
                dispatch(showMessage({ message: "Salesman updated successfully.", type: "success" }));
            } else {
                console.log("Adding new salesman with values:", JSON.stringify(formValues));
                await addSalesmanMutation({
                    variables: {
                        input: {
                            name: formValues.name,
                            mobile: formValues.mobile,
                            email: formValues.email,
                            password: formValues.password,
                            profilepicture: formValues.profilepicture,
                            address: formValues.address,
                            commission: formValues.commission,
                            status: Boolean(formValues.status),
                        },
                    },
                });
                dispatch(showMessage({ message: "Salesman added successfully.", type: "success" }));
            }

            await refetch();
            setFormValues({
                name: "",
                mobile: "",
                email: "",
                password: "",
                profilepicture: "",
                address: "",
                commission: "",
                status: true,
            });
            setIsEditing(false);
            setEditingId(null);
        } catch (error: any) {
            console.error("Error saving salesman:", error);
            dispatch(showMessage({ message: "Failed to save salesman. Please try again.", type: "error" }));
        }
    };

    const columns = [
        { label: "Seq Number", key: "seqNo" },
        { label: "Name", key: "name" },
        { label: "Mobile", key: "mobile" },
        { label: "Email", key: "email" },
        { label: "Commission", key: "commission" },
        { label: "Status", key: "status" },
    ];

    const tableData = salesmenList.map((salesman: any, index: number) => ({
        ...salesman,
        seqNo: index + 1,
        status: salesman.status ? "Active" : "Inactive",
    }));

    const handleExport = () => {
        const exportData = salesmenList.map((salesman: any, index: number) => ({
            ID: index + 1,
            Name: salesman.name || "-",
            Mobile: salesman.mobile || "-",
            Email: salesman.email || "-",
            ProfilePicture: salesman.profilepicture || "-",
            Address: salesman.address || "-",
            Commission: salesman.commission || "-",
            Status: salesman.status ? "true" : "false",
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Salesmen");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(dataBlob, "salesmen.xlsx");
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

            const importedSalesmen = jsonData.map((row) => ({
                name: row.Name || "",
                mobile: row.Mobile || "",
                email: row.Email || "",
                password: row.Password || "", // You might want to handle this differently
                profilepicture: row.ProfilePicture || "",
                address: row.Address || "",
                commision: row.Commission || "",
                status: row.Status === "true" || row.Status === "1" || row.Status === true,
            }));

            console.log("Imported Salesmen:", importedSalesmen);
            // TODO: Add mutation to insert bulk salesmen if needed
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <FormField
                                label="Name"
                                name="name"
                                type="text"
                                value={formValues.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                error={formErrors.name}
                                icon={<FaUser />}
                                placeholder="Enter full name"
                            />

                            <FormField
                                label="Mobile"
                                name="mobile"
                                type="text"
                                value={formValues.mobile}
                                onChange={(e) => handleFormChange('mobile', e.target.value)}
                                error={formErrors.mobile}
                                icon={<FaMobileAlt />}
                                placeholder="Enter mobile number"
                            />

                            <FormField
                                label="Email"
                                name="email"
                                type="email"
                                value={formValues.email}
                                onChange={(e) => handleFormChange('email', e.target.value)}
                                error={formErrors.email}
                                icon={<FaEnvelope />}
                                placeholder="Enter email address"
                            />

                            <FormField
                                label={isEditing ? "New Password (leave blank to keep current)" : "Password"}
                                name="password"
                                type="password"
                                value={formValues.password}
                                onChange={(e) => handleFormChange('password', e.target.value)}
                                error={formErrors.password}
                                placeholder={isEditing ? "Enter new password" : "Enter password"}
                            />

                            <FormField
                                label="Profile Picture"
                                name="profilepicture"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    handleFormChange("profilepicture", file ? file.name : "");
                                }}
                                previewUrl={formValues.profilepicture ? URL.createObjectURL(new File([], formValues.profilepicture)) : ""}
                                />

                            <FormField
                                label="Address"
                                name="address"
                                type="text"
                                value={formValues.address}
                                onChange={(e) => handleFormChange('address', e.target.value)}
                                icon={<FaHome />}
                                placeholder="Enter address"
                            />

                            <FormField
                                label="Commission"
                                name="commission"
                                type="number"
                                value={formValues.commission}
                                onChange={(e) => handleFormChange('commission', e.target.value)}
                                icon={<FaPercent />}
                                placeholder="Enter commission %"
                            />

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

                                <Button variant="outline">
                                    {isEditing ? 'Update Account' : 'Add Account'}
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
                        showImport={true}
                        showExport={true}
                        showAdd={false}
                        onView={(row) => console.log("View", row)}
                        onEdit={handleEdit}
                        onDelete={async (row: any) => {
                        try {
                            await deleteSalesmanMutation({ variables: { id: row.id } });
                            dispatch(showMessage({ message: "Salesman deleted", type: "success" }));
                            await refetch();
                        } catch (error) {
                            dispatch(showMessage({ message: "Failed to delete salesman", type: "error" }));
                        }
                        }}
                        onImport={handleImportClick}
                        onExport={handleExport}
                    />
            </div>
        </HomeLayout>
    );
};

export default SalesmenAccount;
