import FormField from "../formfiled";
import { SpecValues, type CustomFieldValue, type SpecDef } from "../customfields";
import BarcodeImage from "../barcode";
import { useAppSelector } from "../../redux/hooks";

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
    onQuickAdd: (type: string, label: string, name: string) => void;
    errors: any;
    isAddVariantEnabled?: boolean;
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
    moq: "Minimum Order Qty",
    salemultiple: "Sell in Multiples Of",
    warrantymonths: "Warranty (Months)",
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

export const ProductVariants: React.FC<ProductVariantsProps & { specDefs?: SpecDef[]; setVariantSpecs?: (index: number, next: CustomFieldValue[]) => void; extrasOn?: boolean }> = ({
    formData,
    handleChange,
    specDefs,
    setVariantSpecs,
    extrasOn = false,
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
    onQuickAdd,
    errors,
}) => {
    const productFormPermissions = useAppSelector(state => state.permissions.permissions?.formPermissions?.products || {});
    const isFieldEnabled = (fieldId: string) => {
        return productFormPermissions[fieldId] !== false;
    };

    // A section shows only if at least one of its fields is allowed.
    const PRICE_FIELDS = ["quantity", "unitid", "mrp", "salesrate", "discount", "discounttype", "offerprice"];
    const priceFieldKey = (f: string) => (f === "unitid" ? "unitprices_unitid" : f);
    const showConvFields = isFieldEnabled("unitconversions_unitid") || isFieldEnabled("factor");
    const canEditConvRows = isFieldEnabled("add_unit_conversion");
    const showConv = showConvFields || canEditConvRows;
    const showPriceFields = PRICE_FIELDS.some((f) => isFieldEnabled(priceFieldKey(f)));
    const canEditPriceRows = isFieldEnabled("add_unit_price");
    const showPrices = showPriceFields || canEditPriceRows;
    const showUnitFields = ["baseunitid", "purchaseunitid", "purchaserate"].some(isFieldEnabled);

    return (
        <div className="space-y-3">
            {formData.productvariants.map((variant: any, index: number) => {
                const coreFields = [
                        "name", "sku", "batchnumber", "manufacturedate", "expirydate",
                        "gst", "hsncode", "openingstock", "currentstock",
                        "closingstock", "minimumstock", "reorderlevel", "racklocation",
                        ...(extrasOn ? ["moq", "salemultiple", "warrantymonths"] : []),
                        ...(isEdit ? ["productcode", "openingstockamount", "currentstockamount", "closingstockamount"] : []),
                    ].filter(field => isFieldEnabled(field === "name" ? "variant_name" : field));
                const showCore = coreFields.length > 0 || showUnitFields;
                // Nothing in this variant is allowed → don't render an empty card.
                if (!showCore && !showConv && !showPrices && !specDefs?.length) return null;
                return (
                <fieldset key={variant.tempid || index} className="border rounded-xl p-4 mb-4 relative">
                    <legend className="text-sm font-semibold px-2">Product Variant {index + 1}</legend>

                    {formData.productvariants.length > 1 && isFieldEnabled("add_product_variant") && (
                        <button
                            type="button"
                            className="absolute top-1.5 right-2 inline-flex h-7 items-center rounded-md border border-rose-200 bg-white px-2.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
                        onClick={() => removeProductVariant(index)}
                    >
                        Remove Product Variant
                    </button>
                )}

                {/* Core Fields */}
                {showCore && (
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 pt-1 pb-3 md:grid-cols-5">
                    {coreFields.map((field) => (
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
                                "moq", "salemultiple", "warrantymonths",
                            ].includes(field)
                                ? "number"
                                : ["manufacturedate", "expirydate"].includes(field)
                                    ? "date"        // calendar input
                                    : "text"}
                            value={variant[field]}
                            onChange={handleChange}
                            // Show validation errors (e.g. negative stock).
                            error={errors?.productvariants?.[index]?.[field]}
                            disabled={isEdit && [
                                "productcode",
                                "openingstockamount",
                                "currentstockamount",
                                "closingstockamount",
                            ].includes(field)}
                        />
                    ))}

                    {/* Units + Purchase Rate remain always visible unless disabled */}
                    {isFieldEnabled("baseunitid") && (
                        <FormField
                            label="Base Unit"
                            placeholder="Base Unit"
                            name={`productvariants.${index}.baseunitid`}
                            type="select"
                            options={unitData?.getUnits.map((u) => ({ value: u.id, label: u.unitname })) || []}
                            value={variant.baseunitid}
                            onChange={handleChange}
                            searchable
                            addable onAddNew={() => onQuickAdd("unit", "Unit", `productvariants.${index}.baseunitid`)}
                            error={errors?.productvariants?.[index]?.baseunitid}
                        />
                    )}

                    {isFieldEnabled("purchaseunitid") && (
                        <FormField
                            label="Purchase Unit"
                            placeholder="Purchase Unit"
                            name={`productvariants.${index}.purchaseunitid`}
                            type="select"
                            options={unitData?.getUnits.map((u) => ({ value: u.id, label: u.unitname })) || []}
                            value={variant.purchaseunitid}
                            onChange={handleChange}
                            searchable
                            addable onAddNew={() => onQuickAdd("unit", "Unit", `productvariants.${index}.purchaseunitid`)}
                            error={errors?.productvariants?.[index]?.purchaseunitid}
                        />
                    )}

                    {isFieldEnabled("purchaserate") && (
                        <FormField
                            label="Purchase Rate"
                            placeholder="Purchase Rate"
                            name={`productvariants.${index}.purchaserate`}
                            type="number"
                            value={variant.purchaserate}
                            onChange={handleChange}
                            error={errors?.productvariants?.[index]?.purchaserate}
                        />
                    )}
                </div>
                )}

                {/* Category spec fields; nothing shows when the category defines none. */}
                {!!specDefs?.length && setVariantSpecs && (
                <div className="border-t border-slate-200 pt-2 pb-3">
                    <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Specifications</h4>
                    <SpecValues defs={specDefs} values={variant.customfields || []} onChange={(next) => setVariantSpecs(index, next)} />
                </div>
                )}

                {/* Unit Conversions */}
                {showConv && (
                <div className="space-y-2 border-t border-slate-200 pt-3 pb-3 first:border-t-0 first:pt-0">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unit Conversions</h4>
                    <div className="space-y-2">
                        {showConvFields && (variant.unitconversions || []).map((conv, convIndex) => (
                            <div key={convIndex} className="grid grid-cols-1 items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:grid-cols-[1fr_1fr_auto]">
                                {isFieldEnabled("unitconversions_unitid") && (
                                    <FormField
                                        label="Unit"
                                        name={`productvariants.${index}.unitconversions.${convIndex}.unitid`}
                                        type="select"
                                        options={unitData?.getUnits.map(u => ({ value: u.id, label: u.unitname })) || []}
                                        value={conv.unitid}
                                        onChange={handleChange}
                                        searchable
                                        addable onAddNew={() => onQuickAdd("unit", "Unit", `productvariants.${index}.unitconversions.${convIndex}.unitid`)}
                                        error={errors?.productvariants?.[index]?.unitconversions?.[convIndex]?.unitid}
                                    />
                                )}
                                {isFieldEnabled("factor") && (
                                    <FormField
                                        label="Factor"
                                        name={`productvariants.${index}.unitconversions.${convIndex}.factor`}
                                        type="number"
                                        value={conv.factor}
                                        onChange={handleChange}
                                        error={errors?.productvariants?.[index]?.unitconversions?.[convIndex]?.factor}
                                    />
                                )}
                                {canEditConvRows && (
                                <button
                                    type="button"
                                    title="Remove" className="grid h-8 w-8 shrink-0 place-items-center self-end rounded-md border border-rose-200 bg-white text-xs text-rose-500 hover:bg-rose-50"
                                    onClick={() => removeUnitConversion(index, convIndex)}
                                >
                                    ✕
                                </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {isFieldEnabled("add_unit_conversion") && (
                        <button
                            type="button"
                            onClick={() => addUnitConversion(index)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50"
                        >
                            + Add Unit Conversion
                        </button>
                    )}
                </div>
                )}

                {showPrices && (
                <div className="space-y-2 border-t border-slate-200 pt-3 pb-3 first:border-t-0 first:pt-0">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unit Prices</h4>
                    <div className="space-y-2">
                        {showPriceFields && (variant.unitprices || []).map((up, upIndex) => (
                            <div key={upIndex} className="relative grid grid-cols-1 items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:grid-cols-8">
                                {PRICE_FIELDS.filter(f => isFieldEnabled(priceFieldKey(f))).map((f) => (
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
                                        addable={f === "unitid"} onAddNew={f === "unitid" ? () => onQuickAdd("unit", "Unit", `productvariants.${index}.unitprices.${upIndex}.${f}`) : undefined}
                                        error={errors?.productvariants?.[index]?.unitprices?.[upIndex]?.[f]}
                                    />
                                ))}
                                {isEdit && up.productbarcode && (
                                    <div className="flex flex-col items-start justify-center mt-1">
                                        <span className="text-[10px] text-gray-500 mb-1 font-medium">Barcode</span>
                                        <BarcodeImage value={up.productbarcode} align="start" />
                                    </div>
                                )}
                                {variant.unitprices.length > 1 && canEditPriceRows && (
                                    <button
                                        type="button"
                                        title="Remove" className="grid h-8 w-8 shrink-0 place-items-center self-end rounded-md border border-rose-200 bg-white text-xs text-rose-500 hover:bg-rose-50"
                                        onClick={() => removeUnitPrice(index, upIndex)}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {isFieldEnabled("add_unit_price") && (
                        <button
                            type="button"
                            onClick={() => addUnitPrice(index)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50"
                        >
                            + Add Unit Price
                        </button>
                    )}
                </div>
                )}

                {/* Serials */}
                {isserialised && showCore && (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                        {(variant.serials || []).map((serial, serialIndex) => (
                            <div
                                key={serialIndex}
                                className="relative grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 pt-9 md:grid-cols-5"
                            >
                                <button
                                    type="button"
                                    className="absolute top-1.5 right-2 inline-flex h-7 items-center rounded-md border border-rose-200 bg-white px-2.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
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
                        <button type="button" onClick={() => addSerial(index)} className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50">+ Add Serial</button>
                    </div>
                )}
            </fieldset>
                );
            })}

        {isFieldEnabled("add_product_variant") && (
            <button type="button" onClick={addProductVariant} className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50">+ Add Product Variant</button>
        )}
    </div>
  );
};
