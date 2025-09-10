import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField, { type InputType } from "../../../components/formfiled";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import {
    useProductServiceByIDQuery,
    useProductServiceMutations,
} from "../../../graphql/hooks/products";
import { useImageUpload } from "../../../graphql/hooks/uploads";
import { useCategoriesQuery } from "../../../graphql/hooks/categories";
import { useBrandsQuery } from "../../../graphql/hooks/brands";
import { useProductGroupsQuery } from "../../../graphql/hooks/productgroups";
import { useModelsQuery } from "../../../graphql/hooks/models";
import { useSizesQuery } from "../../../graphql/hooks/sizes";
import { useUnitsQuery } from "../../../graphql/hooks/units";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import BarcodeImage from "../../../components/barcode";
import { useSubCategoriesQuery } from "../../../graphql/hooks/subcategories";
import { v4 as uuidv4 } from 'uuid';

const AddEditProductService = () => {
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { admin, branch, type } = useAppSelector((state) => state.auth);
    const branchId = useAppSelector((state) => state.selectedBranch.branchId);
    const adminId = type === "admin" ? admin?.id : branch?.admin?.id;

    const { data: categoryData } = useCategoriesQuery();
    const { data: subCategoryDate } = useSubCategoriesQuery();
    const { data: brandData } = useBrandsQuery();
    const { data: groupData } = useProductGroupsQuery();
    const { data: modelData } = useModelsQuery();
    const { data: sizeData } = useSizesQuery();
    const { data: unitData } = useUnitsQuery();
    const { data: accountData } = useAccountsQuery();

    const regionOptions = [
        { value: "default", label: "Default" },
        { value: "andhra_pradesh", label: "Andhra Pradesh" },
        { value: "arunachal_pradesh", label: "Arunachal Pradesh" },
        { value: "assam", label: "Assam" },
        { value: "bihar", label: "Bihar" },
        { value: "chhattisgarh", label: "Chhattisgarh" },
        { value: "goa", label: "Goa" },
        { value: "gujarat", label: "Gujarat" },
        { value: "haryana", label: "Haryana" },
        { value: "himachal_pradesh", label: "Himachal Pradesh" },
        { value: "jharkhand", label: "Jharkhand" },
        { value: "karnataka", label: "Karnataka" },
        { value: "kerala", label: "Kerala" },
        { value: "madhya_pradesh", label: "Madhya Pradesh" },
        { value: "maharashtra", label: "Maharashtra" },
        { value: "manipur", label: "Manipur" },
        { value: "meghalaya", label: "Meghalaya" },
        { value: "mizoram", label: "Mizoram" },
        { value: "nagaland", label: "Nagaland" },
        { value: "odisha", label: "Odisha" },
        { value: "punjab", label: "Punjab" },
        { value: "rajasthan", label: "Rajasthan" },
        { value: "sikkim", label: "Sikkim" },
        { value: "tamil_nadu", label: "Tamil Nadu" },
        { value: "telangana", label: "Telangana" },
        { value: "tripura", label: "Tripura" },
        { value: "uttar_pradesh", label: "Uttar Pradesh" },
        { value: "uttarakhand", label: "Uttarakhand" },
        { value: "west_bengal", label: "West Bengal" },

        // Union Territories
        { value: "andaman_nicobar", label: "Andaman and Nicobar Islands" },
        { value: "chandigarh", label: "Chandigarh" },
        { value: "dadra_nagar_haveli_daman_diu", label: "Dadra and Nagar Haveli and Daman and Diu" },
        { value: "delhi", label: "Delhi" },
        { value: "jammu_kashmir", label: "Jammu and Kashmir" },
        { value: "ladakh", label: "Ladakh" },
        { value: "lakshadweep", label: "Lakshadweep" },
        { value: "puducherry", label: "Puducherry" },

        // Extra options
        { value: "international", label: "International" },
    ];

    const { data: productData } = useProductServiceByIDQuery(id || "");
    const { addProductServiceMutation, updateProductServiceMutation } = useProductServiceMutations();
    const { uploadImageMutation } = useImageUpload();

    const [formData, setFormData] = useState<any>({
        adminid: adminId,
        branchid: branchId,
        isservice: false,
        name: "",
        description: "",
        imageurl: "",
        imagename: "",
        categoryid: "",
        subcategoryid: "",
        groupid: "",
        modelid: "",
        brandid: "",
        sizeid: "",
        seo: {
            metatitle: "",
            metadescription: "",
            keywords: [],
            slug: "",
        },
        productvariants: [
            {
                name: "",
                sku: "",
                productcode: "",
                productbarcode: "",
                batchnumber: "",
                manufacturedate: "",
                expirydate: "",
                baseunitid: "",
                unitconversions: [
                    {
                        unitid: "",
                        factor: 1,
                    },
                ],
                gst: 0,
                hsncode: "",
                openingstock: 0,
                openingstockamount: 0,
                currentstock: 0,
                currentstockamount: 0,
                closingstock: 0,
                closingstockamount: 0,
                minimumstock: 0,
                reorderlevel: 0,
                racklocation: "",
                isserialised: false,
                serials: [
                    {
                        imei: "",
                        serialnumber: "",
                        lotnumber: "",
                        status: "available",
                        addedon: new Date(),
                        soldon: null,
                        returnedon: null,
                        remarks: "",
                    },
                ],
                pricing: [
                    {
                        region: "default",
                        channel: "enduser",
                        unitprices: [
                            {
                                unitid: "",
                                mrp: 0,
                                salesrate: 0,
                                purchaserate: 0,
                                discount: 0,
                                discounttype: "fixed",
                                offerprice: 0,
                            },
                        ],
                    },
                ],
                productlikecount: 0,
            },
        ],
        servicevariants: [
            {
                name: "",
                servicecode: "",
                servicebarcode: "",
                servicerate: 0,
                uom: "hour",
                duration: {
                    amount: 1,
                    unit: "hours",
                },
                requiresappointment: true,
                availabilityslots: [
                    {
                        day: "mon",
                        from: "",
                        to: "",
                    },
                ],
                locationType: "onsite",
                isRecurring: false,
                recurrence: {
                    interval: "monthly",
                    count: 1,
                },
                servicelikecount: 0,
                remarks: "",
            },
        ],
        isshowinpos: false,
        isfeatured: false,
        salesaccountid: "",
        purchaseaccountid: "",
        serviceaccountid: "",
        status: true,
    });


    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (isEdit && productData?.getProductServiceById) {
            const p = JSON.parse(JSON.stringify(productData.getProductServiceById)); // Deep clone

            setFormData({
                adminid: p.adminid ?? adminId ?? "",
                branchid: p.branchid ?? branchId ?? "",
                isservice: p.isservice ?? false,
                name: p.name ?? "",
                description: p.description ?? "",
                imageurl: p.imageurl ?? "",
                imagename: p.imagename ?? "",
                categoryid: p.categoryid ?? "",
                subcategoryid: p.subcategoryid ?? "",
                groupid: p.groupid ?? "",
                modelid: p.modelid ?? "",
                brandid: p.brandid ?? "",
                sizeid: p.sizeid ?? "",
                seo: {
                    metatitle: p.seo?.metatitle ?? "",
                    metadescription: p.seo?.metadescription ?? "",
                    keywords: p.seo?.keywords ?? [],
                    slug: p.seo?.slug ?? "",
                },
                productvariants: (p.productvariants || []).length > 0
                    ? p.productvariants.map((variant: any) => ({
                        ...variant,
                        manufacturedate: formatDateForInput(variant.manufacturedate),
                        expirydate: formatDateForInput(variant.expirydate),
                        unitconversions: variant.unitconversions?.length
                            ? variant.unitconversions
                            : [{ unitid: "", factor: 1 }],
                        serials: variant.serials?.length
                            ? variant.serials
                            : [{ imei: "", serialnumber: "", lotnumber: "", status: "available", remarks: "", addedon: new Date() }],
                        pricing: variant.pricing?.length
                            ? variant.pricing
                            : [
                                {
                                    region: "default",
                                    channel: "enduser",
                                    unitprices: [{ unitid: "", mrp: 0, salesrate: 0, purchaserate: 0, discount: 0, discounttype: "fixed", offerprice: 0 }],
                                },
                            ],
                        productlikecount: variant.productlikecount ?? 0,
                    }))
                    : [
                        {
                            name: "",
                            sku: "",
                            productcode: "",
                            productbarcode: "",
                            batchnumber: "",
                            manufacturedate: "",
                            expirydate: "",
                            baseunitid: "",
                            salesunitid: "",
                            purchaseunitid: "",
                            unitconversions: [{ unitid: "", factor: 1 }],
                            gst: 0,
                            hsncode: "",
                            openingstock: 0,
                            openingstockamount: 0,
                            currentstock: 0,
                            currentstockamount: 0,
                            closingstock: 0,
                            closingstockamount: 0,
                            minimumstock: 0,
                            reorderlevel: 0,
                            racklocation: "",
                            isserialised: false,
                            serials: [{ imei: "", serialnumber: "", lotnumber: "", status: "available", remarks: "", addedon: new Date() }],
                            pricing: [
                                {
                                    regionid: "",
                                    channel: "default",
                                    unitprices: [{ unitid: "", mrp: 0, salesrate: 0, purchaserate: 0, discount: 0, discounttype: "fixed", offerprice: 0 }],
                                },
                            ],
                            productlikecount: 0,
                        },
                    ],
                servicevariants: (p.servicevariants || []).length > 0
                    ? p.servicevariants.map((service: any) => ({
                        ...service,
                        duration: {
                            amount: service.duration?.amount ?? 1,
                            unit: service.duration?.unit ?? "hours",
                        },
                        availabilityslots: service.availabilityslots?.length
                            ? service.availabilityslots
                            : [{ day: "mon", from: "", to: "" }],
                        recurrence: {
                            interval: service.recurrence?.interval ?? "monthly",
                            count: service.recurrence?.count ?? 1,
                        },
                    }))
                    : [
                        {
                            name: "",
                            servicecode: "",
                            servicebarcode: "",
                            servicerate: 0,
                            uom: "hour",
                            duration: { amount: 1, unit: "hours" },
                            requiresappointment: true,
                            availabilityslots: [{ day: "mon", from: "", to: "" }],
                            locationType: "onsite",
                            isRecurring: false,
                            recurrence: { interval: "monthly", count: 1 },
                            servicelikecount: 0,
                            remarks: "",
                        },
                    ],
                isshowinpos: p.isshowinpos ?? false,
                isfeatured: p.isfeatured ?? false,
                salesaccountid: p.salesaccountid ?? "",
                purchaseaccountid: p.purchaseaccountid ?? "",
                serviceaccountid: p.serviceaccountid ?? "",
                status: p.status ?? true,
            });
        }
    }, [productData]);


    const formatDateForInput = (date: string | Date | null | undefined) => {
        if (!date) return "";
        const d = new Date(date);
        return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    // === Generic nested update handler ===
    const addProductVariant = () => {
        setFormData(prev => {
            const clone = JSON.parse(JSON.stringify(prev.productvariants[0]));
            delete clone.id;
            delete clone._id;
            // ✅ assign a fresh temporary client-side id
            clone.tempid = uuidv4();
            return {
            ...prev,
            productvariants: [...prev.productvariants, clone],
            };
        });
    };

    const removeProductVariant = (indexToRemove: number) => {
        setFormData((prev) => ({
            ...prev,
            productvariants: prev.productvariants.filter(
                (_, index) => index !== indexToRemove
            ),
        }));
    };

    const addServiceVariant = () => {
        setFormData(prev => {
            const clone = JSON.parse(JSON.stringify(prev.servicevariants[0]));
            delete clone.id;
            delete clone._id;
            clone.tempid = uuidv4();

            return {
            ...prev,
            servicevariants: [...prev.servicevariants, clone],
            };
        });
    };

    const removeServiceVariant = (indexToRemove: number) => {
        setFormData((prev) => ({
            ...prev,
            servicevariants: prev.servicevariants.filter(
                (_, index) => index !== indexToRemove
            ),
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let val: any;

        if (type === "checkbox" && e.target instanceof HTMLInputElement) {
            val = e.target.checked;
        } else {
            val = value;
        }

        const keys = name.split(".");

        setFormData(prev => {
            const updated = { ...prev };
            let curr: any = updated;

            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const nextKey = keys[i + 1];
                const isArrayIndex = nextKey !== undefined && /^\d+$/.test(nextKey);

                if (i === keys.length - 1) {
                    curr[key] = val;
                } else {
                    if (curr[key] === undefined) curr[key] = isArrayIndex ? [] : {};

                    if (isArrayIndex) {
                        const index = parseInt(nextKey, 10);
                        if (!curr[key][index]) curr[key][index] = {};
                        curr = curr[key][index];
                        i++;
                    } else {
                        curr = curr[key];
                    }
                }
            }

            return updated;
        });
    };

    const validate = () => {
        const newErrors: { [key: string]: string } = {};

        // Required fields
        if (!formData.name) newErrors.name = "Name is required";
        if (!formData.categoryid) newErrors.categoryid = "Category is required";
        if (!formData.brandid) newErrors.brandid = "Brand is required";
        if (!formData.baseunitid) newErrors.baseunitid = "Base unit is required";

        // Product variants validation
        if (!formData.isservice && (!formData.productvariants || formData.productvariants.length === 0)) {
            newErrors.productvariants = "At least one product variant is required";
        } else {
            formData.productvariants.forEach((variant, index) => {
                if (!variant.unitconversions || variant.unitconversions.length === 0) {
                    newErrors[`productvariants[${index}].unitconversions`] = "At least one unit conversion is required";
                }
            });
        }

        return newErrors;
    };

    const uploadImage = async () => {
        if (!selectedFile) return null;
        const { data } = await uploadImageMutation({
            variables: { file: selectedFile },
        });
        return data?.uploadImage?.url || null;
    };

    const generatePayload = async (): Promise<any> => {
        const uploadedUrl = selectedFile ? await uploadImage() : formData.imageurl;

        const parseDate = (val: any) => {
            const d = val ? new Date(val) : new Date();
            return isNaN(d.getTime()) ? new Date() : d;
        };

        const payload = {
            ...formData,

            // Optional ObjectIds cleanup
            categoryid: formData.categoryid?.trim() || undefined,
            subcategoryid: formData.subcategoryid?.trim() || undefined,
            groupid: formData.groupid?.trim() || undefined,
            modelid: formData.modelid?.trim() || undefined,
            brandid: formData.brandid?.trim() || undefined,
            sizeid: formData.sizeid?.trim() || undefined,

            salesaccountid: formData.salesaccountid?.trim() || undefined,
            purchaseaccountid: formData.purchaseaccountid?.trim() || undefined,
            serviceaccountid: formData.serviceaccountid?.trim() || undefined,

            // Image handling
            imageurl: uploadedUrl,
            imagename: selectedFile ? selectedFile.name : formData.imagename,

            // SEO
            seo: {
                ...formData.seo,
                keywords: Array.isArray(formData.seo?.keywords)
                    ? formData.seo.keywords
                    : formData.seo?.keywords?.split(",").map(k => k.trim()).filter(Boolean) || [],
            },

            // Product Variants
            productvariants: formData.isservice
                ? []
                : (formData.productvariants || []).map(variant => ({
                    ...variant,
                    id: variant.id || variant._id || undefined,
                    productcode: variant.productcode?.trim() || "",
                    productbarcode: variant.productbarcode?.trim() || "",
                    gst: Number(variant.gst) || 0,
                    openingstock: Number(variant.openingstock) || 0,
                    openingstockamount: Number(variant.openingstockamount) || 0,
                    currentstock: Number(variant.currentstock) || 0,
                    currentstockamount: Number(variant.currentstockamount) || 0,
                    closingstock: Number(variant.closingstock) || 0,
                    closingstockamount: Number(variant.closingstockamount) || 0,
                    minimumstock: Number(variant.minimumstock) || 0,
                    reorderlevel: Number(variant.reorderlevel) || 0,

                    baseunitid: variant.baseunitid?.trim() || undefined,
                    salesunitid: variant.salesunitid?.trim() || undefined,
                    purchaseunitid: variant.purchaseunitid?.trim() || undefined,

                    unitconversions: (variant.unitconversions?.length
                        ? variant.unitconversions
                        : [{ unitid: "", factor: 1 }]
                    ).map(u => ({
                        unitid: u.unitid?.trim() || undefined,
                        factor: Number(u.factor) || 1,
                    })),

                    isserialised: !!variant.isserialised,

                    serials: (variant.serials || []).map(s => ({
                        ...s,
                        addedon: parseDate(s.addedon).toISOString(),
                        soldon: s.soldon ? parseDate(s.soldon).toISOString() : null,
                        returnedon: s.returnedon ? parseDate(s.returnedon).toISOString() : null,
                    })),

                    pricing: (variant.pricing?.length
                        ? variant.pricing
                        : [{
                            region: "default",
                            channel: "enduser",
                            unitprices: [{
                                unitid: "",
                                mrp: 0,
                                salesrate: 0,
                                purchaserate: 0,
                                discount: 0,
                                discounttype: "fixed",
                                offerprice: 0,
                            }],
                        }]
                    ).map(price => ({
                        region: price.region?.trim() || "default",
                        channel: price.channel?.trim() || "enduser",
                        unitprices: (price.unitprices?.length ? price.unitprices : [{
                            unitid: "",
                            mrp: 0,
                            salesrate: 0,
                            purchaserate: 0,
                            discount: 0,
                            discounttype: "fixed",
                            offerprice: 0,
                        }]).map(up => ({
                            unitid: up.unitid?.trim() || "",
                            mrp: Number(up.mrp) || 0,
                            salesrate: Number(up.salesrate) || 0,
                            purchaserate: Number(up.purchaserate) || 0,
                            discount: Number(up.discount) || 0,
                            discounttype: up.discounttype?.trim() || "fixed",
                            offerprice: Number(up.offerprice) || 0,
                        })),
                    })),

                    productlikecount: Number(variant.productlikecount) || 0,
                })),

            // Service Variants
            servicevariants: formData.isservice
                ? (formData.servicevariants || []).map(service => ({
                    ...service,
                     id: service.id || service._id || undefined,
                    servicerate: Number(service.servicerate) || 0,
                    requiresappointment: !!service.requiresappointment,
                    isRecurring: !!service.isRecurring,
                    duration: {
                        amount: Number(service.duration?.amount) || 0,
                        unit: service.duration?.unit || "",
                    },
                    recurrence: {
                        interval: service.recurrence?.interval || "",
                        count: Number(service.recurrence?.count) || 0,
                    },
                    availabilityslots: (service.availabilityslots || []).map(slot => ({
                        ...slot,
                        from: slot.from || "",
                        to: slot.to || "",
                    })),
                }))
                : [],

            // Booleans
            isshowinpos: !!formData.isshowinpos,
            isfeatured: !!formData.isfeatured,
            status: !!formData.status,
        };

        return deepClean(payload);
    };

    const deepClean = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(deepClean);
        if (obj && typeof obj === "object") {
            const result: any = {};
            for (const key in obj) {
                // ❌ Skip GraphQL-internal + frontend-only keys
                if (["__typename", "_id", "tempid"].includes(key)) continue;

                result[key] = deepClean(obj[key]);
            }
            return result;
        }
        return obj;
    };

    const handleSubmit = async () => {
        const payload = await generatePayload();
        console.log("Generated Payload:", JSON.stringify(payload, null, 2));
        try {
            if (isEdit) {
                await updateProductServiceMutation({
                    variables: { id, input: payload },
                });
                dispatch(showMessage({ message: "Updated successfully", type: "success" }));
            } else {
                await addProductServiceMutation({
                    variables: { input: payload },
                });
                dispatch(showMessage({ message: "Added successfully", type: "success" }));
            }
            navigate("/products");
        } catch (err) {
            console.error("❌ GraphQL Error:", err);
            if (err.graphQLErrors) {
                console.error("GraphQL Errors:", JSON.stringify(err.graphQLErrors, null, 2));
            }
            if (err.networkError) {
                console.error("Network Error:", JSON.stringify(err.networkError, null, 2));
            }
            dispatch(showMessage({ message: "Failed", type: "error" }));
        }
    };

    const subcategoryOptions =
        formData.categoryid && subCategoryDate?.getSubCategories
            ? subCategoryDate.getSubCategories
                .filter((s) => s.category?.id === formData.categoryid)
                .map((s) => ({ value: s.id, label: s.subcategoryname }))
            : [];

    return (
        <HomeLayout>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 py-6">
                {/* === GENERAL INFO === */}
                <div className="space-y-6">
                    <fieldset className="border rounded-xl p-4 space-y-4">
                        <legend className="text-sm font-medium px-2">General Details</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField label="Name" name="name" placeholder="Enter product name" value={formData.name} onChange={handleChange} />
                            <FormField label="Image" name="imageurl" type="file" accept="image/*" onChange={handleImageChange} previewUrl={formData.imageurl} />
                            <FormField label="Category" name="categoryid" type="select" placeholder="Select category" options={categoryData?.getCategories.map(c => ({ value: c.id, label: c.categoryname })) || []} value={formData.categoryid} onChange={handleChange} searchable />
                            <FormField label="Subcategory" name="subcategoryid" type="select" placeholder="Select subcategory" options={subcategoryOptions} value={formData.subcategoryid} onChange={handleChange} searchable />
                            <FormField label="Brand" name="brandid" type="select" placeholder="Select brand" options={brandData?.getBrands.map(b => ({ value: b.id, label: b.brandname })) || []} value={formData.brandid} onChange={handleChange} searchable />
                            <FormField label="Product Group" name="groupid" type="select" placeholder="Select group" options={groupData?.getProductGroups.map(g => ({ value: g.id, label: g.productgroupname })) || []} value={formData.groupid} onChange={handleChange} searchable />
                            <FormField label="Model" name="modelid" type="select" placeholder="Select model" options={modelData?.getModels.map(m => ({ value: m.id, label: m.modelname })) || []} value={formData.modelid} onChange={handleChange} searchable />
                            <FormField label="Size" name="sizeid" type="select" placeholder="Select size" options={sizeData?.getSizes.map(s => ({ value: s.id, label: s.sizename })) || []} value={formData.sizeid} onChange={handleChange} searchable />
                            {
                                isEdit && (
                                    <BarcodeImage
                                        value={
                                            (!formData.isservice
                                                ? formData.productvariants?.[0]?.productbarcode
                                                : ""
                                            ) || ""
                                        }
                                        align="start"
                                    />
                                )
                            }
                            <div className="md:col-span-2 lg:col-span-3">
                                <FormField label="Description" name="description" placeholder="Enter description" value={formData.description} onChange={handleChange} multiline />
                            </div>
                        </div>
                    </fieldset>
                </div>

                {/* === SEO, OPTIONS, ACCOUNTS === */}
                <div className="space-y-6">
                    <fieldset className="border rounded-xl p-4 space-y-4">
                        <legend className="text-sm font-medium px-2">SEO</legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <FormField label="Meta Title" name="seo.metatitle" placeholder="Meta title for SEO" value={formData.seo.metatitle} onChange={handleChange} />
                            <FormField label="Meta Description" name="seo.metadescription" placeholder="Meta description for SEO" value={formData.seo.metadescription} onChange={handleChange} />
                            <FormField label="Keywords" name="seo.keywords" placeholder="SEO keywords, comma separated" value={formData.seo.keywords} onChange={handleChange} />
                            <FormField label="Slug" name="seo.slug" placeholder="URL slug, e.g. /product-slug" value={formData.seo.slug} onChange={handleChange} />
                        </div>
                    </fieldset>

                    <fieldset className="border rounded-xl p-4 space-y-4">
                        <legend className="text-sm font-medium px-2">Options</legend>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                            <FormField label="Show In POS" name="isshowinpos" type="checkbox" value={formData.isshowinpos} onChange={handleChange} />
                            <FormField label="Featured" name="isfeatured" type="checkbox" value={formData.isfeatured} onChange={handleChange} />
                            <FormField label="Status" name="status" type="checkbox" value={formData.status} onChange={handleChange} />
                            <FormField label="Is Service" name="isservice" type="checkbox" value={formData.isservice} onChange={handleChange} />
                        </div>
                    </fieldset>

                    <fieldset className="border rounded-xl p-4 space-y-4">
                        <legend className="text-sm font-medium px-2">Accounts</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField label="Sales Account" name="salesaccountid" type="select" placeholder="Select sales account" options={accountData?.getAccounts.map(a => ({ value: a.id, label: a.name })) || []} value={formData.salesaccountid} onChange={handleChange} searchable />
                            <FormField label="Purchase Account" name="purchaseaccountid" type="select" placeholder="Select purchase account" options={accountData?.getAccounts.map(a => ({ value: a.id, label: a.name })) || []} value={formData.purchaseaccountid} onChange={handleChange} searchable />
                            {formData.isservice && (<FormField label="Service Account" name="serviceaccountid" type="select" placeholder="Select service account" options={accountData?.getAccounts.map(a => ({ value: a.id, label: a.name })) || []} value={formData.serviceaccountid} onChange={handleChange} searchable />)}
                        </div>
                    </fieldset>
                </div>
            </div>

            {/* === PRODUCT AND SERVICE === */}
            <div className="px-4 pb-6 space-y-6">
                {formData.isservice ? (
                    <>
                        {formData.servicevariants.map((variant, index) => (
                            <fieldset key={index} className="border rounded-xl p-4 space-y-2 relative">
                                <legend className="text-sm font-medium px-2">Service Variant {index + 1}</legend>

                                {formData.servicevariants.length > 1 && (
                                    <button type="button" onClick={() => removeServiceVariant(index)} className="absolute bottom-2 right-4 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white z-10">Remove Service Variant</button>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-3">
                                    {[
                                        { label: "Name", name: "name" },
                                        { label: "Service Rate", name: "servicerate", type: "number" },
                                        { label: "Unit of Measure", name: "uom" },
                                        { label: "Duration Amount", name: "duration.amount", type: "number" },
                                        { label: "Duration Unit", name: "duration.unit", type: "select", options: [{ label: "Minutes", value: "minutes" }, { label: "Hours", value: "hours" }] },
                                        { label: "Requires Appointment", name: "requiresappointment", type: "checkbox" },
                                        { label: "Location Type", name: "locationType", type: "select", options: [{ label: "Onsite", value: "onsite" }, { label: "Offsite", value: "offsite" }, { label: "Remote", value: "remote" }] },
                                        { label: "Is Recurring", name: "isRecurring", type: "checkbox" },
                                        { label: "Recurrence Interval", name: "recurrence.interval", type: "select", options: [{ label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }] },
                                        { label: "Recurrence Count", name: "recurrence.count", type: "number" },
                                        { label: "Remarks", name: "remarks" },
                                        { label: "Service Like Count", name: "servicelikecount", type: "number" },
                                    ].map(({ label, name, type, options }) => (
                                        <FormField key={name} label={label} placeholder={label} name={`servicevariants.${index}.${name}`} type={(type ?? 'text') as InputType} options={options} value={name.includes(".") ? name.split(".").reduce((o, i) => o[i], variant) : variant[name]} onChange={handleChange} searchable />
                                    ))}
                                </div>

                                {/* Availability Slots */}
                                <div className="border-t border-gray-200 pt-4 space-y-4">
                                    <h4 className="text-sm font-semibold">Availability Slots</h4>
                                    {variant.availabilityslots.map((slot, slotIndex) => (
                                        <div key={slotIndex} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 border border-gray-200 p-3 rounded relative bg-gray-50">
                                            <button type="button" onClick={() => setFormData(prev => { const updated = { ...prev }; updated.servicevariants[index].availabilityslots = updated.servicevariants[index].availabilityslots.filter((_, i) => i !== slotIndex); return updated; })} className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white">Remove Slot</button>
                                            {[{ label: "Day", name: "day", type: "multiselect", options: [{ label: "Mon", value: "mon" }, { label: "Tue", value: "tue" }, { label: "Wed", value: "wed" }, { label: "Thu", value: "thu" }, { label: "Fri", value: "fri" }, { label: "Sat", value: "sat" }, { label: "Sun", value: "sun" }] }, { label: "From", name: "from", type: "time" }, { label: "To", name: "to", type: "time" }].map(({ label, name, type, options }) => (<FormField key={name} label={label} placeholder={label} name={`servicevariants.${index}.availabilityslots.${slotIndex}.${name}`} type={(type ?? 'text') as InputType} options={options} value={slot[name]} onChange={handleChange} searchable />))}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setFormData(prev => { const updated = { ...prev }; updated.servicevariants[index].availabilityslots = [...updated.servicevariants[index].availabilityslots, { day: "", from: "", to: "" }]; return updated; })} className="px-3 py-1 border rounded text-sm">➕ Add Slot</button>
                                </div>
                            </fieldset>
                        ))}

                        <button type="button" onClick={addServiceVariant} className="px-4 py-1 border rounded">➕ Add Service Variant</button>
                    </>
                ) : (
                    <>
                        {formData.productvariants.map((variant, index) => (
                            <fieldset key={index} className="relative border border-gray-300 rounded-xl p-4 space-y-2">
                                <legend className="text-sm font-semibold px-2">Product Variant {index + 1}</legend>

                                {formData.productvariants.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeProductVariant(index)}
                                        className="absolute bottom-2 right-4 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white z-10"
                                    >
                                        Remove Product Variant
                                    </button>
                                )}

                                {/* ✅ Core Info */}
                                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 gap-4">
                                    {[
                                        { label: "Name", name: "name" },
                                        { label: "SKU", name: "sku" },
                                        { label: "Product Code", name: "productcode" },
                                        { label: "Product Barcode", name: "productbarcode" },
                                        { label: "Batch Number", name: "batchnumber" },
                                        { label: "Manufacture Date", name: "manufacturedate", type: "date" },
                                        { label: "Expiry Date", name: "expirydate", type: "date" },
                                    ].map(({ label, name, type }) => (
                                        <FormField
                                            key={name}
                                            label={label}
                                            placeholder={label}
                                            name={`productvariants.${index}.${name}`}
                                            type={(type ?? "text") as InputType}
                                            value={variant[name]}
                                            onChange={handleChange}
                                        />
                                    ))}
                                    <FormField
                                        label="Base Unit"
                                        placeholder="Base Unit"
                                        name={`productvariants.${index}.baseunitid`}
                                        type="select"
                                        options={unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname })) || []}
                                        value={variant.baseunitid}
                                        onChange={handleChange}
                                        searchable
                                    />
                                </div>

                                {/* ✅ Unit Conversions */}
                                <div className="border-t border-gray-300 pt-4 space-y-4">
                                    <h4 className="text-sm font-semibold">Unit Conversions</h4>
                                    {variant.unitconversions?.map((conv, convIndex) => (
                                        <div key={convIndex} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 border p-3 rounded bg-gray-50 relative">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => {
                                                    const updated = { ...prev };
                                                    updated.productvariants[index].unitconversions = (updated.productvariants[index].unitconversions || []).filter((_, i) => i !== convIndex);
                                                    return updated;
                                                })}
                                                className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                            >
                                                Remove Unit
                                            </button>
                                            <FormField
                                                label="Unit"
                                                placeholder="Unit"
                                                name={`productvariants.${index}.unitconversions.${convIndex}.unitid`}
                                                type="select"
                                                options={unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname })) || []}
                                                value={conv.unitid}
                                                onChange={handleChange}
                                                searchable
                                            />
                                            <FormField
                                                label="Factor"
                                                placeholder="Factor"
                                                name={`productvariants.${index}.unitconversions.${convIndex}.factor`}
                                                type="number"
                                                value={conv.factor}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => {
                                            const updated = { ...prev };
                                            const variants = [...updated.productvariants];
                                            const current = variants[index];
                                            const conversions = current.unitconversions || [];
                                            variants[index] = { ...current, unitconversions: [...conversions, { unitid: "", factor: 1 }] };
                                            updated.productvariants = variants;
                                            return updated;
                                        })}
                                        className="px-3 py-1 border rounded text-sm"
                                    >
                                        ➕ Add Unit Conversion
                                    </button>
                                </div>

                                {/* ✅ Stock & Pricing */}
                                <div className="border-t border-gray-300 pt-4 grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4">
                                    {[
                                        { label: "GST (%)", name: "gst", type: "number" },
                                        { label: "HSN Code", name: "hsncode" },
                                        "openingstock",
                                        "openingstockamount",
                                        "currentstock",
                                        "currentstockamount",
                                        "closingstock",
                                        "closingstockamount",
                                        "minimumstock",
                                        "reorderlevel",
                                        "racklocation"
                                    ].map(field =>
                                        typeof field === "string" ? (
                                            <FormField
                                                key={field}
                                                label={field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                                                placeholder={field}
                                                name={`productvariants.${index}.${field}`}
                                                type={field.includes('stock') || field.includes('amount') ? 'number' : 'text'}
                                                value={variant[field]}
                                                onChange={handleChange}
                                            />
                                        ) : (
                                            <FormField
                                                key={field.name}
                                                label={field.label}
                                                placeholder={field.label}
                                                name={`productvariants.${index}.${field.name}`}
                                                type={(field.type ?? 'text') as InputType}
                                                value={variant[field.name]}
                                                onChange={handleChange}
                                            />
                                        )
                                    )}
                                </div>

                                {/* ✅ Pricing */}
                                <div className="border-t border-gray-300 pt-4 space-y-4">
                                    <h4 className="text-sm font-medium">Pricing</h4>

                                    {variant.pricing?.map((price, priceIndex) => (
                                        <div
                                            key={priceIndex}
                                            className="space-y-4 border p-4 rounded bg-gray-50 relative"
                                        >
                                            {/* Remove Button */}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormData((prev) => {
                                                        const updated = { ...prev };
                                                        updated.productvariants[index].pricing = (
                                                            updated.productvariants[index].pricing || []
                                                        ).filter((_, i) => i !== priceIndex);
                                                        return updated;
                                                    })
                                                }
                                                className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                            >
                                                Remove
                                            </button>

                                            {/* Region & Channel Row */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    label="Region"
                                                    placeholder="Region"
                                                    name={`productvariants.${index}.pricing.${priceIndex}.region`}
                                                    type="select"
                                                    options={regionOptions}
                                                    value={price.region || "default"}
                                                    onChange={handleChange}
                                                />

                                                <FormField
                                                    label="Channel"
                                                    placeholder="Channel"
                                                    name={`productvariants.${index}.pricing.${priceIndex}.channel`}
                                                    type="select"
                                                    options={[
                                                        { value: "enduser", label: "End User" },
                                                        { value: "retail", label: "Retail" },
                                                        { value: "dealer", label: "Dealer" },
                                                        { value: "distributor", label: "Distributor" },
                                                        { value: "superstockist", label: "Super Stockist" },
                                                        { value: "exporter", label: "Exporter" },
                                                    ]}
                                                    value={price.channel || "enduser"}
                                                    onChange={handleChange}
                                                />
                                            </div>

                                            {/* Unit Prices Block */}
                                            <div className="space-y-3">
                                                {price.unitprices?.map((up, upIndex) => (
                                                    <div
                                                        key={upIndex}
                                                        className="grid grid-cols-1 md:grid-cols-7 gap-2 rounded bg-white"
                                                    >
                                                        {/* Unit */}
                                                        <FormField
                                                            label="Unit"
                                                            placeholder="Unit"
                                                            name={`productvariants.${index}.pricing.${priceIndex}.unitprices.${upIndex}.unitid`}
                                                            type="select"
                                                            options={
                                                                unitData?.getUnits.map((u) => ({
                                                                    value: u.id,
                                                                    label: u.unitname,
                                                                })) || []
                                                            }
                                                            value={up.unitid}
                                                            onChange={handleChange}
                                                            searchable
                                                        />

                                                        {/* Numeric fields */}
                                                        {["mrp", "salesrate", "purchaserate", "discount", "offerprice"].map(
                                                            (key) => (
                                                                <FormField
                                                                    key={key}
                                                                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                                                                    placeholder={key}
                                                                    name={`productvariants.${index}.pricing.${priceIndex}.unitprices.${upIndex}.${key}`}
                                                                    type="number"
                                                                    value={up[key]}
                                                                    onChange={handleChange}
                                                                />
                                                            )
                                                        )}

                                                        {/* Discount Type */}
                                                        <FormField
                                                            label="Discount Type"
                                                            name={`productvariants.${index}.pricing.${priceIndex}.unitprices.${upIndex}.discounttype`}
                                                            type="select"
                                                            options={[
                                                                { label: "Fixed", value: "fixed" },
                                                                { label: "Percentage", value: "percentage" },
                                                            ]}
                                                            value={up.discounttype}
                                                            onChange={handleChange}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Pricing Button */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData((prev) => {
                                                const updated = { ...prev };
                                                updated.productvariants[index].pricing = [
                                                    ...(updated.productvariants[index].pricing || []),
                                                    {
                                                        regionid: "",
                                                        channel: "default",
                                                        unitprices: [
                                                            {
                                                                unitid: "",
                                                                mrp: 0,
                                                                salesrate: 0,
                                                                purchaserate: 0,
                                                                discount: 0,
                                                                discounttype: "fixed",
                                                                offerprice: 0,
                                                            },
                                                        ],
                                                    },
                                                ];
                                                return updated;
                                            })
                                        }
                                        className="px-3 py-1 border rounded text-sm"
                                    >
                                        ➕ Add Pricing
                                    </button>
                                </div>

                                {/* ✅ Serialised */}
                                <div className="border-t border-gray-300 pt-4 space-y-2">
                                    <FormField
                                        label="Is Serialised"
                                        name={`productvariants.${index}.isserialised`}
                                        type="checkbox"
                                        value={variant.isserialised}
                                        onChange={handleChange}
                                    />
                                    {variant.serials?.map((serial, serialIndex) => (
                                        <div key={serialIndex} className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4 p-3 border rounded bg-gray-50 relative">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => {
                                                    const updated = { ...prev };
                                                    updated.productvariants[index].serials = (updated.productvariants[index].serials || []).filter((_, i) => i !== serialIndex);
                                                    return updated;
                                                })}
                                                className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                            >
                                                Remove Serial
                                            </button>
                                            {["imei", "serialnumber", "lotnumber", "status", "remarks"].map(field => (
                                                <FormField
                                                    key={field}
                                                    label={field.charAt(0).toUpperCase() + field.slice(1)}
                                                    placeholder={field}
                                                    name={`productvariants.${index}.serials.${serialIndex}.${field}`}
                                                    type={field === "status" ? "select" : "text"}
                                                    options={
                                                        field === "status"
                                                            ? ["available", "sold", "returned", "damaged", "transferred"].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))
                                                            : undefined
                                                    }
                                                    value={serial[field]}
                                                    onChange={handleChange}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData(prev => {
                                                const updated = { ...prev };
                                                updated.productvariants[index].serials = [
                                                    ...(updated.productvariants[index].serials || []),
                                                    { imei: "", serialnumber: "", lotnumber: "", status: "available", addedon: new Date(), soldon: null, returnedon: null, remarks: "" },
                                                ];
                                                return updated;
                                            })
                                        }
                                        className="px-3 py-1 border rounded text-sm"
                                    >
                                        ➕ Add Serial
                                    </button>
                                </div>
                            </fieldset>
                        ))}

                        <button type="button" onClick={addProductVariant} className="px-4 py-1 border rounded">
                            ➕ Add Product Variant
                        </button>
                    </>

                )}
            </div>

            {/* === BUTTONS === */}
            <div className="flex justify-end gap-4 px-4 py-2 mb-6">
                <Button variant="outline" onClick={() => navigate('/products')}>
                    Cancel
                </Button>
                <Button variant="outline" onClick={handleSubmit}>
                    {isEdit ? 'Update Product Service' : 'Add Product Service'}
                </Button>
            </div>
        </HomeLayout>
    );
};

export default AddEditProductService;

