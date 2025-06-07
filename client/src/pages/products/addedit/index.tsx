import { useParams, useNavigate, useLocation } from "react-router";
import { useState, useEffect, ChangeEvent } from "react";
import React from "react";
import HomeLayout from "../../../layouts/home";
import { FaBox, FaPlus, FaRupeeSign } from "react-icons/fa";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useProductByIDQuery, useProductMutations } from "../../../graphql/hooks/products";
import { useCategoriesQuery } from "../../../graphql/hooks/categories";
import { useProductGroupsQuery } from "../../../graphql/hooks/productgroups";
import { useModelsQuery } from "../../../graphql/hooks/models";
import { useBrandsQuery } from "../../../graphql/hooks/brands";
import { useSizesQuery } from "../../../graphql/hooks/sizes";
import { useUnitsQuery } from "../../../graphql/hooks/units";
import BarcodeImage from "../../../components/barcode";
import { useImageUpload } from "../../../graphql/hooks/uploads";

type FormData = {
    branchid: string;
    name: string;
    productimage: string;
    imageurl: string;
    categoryid: string;
    productgroupnameid: string;
    modelid: string;
    brandid: string;
    sizeid: string;
    purchaseunitid: string;
    purchaserate?: number;
    salesunitid: string;
    salesrate?: number;
    gst?: number;
    openingstock?: number;
    openingstockamount?: number;
    currentstock?: number;
    currentstockamount?: number;
    minimumstock?: number;
    description: string;
    productlikecount?: number;
    status: boolean;
};


