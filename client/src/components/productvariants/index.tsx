import FormField from "../formfiled";
import BarcodeImage from "../barcode";

export type UnitsQuery = {
    getUnits: Array<{
        id: string;
        unitname: string;
    }>;
};

interface ProductVariantsProps {
    formData: any;
    handleChange: (e: React.ChangeEvent<any>) => void;
    addProductVariant: () => void;
    removeProductVariant: (index: number) => void;
    addUnitConversion: (variantIndex: number) => void;
    unitData?: UnitsQuery;
    removeUnitConversion: (variantIndex: number, convIndex: number) => void;
    addUnitPrice: (variantIndex: number) => void;
    removeUnitPrice: (variantIndex: number, unitPriceIndex: number) => void;
    addSerial: (variantIndex: number) => void;
    removeSerial: (variantIndex: number, serialIndex: number) => void;
    isEdit?: boolean;
    isserialised?: boolean;
    navigate: (path: string) => void;
    errors: any;
}

const LABELS: Record<string, string> = {
    // Product/Variant basics
    name: "Name",
    sku: "SKU",
    productcode: "Product Code",

    // Batch / Manufacturing
    batchnumber: "Batch Number",
    manufacturedate: "Manufacture Date",
    expirydate: "Expiry Date",
    hsncode: "HSN Code",
    gst: "GST",

    // Stock fields
    openingstock: "Opening Stock",
    currentstock: "Current Stock",
    closingstock: "Closing Stock",
    minimumstock: "Minimum Stock",
    reorderlevel: "Reorder Level",
    racklocation: "Rack Location",
    openingstockamount: "Opening Stock Amount",
    currentstockamount: "Current Stock Amount",
    closingstockamount: "Closing Stock Amount",

    // Line item fields
    quantity: "Quantity",
    unitid: "Unit",
    mrp: "MRP",
    salesrate: "Sales Rate",
    discount: "Discount",
    discounttype: "Discount Type",
    offerprice: "Offer Price",
};

