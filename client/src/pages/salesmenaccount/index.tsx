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
import { useImageUpload } from "../../graphql/hooks/uploads";

type FormValues = {
    branchid: string;
    name: string;
    mobile: string;
    email: string;
    password: string;
    profilepicture: string;
    productimageurl: string;
    address: string;
    commission: string;
    status: boolean;
};

const SalesmenAccount = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch salesmen data
    const branchid = localStorage.getItem("branchid") || "";
    const { data, refetch } = useSalesmenQuery(branchid);
    const { addSalesmanMutation, editSalesmanMutation, deleteSalesmanMutation } = useSalesmanMutations();
    const salesmenList = data?.getSalesmenAccounts || [];
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const { uploadImageMutation, imagedata, loading, error } = useImageUpload();

    const isLoading = useAppSelector((state) => state.loader.isLoading);

    const [formValues, setFormValues] = useState<FormValues>({
        branchid:"",
        name: "",
        mobile: "",
        email: "",
        password: "",
        profilepicture: "",
        productimageurl: "",
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
        if (!formValues.commission.trim() && !isEditing) errors.commission = "Commission is required";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleEdit = (row: any) => {
        console.log("Editing row:", JSON.stringify(row));
        setFormValues({
            branchid:row.branchid || "",
            name: row.name || "",
            mobile: row.mobile || "",
            email: row.email || "",
            password: row.password || "",
            profilepicture: row.profilepicture || "",
            productimageurl: row.productimageurl || "",
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
                refetch();
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

    const uploadProfilePicture = async (): Promise<string | null> => {
        if (!selectedFile) {
            console.warn("No file selected.");
            return null;
        }
        try {
            const { data } = await uploadImageMutation({
            variables: { file: selectedFile },
            });

            const uniqueUrl = data?.uploadImage?.url;
            setSelectedFile(null);
            return uniqueUrl || null;
        } catch (err) {
            console.error("Upload failed", err);
            return null;
        }
    };

    const handleFormSubmit = async () => {
        if (!validateForm()) return;

        dispatch(showLoading());

        let uploadedUrl = formValues.profilepicture;

        if (selectedFile) {
            const url = await uploadProfilePicture();
            if (url) uploadedUrl = url;
        }

        try {
            const payload = {
            branchid: branchid,
            name: formValues.name,
            mobile: formValues.mobile,
            email: formValues.email,
            password: formValues.password || undefined,
            profilepicture: formValues.profilepicture,
            productimageurl: uploadedUrl,
            address: formValues.address,
            commission: formValues.commission,
            status: Boolean(formValues.status),
            };

            console.log("Form Values:", JSON.stringify(payload));

            if (isEditing && editingId) {
            await editSalesmanMutation({
                variables: { id: editingId, input: payload },
            });
            dispatch(showMessage({ message: "Salesman updated successfully.", type: "success" }));
            } else {
            await addSalesmanMutation({ variables: { input: payload } });
            dispatch(showMessage({ message: "Salesman added successfully.", type: "success" }));
            }

            await refetch();
            setFormValues({
            branchid:'',
            name: "",
            mobile: "",
            email: "",
            password: "",
            profilepicture: "",
            productimageurl:"",
            address: "",
            commission: "",
            status: true,
            });
            setSelectedFile(null);
            setIsEditing(false);
            setEditingId(null);
            dispatch(hideLoading);
        } catch (error: any) {
            dispatch(hideLoading);
            console.error("Error saving salesman:", error);
            dispatch(showMessage({ message: "Failed to save salesman. Please try again.", type: "error" }));
        } finally {
            dispatch(hideLoading());
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
                                    setSelectedFile(file);
                                    setFormValues((prev) => ({
                                    ...prev,
                                    profilepicture: file.name,
                                    }));
                                }}
                                previewUrl={
                                selectedFile
                                    ? URL.createObjectURL(selectedFile)
                                    : formValues.productimageurl
                                    ? formValues.productimageurl
                                    : ""
                                }
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
                                 error={formErrors.commission}
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
                    showImport={false}
                    showExport={false}
                    showAdd={false}
                    onView={(row) => console.log("View", row)}
                    onEdit={handleEdit}
                    onDelete={async (row: any) => {
                            if (window.confirm(
                                `Are you sure you want to delete salesman "${row.name}"?`
                            )) {
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
                    onShowDeleted={() =>navigate("/salesmenaccount/deletedentries")}
                    onImport={handleImportClick}
                    onExport={handleExport}
                    isLoading={isLoading}
                />
            </div>
        </HomeLayout>
    );
};

export default SalesmenAccount;
