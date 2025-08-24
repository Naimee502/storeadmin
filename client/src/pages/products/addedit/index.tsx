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

    const productOptions = [
        { value: 'prod1', label: 'Product 1' },
        { value: 'prod2', label: 'Product 2' },
        { value: 'prod3', label: 'Product 3' },
    ];

    const variantOptions = [
        { value: 'var1', label: 'Variant A' },
        { value: 'var2', label: 'Variant B' },
        { value: 'var3', label: 'Variant C' },
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
                salesunitid: "",
                purchaseunitid: "",
                unitConversions: [
                    {
                        fromunitid: "",
                        tounitid: "",
                        factor: null,
                    },
                ],
                mrp: null,
                purchaserate: null,
                gst: null,
                hsncode: "",
                openingstock: null,
                openingstockamount: null,
                currentstock: null,
                currentstockamount: null,
                closingstock: null,
                closingstockamount: null,
                minimumstock: null,
                reorderlevel: null,
                racklocation: "",
                isserialised: false,
                serials: [
                    {
                        imei: "",
                        serialnumber: "",
                        lotnumber: "",
                        status: "available",
                        remarks: "",
                    },
                ],
                salesrate: [
                    {
                        regionname: "",
                        currency: "INR",
                        enduser: null,
                        retail: null,
                        dealer: null,
                        superstockist: null,
                        distributor: null,
                        exporter: null,
                    },
                ],
                offer: {
                    isoffer: false,
                    type: "",
                    title: "",
                    startdate: "",
                    enddate: "",
                    discounttype: "",
                    offerprice: null,
                    comboitems: [
                        {
                            productid: "",
                            variantid: "",
                            quantity: null,
                        },
                    ],
                    channel: {
                        enduser: false,
                        retail: false,
                        dealer: false,
                        superstockist: false,
                        distributor: false,
                        exporter: false,
                    },
                },
                productlikecount: null,
            },
        ],
        servicevariants: [
            {
                name: "",
                servicecode: "",
                servicebarcode: "",
                servicerate: null,
                uom: "",
                duration: {
                    amount: null,
                    unit: "",
                },
                requiresappointment: false,
                availabilityslots: [
                    {
                        day: "",
                        from: "",
                        to: "",
                    },
                ],
                locationType: "",
                isRecurring: false,
                recurrence: {
                    interval: "",
                    count: null,
                },
                servicelikecount: null,
                remarks: "",
            },
        ],
        isshowinpos: false,
        isfeatured: false,
        salesaccountid: "",
        purchaseaccountid: "",
        serviceaccountid: null,
        status: true,
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (isEdit && productData?.getProductServiceById) {
            const p = JSON.parse(JSON.stringify(productData.getProductServiceById)); // 🔹 Deep clone

            setFormData({
                adminid: p.admin?.id ?? adminId ?? "",
                branchid: p.branchid?.id ?? branchId ?? "",
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
                        unitConversions: variant.unitConversions?.length
                            ? variant.unitConversions
                            : [{ fromunitid: "", tounitid: "", factor: null }],
                        serials: variant.serials?.length
                            ? variant.serials
                            : [{ imei: "", serialnumber: "", lotnumber: "", status: "available", remarks: "" }],
                        salesrate: variant.salesrate?.length
                            ? variant.salesrate
                            : [{
                                regionname: "",
                                currency: "INR",
                                enduser: null,
                                retail: null,
                                dealer: null,
                                superstockist: null,
                                distributor: null,
                                exporter: null,
                            }],
                        offer: {
                            isoffer: variant.offer?.isoffer ?? false,
                            type: variant.offer?.type ?? "",
                            title: variant.offer?.title ?? "",
                            startdate: formatDateForInput(variant.offer?.startdate),
                            enddate: formatDateForInput(variant.offer?.enddate),
                            discounttype: variant.offer?.discounttype ?? "",
                            offerprice: variant.offer?.offerprice ?? null,
                            comboitems: variant.offer?.comboitems?.length
                                ? variant.offer.comboitems
                                : [{ productid: "", variantid: "", quantity: null }],
                            channel: {
                                enduser: variant.offer?.channel?.enduser ?? false,
                                retail: variant.offer?.channel?.retail ?? false,
                                dealer: variant.offer?.channel?.dealer ?? false,
                                superstockist: variant.offer?.channel?.superstockist ?? false,
                                distributor: variant.offer?.channel?.distributor ?? false,
                                exporter: variant.offer?.channel?.exporter ?? false,
                            },
                        },
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
                            unitConversions: [{ fromunitid: "", tounitid: "", factor: null }],
                            mrp: null,
                            purchaserate: null,
                            gst: null,
                            hsncode: "",
                            openingstock: null,
                            openingstockamount: null,
                            currentstock: null,
                            currentstockamount: null,
                            closingstock: null,
                            closingstockamount: null,
                            minimumstock: null,
                            reorderlevel: null,
                            racklocation: "",
                            isserialised: false,
                            serials: [{ imei: "", serialnumber: "", lotnumber: "", status: "available", remarks: "" }],
                            salesrate: [{
                                regionname: "",
                                currency: "INR",
                                enduser: null,
                                retail: null,
                                dealer: null,
                                superstockist: null,
                                distributor: null,
                                exporter: null,
                            }],
                            offer: {
                                isoffer: false,
                                type: "",
                                title: "",
                                startdate: "",
                                enddate: "",
                                discounttype: "",
                                offerprice: null,
                                comboitems: [{ productid: "", variantid: "", quantity: null }],
                                channel: {
                                    enduser: false,
                                    retail: false,
                                    dealer: false,
                                    superstockist: false,
                                    distributor: false,
                                    exporter: false,
                                },
                            },
                            productlikecount: null,
                        },
                    ],
                servicevariants: (p.servicevariants || []).length > 0
                    ? p.servicevariants.map((service: any) => ({
                        ...service,
                        duration: {
                            amount: service.duration?.amount ?? null,
                            unit: service.duration?.unit ?? "",
                        },
                        availabilityslots: service.availabilityslots?.length
                            ? service.availabilityslots
                            : [{ day: "", from: "", to: "" }],
                        recurrence: {
                            interval: service.recurrence?.interval ?? "",
                            count: service.recurrence?.count ?? null,
                        },
                    }))
                    : [
                        {
                            name: "",
                            servicecode: "",
                            servicebarcode: "",
                            servicerate: null,
                            uom: "",
                            duration: { amount: null, unit: "" },
                            requiresappointment: false,
                            availabilityslots: [{ day: "", from: "", to: "" }],
                            locationType: "",
                            isRecurring: false,
                            recurrence: { interval: "", count: null },
                            servicelikecount: null,
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
        setFormData(prev => ({
            ...prev,
            productvariants: [
                ...prev.productvariants,
                JSON.parse(JSON.stringify(prev.productvariants[0])),
            ],
        }));
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
        setFormData(prev => ({
            ...prev,
            servicevariants: [
                ...prev.servicevariants,
                JSON.parse(JSON.stringify(prev.servicevariants[0])),
            ],
        }));
    };

    const removeServiceVariant = (indexToRemove: number) => {
        setFormData((prev) => ({
            ...prev,
            servicevariants: prev.servicevariants.filter(
                (_, index) => index !== indexToRemove
            ),
        }));
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === "checkbox" ? checked : value;
        const keys = name.split(".");

        setFormData((prev) => {
            const updated = { ...prev };
            let curr = updated;

            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];

                // If next key is numeric, treat it as array index
                const nextKey = keys[i + 1];
                const isArrayIndex = nextKey !== undefined && /^\d+$/.test(nextKey);

                // If last key, set the value
                if (i === keys.length - 1) {
                    curr[key] = val;
                } else {
                    // If key does not exist, create an object or array
                    if (curr[key] === undefined) {
                        curr[key] = isArrayIndex ? [] : {};
                    }

                    // If array, ensure the index exists
                    if (isArrayIndex) {
                        const index = parseInt(nextKey, 10);
                        if (!curr[key][index]) {
                            curr[key][index] = {};
                        }
                        curr = curr[key][index];
                        i++; // Skip index key since we handled it
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
                if (!variant.unitConversions || variant.unitConversions.length === 0) {
                    newErrors[`productvariants[${index}].unitConversions`] = "At least one unit conversion is required";
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

    const generatePayload = async () => {
        const uploadedUrl = selectedFile ? await uploadImage() : formData.imageurl;

        const payload = {
            ...formData,

            // ✅ Optional ObjectIds cleanup
            categoryid: formData.categoryid?.trim() || undefined,
            subcategoryid: formData.subcategoryid?.trim() || undefined,
            groupid: formData.groupid?.trim() || undefined,
            modelid: formData.modelid?.trim() || undefined,
            brandid: formData.brandid?.trim() || undefined,
            sizeid: formData.sizeid?.trim() || undefined,

            salesaccountid: formData.salesaccountid?.trim() || undefined,
            purchaseaccountid: formData.purchaseaccountid?.trim() || undefined,
            serviceaccountid: formData.serviceaccountid?.trim() || undefined,

            // ✅ Image handling
            imageurl: uploadedUrl,
            imagename: selectedFile ? selectedFile.name : formData.imagename,

            // ✅ SEO
            seo: {
                ...formData.seo,
                keywords: Array.isArray(formData.seo.keywords)
                    ? formData.seo.keywords
                    : formData.seo.keywords
                        ?.split(",")
                        .map(k => k.trim())
                        .filter(Boolean) || [],
            },

            // ✅ Product Variants
            productvariants: formData.isservice
                ? []
                : (formData.productvariants || []).map(variant => ({
                    ...variant,
                    mrp: Number(variant.mrp) || 0,
                    purchaserate: Number(variant.purchaserate) || 0,
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

                    unitConversions: (variant.unitConversions || []).map(u => ({
                        ...u,
                        fromunitid: u.fromunitid?.trim() || undefined,
                        tounitid: u.tounitid?.trim() || undefined,
                        factor: Number(u.factor),
                    })),

                    isserialised: !!variant.isserialised,

                    serials: (variant.serials || []).map(s => ({
                        ...s,
                        addedon: s.addedon || null,
                        soldon: s.soldon || null,
                        returnedon: s.returnedon || null,
                    })),

                    salesrate: (variant.salesrate || []).map(rate => ({
                        regionname: rate.regionname || "",
                        currency: rate.currency || "",
                        enduser: Number(rate.enduser) || 0,
                        retail: Number(rate.retail) || 0,
                        dealer: Number(rate.dealer) || 0,
                        superstockist: Number(rate.superstockist) || 0,
                        distributor: Number(rate.distributor) || 0,
                        exporter: Number(rate.exporter) || 0,
                    })),

                    offer: {
                        ...variant.offer,
                        isoffer: !!variant.offer?.isoffer,
                        type: variant.offer?.type?.trim() || undefined,
                        title: variant.offer?.title?.trim() || "",
                        startdate: variant.offer?.startdate?.trim() || undefined,
                        enddate: variant.offer?.enddate?.trim() || undefined,
                        discounttype: variant.offer?.discounttype?.trim() || undefined,
                        offerprice: Number(variant.offer?.offerprice) || 0,
                        comboitems: (variant.offer?.comboitems || [])
                            .filter(item => item.productid?.trim() && item.variantid?.trim())
                            .map(item => ({
                                productid: item.productid.trim(),
                                variantid: item.variantid.trim(),
                                quantity: Number(item.quantity) || 0,
                            })),
                        channel: {
                            enduser: !!variant.offer?.channel?.enduser,
                            retail: !!variant.offer?.channel?.retail,
                            dealer: !!variant.offer?.channel?.dealer,
                            superstockist: !!variant.offer?.channel?.superstockist,
                            distributor: !!variant.offer?.channel?.distributor,
                            exporter: !!variant.offer?.channel?.exporter,
                        },
                    },

                    productlikecount: Number(variant.productlikecount) || 0,
                })),

            // ✅ Service Variants
            servicevariants: formData.isservice
                ? (formData.servicevariants || []).map(service => ({
                    ...service,
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

            // ✅ Booleans
            isshowinpos: !!formData.isshowinpos,
            isfeatured: !!formData.isfeatured,
            status: !!formData.status,
        };

        return deepClean(payload);
    };

    const deepClean = (obj: any): any => {
        if (Array.isArray(obj)) {
            return obj.map(deepClean);
        } else if (obj && typeof obj === "object") {
            const result: any = {};
            for (const key in obj) {
                if (key === "__typename" || key === "_id") continue;
                result[key] = deepClean(obj[key]);
            }
            return result;
        }
        return obj;
    };

    const handleSubmit = async () => {
        const payload = await generatePayload();

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
                                <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4">
                                    {[
                                        { label: "Name", name: "name" },
                                        { label: "SKU", name: "sku" },
                                        { label: "Batch Number", name: "batchnumber" },
                                        { label: "Manufacture Date", name: "manufacturedate", type: "date" },
                                        { label: "Expiry Date", name: "expirydate", type: "date" },
                                    ].map(({ label, name, type }) => (
                                        <FormField
                                            key={name}
                                            label={label}
                                            placeholder={label}
                                            name={`productvariants.${index}.${name}`}
                                            type={(type ?? 'text') as InputType}
                                            value={variant[name]}
                                            onChange={handleChange}
                                        />
                                    ))}
                                </div>

                                {/* ✅ Units */}
                                <div className="border-t border-gray-300 pt-4 grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4">
                                    {[
                                        { label: "Base Unit", name: "baseunitid" },
                                        { label: "Sales Unit", name: "salesunitid" },
                                        { label: "Purchase Unit", name: "purchaseunitid" },
                                    ].map(({ label, name }) => (
                                        <FormField
                                            key={name}
                                            label={label}
                                            placeholder={label}
                                            name={`productvariants.${index}.${name}`}
                                            type="select"
                                            options={unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname })) || []}
                                            value={variant[name]}
                                            onChange={handleChange}
                                            searchable
                                        />
                                    ))}
                                </div>

                                {/* ✅ Unit Conversions */}
                                <div className="border-t border-gray-300 pt-4 space-y-4">
                                    <h4 className="text-sm font-semibold">Unit Conversions</h4>
                                    {variant.unitConversions?.map((conv, convIndex) => (
                                        <div key={convIndex} className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4 border p-3 rounded bg-gray-50 relative">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => {
                                                    const updated = { ...prev };
                                                    updated.productvariants[index].unitConversions = (updated.productvariants[index].unitConversions || []).filter((_, i) => i !== convIndex);
                                                    return updated;
                                                })}
                                                className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                            >
                                                Remove Unit
                                            </button>
                                            {[
                                                { label: "From Unit", name: "fromunitid", type: "select", options: unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname })) || [] },
                                                { label: "To Unit", name: "tounitid", type: "select", options: unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname })) || [] },
                                                { label: "Factor", name: "factor", type: "number" },
                                            ].map(({ label, name, type, options }) => (
                                                <FormField
                                                    key={name}
                                                    label={label}
                                                    placeholder={label}
                                                    name={`productvariants.${index}.unitConversions.${convIndex}.${name}`}
                                                    type={(type ?? 'text') as InputType}
                                                    options={options}
                                                    value={conv[name]}
                                                    onChange={handleChange}
                                                    searchable
                                                />
                                            ))}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData(prev => {
                                                const updated = { ...prev };
                                                const variants = [...updated.productvariants];
                                                const current = variants[index];
                                                const conversions = current.unitConversions || [];
                                                variants[index] = {
                                                    ...current,
                                                    unitConversions: [...conversions, { fromunitid: "", tounitid: "", factor: 1 }],
                                                };
                                                updated.productvariants = variants;
                                                return updated;
                                            })
                                        }
                                        className="px-3 py-1 border rounded text-sm"
                                    >
                                        ➕ Add Unit
                                    </button>
                                </div>

                                {/* ✅ Stock & Pricing */}
                                <div className="border-t border-gray-300 pt-4 grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4">
                                    {[
                                        { label: "MRP", name: "mrp", type: "number" },
                                        { label: "Purchase Rate", name: "purchaserate", type: "number" },
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
                                                type={(type ?? 'text') as InputType}
                                                value={variant[field.name]}
                                                onChange={handleChange}
                                            />
                                        )
                                    )}
                                </div>

                                {/* ✅ Sales Rates */}
                                <div className="border-t border-gray-300 pt-4 space-y-2">
                                    <label className="text-sm font-medium">Sales Rates</label>

                                    {variant.salesrate?.map((rate, rateIndex) => (
                                        <div
                                            key={rateIndex}
                                            className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4 p-3 border rounded bg-gray-50 relative"
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormData((prev) => {
                                                        const updated = { ...prev };
                                                        updated.productvariants[index].salesrate =
                                                            (updated.productvariants[index].salesrate || []).filter(
                                                                (_, i) => i !== rateIndex
                                                            );
                                                        return updated;
                                                    })
                                                }
                                                className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                            >
                                                Remove
                                            </button>

                                            <FormField
                                                label="Region Name"
                                                name={`productvariants.${index}.salesrate.${rateIndex}.regionname`}
                                                placeholder="Region Name"
                                                value={rate.regionname}
                                                onChange={handleChange}
                                            />

                                            <FormField
                                                label="Currency"
                                                name={`productvariants.${index}.salesrate.${rateIndex}.currency`}
                                                placeholder="Currency"
                                                value={rate.currency}
                                                onChange={handleChange}
                                            />

                                            {[
                                                "enduser",
                                                "retail",
                                                "dealer",
                                                "distributor",
                                                "superstockist",
                                                "exporter",
                                            ].map((type) => (
                                                <FormField
                                                    key={type}
                                                    label={type.charAt(0).toUpperCase() + type.slice(1)}
                                                    name={`productvariants.${index}.salesrate.${rateIndex}.${type}`}
                                                    placeholder={`${type}`}
                                                    type="number"
                                                    value={rate[type]}
                                                    onChange={handleChange}
                                                />
                                            ))}
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                productvariants: prev.productvariants.map((pv, i) =>
                                                    i === index
                                                        ? {
                                                            ...pv,
                                                            salesrate: [
                                                                ...(pv.salesrate || []),
                                                                {
                                                                    regionname: "",
                                                                    currency: "INR",
                                                                    enduser: 0,
                                                                    retail: 0,
                                                                    dealer: 0,
                                                                    superstockist: 0,
                                                                    distributor: 0,
                                                                    exporter: 0,
                                                                },
                                                            ],
                                                        }
                                                        : pv
                                                ),
                                            }))
                                        }
                                        className="px-3 py-1 border rounded text-sm"
                                    >
                                        ➕ Add Sales Rate
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
                                        <div key={serialIndex} className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4 p-3 border rounded bg-gray-50 relative ">
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
                                            {[
                                                { label: "IMEI", name: "imei" },
                                                { label: "Serial Number", name: "serialnumber" },
                                                { label: "Lot Number", name: "lotnumber" },
                                                {
                                                    label: "Status",
                                                    name: "status",
                                                    type: "select",
                                                    options: ["available", "sold", "returned", "damaged", "transferred"].map(v => ({
                                                        value: v,
                                                        label: v.charAt(0).toUpperCase() + v.slice(1),
                                                    })),
                                                },
                                                { label: "Remarks", name: "remarks" },
                                            ].map(({ label, name, type, options }) => (
                                                <FormField
                                                    key={name}
                                                    label={label.charAt(0).toUpperCase() + label.slice(1)}
                                                    placeholder={label.charAt(0).toUpperCase() + label.slice(1)}
                                                    name={`productvariants.${index}.serials.${serialIndex}.${name}`}
                                                    type={(type ?? 'text') as InputType}
                                                    options={options}
                                                    value={serial[name]}
                                                    onChange={handleChange}
                                                    searchable
                                                />
                                            ))}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData(prev => ({
                                                ...prev,
                                                productvariants: prev.productvariants.map((pv, i) =>
                                                    i === index
                                                        ? {
                                                            ...pv,
                                                            serials: [
                                                                ...(pv.serials || []),
                                                                { imei: "", serialnumber: "", lotnumber: "", status: "available", remarks: "" }
                                                            ],
                                                        }
                                                        : pv
                                                ),
                                            }))
                                        }
                                        className="px-3 py-1 border rounded text-sm"
                                    >
                                        ➕ Add Serial
                                    </button>
                                </div>

                                {/* ✅ Offer */}
                                <div className="border-t pt-4 space-y-4">
                                    <FormField
                                        label="Is Offer"
                                        name={`productvariants.${index}.offer.isoffer`}
                                        type="checkbox"
                                        value={variant.offer.isoffer}
                                        onChange={handleChange}
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4">
                                        {[
                                            { label: "Type", name: "type", type: "select", options: ["single", "combo"].map(v => ({ label: v, value: v })) },
                                            { label: "Title", name: "title" },
                                            { label: "Start Date", name: "startdate", type: "date" },
                                            { label: "End Date", name: "enddate", type: "date" },
                                            { label: "Discount Type", name: "discounttype", type: "select", options: ["fixed", "percentage"].map(v => ({ label: v, value: v })) },
                                            { label: "Offer Price", name: "offerprice", type: "number" },
                                        ].map(({ label, name, type, options }) => (
                                            <FormField
                                                key={name}
                                                label={label}
                                                placeholder={label}
                                                name={`productvariants.${index}.offer.${name}`}
                                                type={(type ?? 'text') as InputType}
                                                options={options}
                                                value={variant.offer[name]}
                                                onChange={handleChange}
                                                searchable
                                            />
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                        {Object.keys(variant.offer.channel || {}).map(channel => (
                                            <FormField
                                                key={channel}
                                                label={`Channel - ${channel}`}
                                                name={`productvariants.${index}.offer.channel.${channel}`}
                                                type="checkbox"
                                                value={variant.offer.channel[channel]}
                                                onChange={handleChange}
                                            />
                                        ))}
                                    </div>

                                    <h4 className="text-sm font-semibold mt-4">Combo Items</h4>
                                    {variant.offer.comboitems?.map((item, comboIndex) => (
                                        <div key={comboIndex} className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4 border p-3 rounded bg-gray-50 relative">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => {
                                                    const updated = { ...prev };
                                                    updated.productvariants[index].offer.comboitems =
                                                        (updated.productvariants[index].offer.comboitems || []).filter((_, i) => i !== comboIndex);
                                                    return updated;
                                                })}
                                                className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                            >
                                                Remove Combo Offer
                                            </button>
                                            {[
                                                { label: "Product", name: "productid", type: "select", options: productOptions },
                                                { label: "Variant", name: "variantid", type: "select", options: variantOptions },
                                                { label: "Quantity", name: "quantity", type: "number" },
                                            ].map(({ label, name, type, options }) => (
                                                <FormField
                                                    key={name}
                                                    label={label}
                                                    placeholder={label}
                                                    name={`productvariants.${index}.offer.comboitems.${comboIndex}.${name}`}
                                                   type={(type ?? 'text') as InputType}
                                                    options={options}
                                                    value={item[name]}
                                                    onChange={handleChange}
                                                    searchable
                                                />
                                            ))}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData(prev => {
                                                const updated = { ...prev };
                                                const variants = [...updated.productvariants];
                                                const current = variants[index];
                                                const offer = { ...current.offer };
                                                const comboitems = offer.comboitems || [];
                                                offer.comboitems = [...comboitems, { productid: "", variantid: "", quantity: 1 }];
                                                variants[index] = { ...current, offer };
                                                updated.productvariants = variants;
                                                return updated;
                                            })
                                        }
                                        className="px-3 py-1 border rounded text-sm"
                                    >
                                        ➕ Add Combo Offer
                                    </button>
                                </div>
                            </fieldset>
                        ))}
                        <button
                            type="button"
                            onClick={addProductVariant}
                            className="px-4 py-1 border rounded"
                        >
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