const AddEditProduct = () => {
    const { id } = useParams<{ id?: string }>();
    const location = useLocation();
    const { barcode, productcode, productname } = location.state || {};
    const isEdit = Boolean(id);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const branchId = localStorage.getItem("branchid") || "";
    const { data } = useProductByIDQuery(id || "");
    const { addProductMutation, editProductMutation } = useProductMutations();
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const { uploadImageMutation, imagedata, loading, error } = useImageUpload();

    const { data: categoryData } = useCategoriesQuery();
    const { data: groupData } = useProductGroupsQuery();
    const { data: modelData } = useModelsQuery();
    const { data: brandData } = useBrandsQuery();
    const { data: sizeData } = useSizesQuery();
    const { data: unitData } = useUnitsQuery();

    const [formData, setFormData] = useState<FormData>({
        branchid: branchId,
        name: "",
        productimage: "",
        imageurl: "",
        categoryid: "",
        productgroupnameid: "",
        modelid: "",
        brandid: "",
        sizeid: "",
        purchaseunitid: "",
        purchaserate: undefined,
        salesunitid: "",
        salesrate: undefined,
        gst: undefined,
        openingstock: undefined,
        openingstockamount: undefined,
        currentstock: undefined,
        currentstockamount: undefined,
        minimumstock: undefined,
        description: "",
        productlikecount: undefined,
        status: true,
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Load product data when editing
    useEffect(() => {
        if (isEdit && data?.getProduct) {
            const p = data.getProduct;
            setFormData({
                branchid: branchId,
                name: p.name || "",
                productimage: p.productimage || "",
                imageurl: p.imageurl || "",

                categoryid: p.categoryid || "",
                productgroupnameid: p.productgroupnameid || "",
                modelid: p.modelid || "",
                brandid: p.brandid || "",
                sizeid: p.sizeid || "",

                purchaseunitid: p.purchaseunitid || "",
                purchaserate: p.purchaserate,
                salesunitid: p.salesunitid || "",
                salesrate: p.salesrate,
                gst: p.gst,

                openingstock: p.openingstock,
                openingstockamount: p.openingstockamount,
                currentstock: p.currentstock,
                currentstockamount: p.currentstockamount,
                minimumstock: p.minimumstock,

                description: p.description || "",
                productlikecount: p.productlikecount,
                status: p.status ?? true,
            });
        }
    }, [isEdit, data]);

    // Handle input change (text, number, textarea)
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "number" ? parseFloat(value) : value,
        }));
        setErrors(prev => ({
            ...prev,
            [name]: "",
        }));
    };

    // Simple validation
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.name.trim()) newErrors.name = "Product name is required";
        if (!formData.categoryid) newErrors.categoryid = "Category is required";
        // Add other validations as needed
        return newErrors;
    };

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

    // Submit form handler
    const handleSubmit = async () => {
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        let uploadedUrl = formData.productimage;

        if (selectedFile) {
            const url = await uploadProfilePicture();
            if (url) uploadedUrl = url;
        }
        const payload = {
            ...formData,
            imageurl: uploadedUrl, 
        };
        try {
            if (isEdit && id) {
                await editProductMutation({
                    variables: {
                        id,
                        input: payload,
                    },
                });
                dispatch(showMessage({ message: "Product updated successfully!", type: "success" }));
            } else {
                await addProductMutation({
                    variables: {
                        input: payload,
                    },
                });
                dispatch(showMessage({ message: "Product added successfully!", type: "success" }));
            }
            navigate(-1);
        } catch (error) {
            dispatch(showMessage({ message: "Failed to save product. Try again.", type: "error" }));
        }
    };

    // Define a mapping from label to the property to display in dropdown
    const labelKeyMap: Record<string, string> = {
        Category: "categoryname",
        Brand: "brandname",
        "Product Group": "productgroupname",
        Model: "modelname",
        Size: "sizename",
        "Purchase Unit": "unitname",
        "Sales Unit": "unitname",
    };

    const renderSelectDropdown = <K extends keyof FormData>(
        label: string,
        name: K,
        options: any[]
    ) => {
        // Get correct label key for the dropdown
        const labelKey = labelKeyMap[label] || "name"; // fallback to "name" if missing

        // Define route map based on label
        const routeMap: Record<string, string> = {
            "Category": "/categories",
            "Brand": "/brands",
            "Model": "/models",
            "Sales Unit": "/units",
            "Purchase Unit": "/units",
            "Size": "/sizes",
            "Product Group": "/productgroups",
        };

        return (
            <div className="flex items-center gap-2">
                <FormField
                    label={label}
                    name={name as string}
                    type="select"
                    value={formData[name] as string | number}
                    onChange={handleChange}
                    options={options.map((item: any) => ({
                        value: item.id,
                        label: item[labelKey],
                    }))}
                    error={errors[name as string]}
                    searchable={true}
                />
                <Button
                    variant="outline"
                    className="h-[46px] mt-6"
                    onClick={() => {
                        const route = routeMap[label];
                        if (route) navigate(route);
                        else alert(`No route configured for ${label}`);
                    }}
                >
                    <FaPlus />
                </Button>
            </div>
        );
    };

    return (
        <HomeLayout>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 py-6">
                {/* Left Section */}
                <div className="space-y-6">
                    <fieldset className="border rounded-xl p-4 space-y-4">
                        <legend className="text-sm font-medium px-2">Main Details</legend>

                        <FormField
                            label="Product Name"
                            name="name"
                            icon={<FaBox />}
                            value={formData.name}
                            onChange={handleChange}
                            error={errors.name}
                        />

                        {isEdit && (
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Barcode</label>
                                <BarcodeImage value={barcode || ""} />
                            </div>
                        )}

                        <FormField
                            label="Product Image"
                            name="productimage"
                            type="file"
                            placeholder="Upload Product Image"
                            accept="image/*"
                            onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setSelectedFile(file);
                            setFormData((prev) => ({
                                ...prev,
                                productimage: file.name,
                            }));
                            }}
                            previewUrl={
                            selectedFile
                                ? URL.createObjectURL(selectedFile)
                                : formData.imageurl
                                ? formData.imageurl
                                : ""
                            }
                        />

                        {renderSelectDropdown("Category", "categoryid", categoryData?.getCategories || [])}
                        {renderSelectDropdown("Brand", "brandid", brandData?.getBrands || [])}
                        {renderSelectDropdown("Product Group", "productgroupnameid", groupData?.getProductGroups || [])}
                        {renderSelectDropdown("Model", "modelid", modelData?.getModels || [])}
                        {renderSelectDropdown("Size", "sizeid", sizeData?.getSizes || [])}
                    </fieldset>

                    <fieldset className="border rounded-xl p-4">
                        <legend className="text-sm font-medium px-2">Product Description</legend>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md"
                        />
                    </fieldset>

                    <fieldset className="border rounded-xl p-4">
                        <legend className="text-sm font-medium px-2">Product Status</legend>
                        <FormSwitch
                            label="Status"
                            name="status"
                            checked={formData.status}
                            onChange={(checked) => setFormData(prev => ({ ...prev, status: checked }))}
                        />
                    </fieldset>
                </div>

                {/* Right Section */}
                <div className="space-y-6">
                    <fieldset className="border rounded-xl p-4 space-y-4">
                        <legend className="text-sm font-medium px-2">Unit & Rate</legend>

                        {renderSelectDropdown("Purchase Unit", "purchaseunitid", unitData?.getUnits || [])}
                        <FormField
                            label="Purchase Rate"
                            name="purchaserate"
                            type="number"
                            icon={<FaRupeeSign />}
                            value={formData.purchaserate}
                            onChange={handleChange}
                            error={errors.purchaserate}
                        />

                        {renderSelectDropdown("Sales Unit", "salesunitid", unitData?.getUnits || [])}
                        <FormField
                            label="Sales Rate"
                            name="salesrate"
                            type="number"
                            icon={<FaRupeeSign />}
                            value={formData.salesrate}
                            onChange={handleChange}
                            error={errors.salesrate}
                        />

                        {/* <FormField
                            label="GST (%)"
                            name="gst"
                            type="number"
                            value={formData.gst}
                            onChange={handleChange}
                            error={errors.gst}
                        /> */}
                    </fieldset>

                    <fieldset className="border rounded-xl p-4 space-y-4">
                        <legend className="text-sm font-medium px-2">Stock Details</legend>

                        <FormField
                            label="Opening Stock"
                            name="openingstock"
                            type="number"
                            value={formData.openingstock}
                            onChange={handleChange}
                            error={errors.openingstock}
                        />
                        <FormField
                            label="Opening Stock Amount"
                            name="openingstockamount"
                            type="number"
                            value={formData.openingstockamount}
                            onChange={handleChange}
                            error={errors.openingstockamount}
                        />
                        <FormField
                            label="Current Stock"
                            name="currentstock"
                            type="number"
                            value={formData.currentstock}
                            onChange={handleChange}
                            error={errors.currentstock}
                        />
                        <FormField
                            label="Current Stock Amount"
                            name="currentstockamount"
                            type="number"
                            value={formData.currentstockamount}
                            onChange={handleChange}
                            error={errors.currentstockamount}
                        />
                        <FormField
                            label="Minimum Stock"
                            name="minimumstock"
                            type="number"
                            value={formData.minimumstock}
                            onChange={handleChange}
                            error={errors.minimumstock}
                        />
                    </fieldset>
                </div>
            </div>

            <div className="flex justify-end gap-4 px-4 py-2 mb-6">
                <Button variant="outline" onClick={() => navigate("/products")}>
                    Cancel
                </Button>
                <Button variant="outline" onClick={handleSubmit}>
                    {isEdit ? "Update Product" : "Add Product"}
                </Button>
            </div>
        </HomeLayout>
    );
};

export default AddEditProduct;