export const ProductVariants: React.FC<ProductVariantsProps> = ({
    formData,
    handleChange,
    addProductVariant,
    removeProductVariant,
    addUnitConversion,
    removeUnitConversion,
    unitData,
    addUnitPrice,
    removeUnitPrice,
    addSerial,
    removeSerial,
    isEdit = false,
    isserialised = false,
    navigate,
    errors,
}) => (
    <>
        {formData.productvariants.map((variant, index) => (
            <fieldset key={variant.tempid || index} className="border rounded-xl p-4 mb-4 relative">
                <legend className="text-sm font-semibold px-2">Product Variant {index + 1}</legend>

                {formData.productvariants.length > 1 && (
                    <button
                        type="button"
                        className="absolute top-2 right-2 px-2 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                        onClick={() => removeProductVariant(index)}
                    >
                        Remove Product Variant
                    </button>
                )}

                {/* Core Fields */}
                <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-3 pt-8 pb-4">
                    {[
                        "name", "sku", "batchnumber", "manufacturedate", "expirydate",
                        "gst", "hsncode", "openingstock", "currentstock",
                        "closingstock", "minimumstock", "reorderlevel", "racklocation",
                        ...(isEdit ? ["productcode", "openingstockamount", "currentstockamount", "closingstockamount"] : []),
                    ].map((field) => (
                        <FormField
                            key={field}
                            label={LABELS[field.toLowerCase()] || field}
                            placeholder={field}
                            name={`productvariants.${index}.${field}`}
                            type={[
                                "gst", "openingstock", "openingstockamount",
                                "currentstock", "currentstockamount",
                                "closingstock", "closingstockamount",
                                "minimumstock", "reorderlevel",
                            ].includes(field)
                                ? "number"
                                : ["manufacturedate", "expirydate"].includes(field)
                                    ? "date"        // ✅ calendar input
                                    : "text"}
                            value={variant[field]}
                            onChange={handleChange}
                            disabled={isEdit && [
                                "productcode",
                                "openingstockamount",
                                "currentstockamount",
                                "closingstockamount",
                            ].includes(field)}
                        />
                    ))}

                    {/* Units + Purchase Rate remain always visible */}
                    <FormField
                        label="Base Unit"
                        placeholder="Base Unit"
                        name={`productvariants.${index}.baseunitid`}
                        type="select"
                        options={unitData?.getUnits.map((u) => ({ value: u.id, label: u.unitname })) || []}
                        value={variant.baseunitid}
                        onChange={handleChange}
                        searchable
                        addable onAddNew={() => navigate("/units")}
                        error={errors?.productvariants?.[index]?.baseunitid}
                    />

                    <FormField
                        label="Purchase Unit"
                        placeholder="Purchase Unit"
                        name={`productvariants.${index}.purchaseunitid`}
                        type="select"
                        options={unitData?.getUnits.map((u) => ({ value: u.id, label: u.unitname })) || []}
                        value={variant.purchaseunitid}
                        onChange={handleChange}
                        searchable
                        addable onAddNew={() => navigate("/units")}
                        error={errors?.productvariants?.[index]?.purchaseunitid}
                    />

                    <FormField
                        label="Purchase Rate"
                        placeholder="Purchase Rate"
                        name={`productvariants.${index}.purchaserate`}
                        type="number"
                        value={variant.purchaserate}
                        onChange={handleChange}
                        error={errors?.productvariants?.[index]?.purchaserate}
                    />
                </div>

                {/* Unit Conversions */}
                <div className="border-t pt-4 space-y-2 pb-4">
                    <h4 className="font-semibold">Unit Conversions</h4>
                    <div className="space-y-2">
                        {(variant.unitconversions || []).map((conv, convIndex) => (
                            <div key={convIndex} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border rounded bg-gray-50">
                                <FormField
                                    label="Unit"
                                    name={`productvariants.${index}.unitconversions.${convIndex}.unitid`}
                                    type="select"
                                    options={unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname })) || []}
                                    value={conv.unitid}
                                    onChange={handleChange}
                                    searchable
                                    addable onAddNew={() => navigate("/units")}
                                    error={errors?.productvariants?.[index]?.unitconversions?.[convIndex]?.unitid}
                                />
                                <FormField
                                    label="Factor"
                                    name={`productvariants.${index}.unitconversions.${convIndex}.factor`}
                                    type="number"
                                    value={conv.factor}
                                    onChange={handleChange}
                                    error={errors?.productvariants?.[index]?.unitconversions?.[convIndex]?.factor}
                                />
                                <button
                                    type="button"
                                    className="w-10 h-10 mt-6 right-2 text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                    onClick={() => removeUnitConversion(index, convIndex)}
                                >
                                    ❌
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => addUnitConversion(index)}
                        className="px-3 py-1 border rounded text-sm"
                    >
                        ➕ Add Unit Conversion
                    </button>
                </div>

                <div className="border-t pt-4 space-y-2 pb-4">
                    <h4 className="font-semibold">Unit Prices</h4>
                    <div className="space-y-2">
                        {(variant.unitprices || []).map((up, upIndex) => (
                            <div key={upIndex} className="grid grid-cols-1 md:grid-cols-8 gap-2 border rounded bg-gray-50 p-2 relative">
                                {["quantity", "unitid", "mrp", "salesrate", "discount", "discounttype", "offerprice"].map((f) => (
                                    <FormField
                                        key={f}
                                        label={LABELS[f.toLowerCase()] || f}
                                        name={`productvariants.${index}.unitprices.${upIndex}.${f}`}
                                        type={
                                            f === "unitid" ? "select" :
                                                f === "discounttype" ? "select" : "number"
                                        }
                                        options={
                                            f === "unitid"
                                                ? unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname }))
                                                : f === "discounttype"
                                                    ? [
                                                        { value: "fixed", label: "Fixed" },
                                                        { value: "percentage", label: "Percentage" },
                                                    ]
                                                    : undefined
                                        }
                                        value={up[f]}
                                        onChange={handleChange}
                                        disabled={f === "offerprice"}
                                        searchable={f === "unitid" || f === "discounttype"}
                                        addable onAddNew={() => navigate("/units")}
                                        error={errors?.productvariants?.[index]?.unitprices?.[upIndex]?.[f]}
                                    />
                                ))}
                                {isEdit && up.productbarcode && (
                                    <div className="flex flex-col items-start justify-center mt-1">
                                        <span className="text-[10px] text-gray-500 mb-1 font-medium">Barcode</span>
                                        <BarcodeImage value={up.productbarcode} align="start" />
                                    </div>
                                )}
                                {variant.unitprices.length > 1 && (
                                    <button
                                        type="button"
                                        className="w-10 h-10 mt-6 right-2 text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                                        onClick={() => removeUnitPrice(index, upIndex)}
                                    >
                                        ❌
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => addUnitPrice(index)}
                        className="px-3 py-1 border rounded text-sm"
                    >
                        ➕ Add Unit Price
                    </button>
                </div>

                {/* Serials */}
                {isserialised && (
                    <div className="border-t pt-4 space-y-2">
                        {(variant.serials || []).map((serial, serialIndex) => (
                            <div
                                key={serialIndex}
                                className="grid grid-cols-1 md:grid-cols-5 gap-2 p-2 pt-8 border rounded relative bg-gray-50"
                            >
                                <button
                                    type="button"
                                    className="absolute top-2 right-2 text-red-600 border border-red-600 rounded px-2 py-1 hover:bg-red-50 bg-white"
                                    onClick={() => removeSerial(index, serialIndex)}
                                >
                                    Remove Serial
                                </button>
                                {["imei", "serialnumber", "lotnumber", "status", "remarks"].map((f) => (
                                    <FormField
                                        key={f}
                                        label={f.charAt(0).toUpperCase() + f.slice(1)}
                                        name={`productvariants.${index}.serials.${serialIndex}.${f}`}
                                        type={f === "status" ? "select" : "text"}
                                        options={f === "status" ? ["available", "sold", "returned"].map(v => ({ value: v, label: v })) : undefined}
                                        value={serial[f]}
                                        onChange={handleChange}
                                    />
                                ))}
                            </div>
                        ))}
                        <button type="button" onClick={() => addSerial(index)} className="px-3 py-1 border rounded text-sm">➕ Add Serial</button>
                    </div>
                )}
            </fieldset>
        ))}

        <button type="button" onClick={addProductVariant} className="px-4 py-2 border rounded text-sm">➕ Add Product Variant</button>
    </>
);
