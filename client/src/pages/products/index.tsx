import React, { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import BarcodeModal from "../../components/barcodemodal";
import PrintableBarcode from "../../components/printbarcode";
import { useReactToPrint } from "react-to-print";
import {
  useProductServiceMutations,
  useProductServicesQuery,
} from "../../graphql/hooks/products";
import { selectModuleActions } from "../../redux/slices/permissions";

const ProductServices = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "products"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch, loading } = useProductServicesQuery();

  // ?filter=lowstock (from the dashboard "Low Stock Alert" card) —
  // show only products having a variant below its minimum stock
  const location = useLocation();
  const isLowStockFilter =
    new URLSearchParams(location.search).get("filter") === "lowstock";

  const allProducts = data?.getProductServices ?? [];
  const productServiceList = isLowStockFilter
    ? allProducts.filter(
        (p: any) =>
          !p.isservice &&
          (p.productvariants ?? []).some(
            (v: any) => (v.currentstock ?? 0) < (v.minimumstock ?? 0)
          )
      )
    : allProducts;
  console.log("ProductServiceList:", JSON.stringify(productServiceList));
  const { deleteProductServiceMutation } = useProductServiceMutations();

  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);
  const [barcodeOptions, setBarcodeOptions] = useState<{ label: string, barcode: string }[]>([]);
  const [barcodeQty, setBarcodeQty] = useState<number>(0);
  const barcodeRef = useRef<HTMLDivElement>(null);

  const handleBarcodePrint = useReactToPrint({
    contentRef: barcodeRef,
    documentTitle: "Barcodes",
    onAfterPrint: () => {
      setBarcodeProduct(null);
      setBarcodeQty(0);
    },
  });

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Code", key: "code" },
    { label: "Name", key: "name" },
    { label: "Current Stock / Location Type", key: "currentstock" },
    { label: "Pricing (Rate & Unit) / Service (Rate & UOM)", key: "pricinginfo" },
    { label: "Status", key: "status" },
  ];

  const capitalize = (str: string | undefined) => 
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "-";

  const tableData = [...productServiceList].reverse().map((item: any, index: number) => {
    const variants = item.isservice ? item.servicevariants : item.productvariants;

    return {
      ...item,
      seqNo: index + 1,
      code: item.isservice
        ? variants?.[0]?.servicecode || "-"
        : variants?.[0]?.productcode || "-",
      name: item.name,

      // ✅ Show stock vertically
      currentstock: (
        <div className="flex flex-col gap-0 text-xs">
          {variants?.map((variant: any, i: number) => (
            <div key={i} className="py-0.5 border-b border-gray-50 last:border-0 border-dashed">
              {item.isservice ? capitalize(variant?.locationType) || "-" : variant?.currentstock ?? 0}
            </div>
          ))}
        </div>
      ),

      pricinginfo: (
        <div className="flex flex-col gap-0.5 min-w-[320px]">
          {variants?.map((variant: any, i: number) => (
            <div key={i} className="bg-white py-0.5 px-1 rounded-sm border border-gray-100">
              {item.isservice ? (
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="bg-blue-600 text-white px-1 py-0.5 rounded-[2px] font-bold text-[8px]">SVC</span>
                  <span className="text-[13px] font-bold text-gray-900">₹{variant?.servicerate || 0}</span>
                  <span className="text-gray-400 text-xs">/</span>
                  <span className="text-[11px] text-gray-500 font-medium uppercase tracking-tight">{variant?.uom || "Unit"}</span>
                </div>
              ) : (
                  <div className="flex flex-wrap items-center gap-1.5 px-0.5 py-0.5">
                    {variant.unitprices?.map((up: any, j: number) => (
                      <div key={j} className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-sm border border-slate-100">
                        <span className="font-bold text-[13px] text-gray-900 leading-none whitespace-nowrap tracking-tight">₹{up.salesrate}</span>
                        <span className="text-slate-500 font-medium whitespace-nowrap text-[10px]">({up.quantity} {up.unitid?.unitname || "Unit"})</span>
                        {up.discount > 0 && <span className="text-orange-600 font-bold text-[10px]">-{up.discount}{up.discounttype === 'percentage' ? '%' : ''}</span>}
                      </div>
                    ))}
                  </div>
              )}
            </div>
          ))}
        </div>
      ),

      status: item.status ? "Active" : "Inactive",
    };
  });

  const handleExport = () => {
    const exportData = tableData.map((item: any) => {
      const variants = item.isservice ? item.servicevariants : item.productvariants;
      const pricingStr = variants?.flatMap((v: any) => 
        item.isservice 
          ? [`${v.servicerate || 0} / ${v.uom || 'Unit'}`]
          : v.unitprices?.map((up: any) => 
                `₹${up.salesrate} / ${up.quantity} ${up.unitid?.unitname || 'Unit'}`
              )
      ).filter(Boolean).join(" | ") || "-";

      return {
        ID: item.seqNo,
        Code: item.code,
        Name: item.name,
        Pricing: pricingStr,
        Status: item.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ProductServices");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "product_services.xlsx");
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

      const imported = jsonData.map((row: any) => ({
        productcode: row.ProductCode || "",
        name: row.Name || "",
        currentstock: row.CurrentStock || "",
        salesrate: row.SalesRate || "",
        salesunit: row.SalesUnit || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // TODO: Use a mutation to bulk insert this `imported` array
      console.log("Imported products:", imported);
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

        {/* Low-stock filter chip (from dashboard card) */}
        {isLowStockFilter && (
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
              ⚠ Showing Low Stock Products Only ({productServiceList.length})
            </span>
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
            >
              Show All Products
            </button>
          </div>
        )}

        <DataTable
          title={isLowStockFilter ? "Low Stock Products" : "Manage Product Services"}
          columns={columns}
          data={tableData}
          {...actions}
          showView={false}
          showPrint={false}
          showBarcode={true}
          requireBranchForAdd={true}
          onEdit={(row) =>
            navigate(`/products/addedit/${row.id}`, {
              state: {
                barcode: row.barcode,
                productcode: row.productcode,
                productname: row.name,
              },
            })
          }
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete "${row.name}"?`)) {
              try {
                await deleteProductServiceMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({ message: "Deleted successfully.", type: "success" })
                );
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(
                  showMessage({ message: "Failed to delete.", type: "error" })
                );
              }
            }
          }}
          onShowDeleted={() => navigate("/products/deletedentries")}
          onImport={handleImportClick}
          onExport={handleExport}
          onBarcode={(row) => {
            let barcodeValue = "";
            let itemName = row.name;
            let options: { label: string, barcode: string }[] = [];

            if (row.isservice) {
              const serviceVariant = row.servicevariants?.[0];
              if (!serviceVariant) return; 
              barcodeValue = serviceVariant.servicebarcode || "";
              itemName = serviceVariant.name || row.name;
            } else {
              const productVariant = row.productvariants?.[0];
              if (!productVariant) return;
              
              productVariant.unitprices?.forEach((up: any) => {
                if (up.productbarcode) {
                  const unitName = up.unitid?.unitname || "Unit";
                  options.push({
                    label: `${up.quantity} ${unitName} (₹${up.salesrate})`,
                    barcode: up.productbarcode
                  });
                }
              });
              
              barcodeValue = options.length > 0 ? options[0].barcode : "";
            }

            setBarcodeOptions(options);

            setBarcodeProduct({
              name: itemName,
              barcode: barcodeValue,
            });

            setBarcodeModalOpen(true);
          }}
          onAdd={() => navigate("/products/addedit")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={loading}
        />

        <BarcodeModal
          isOpen={barcodeModalOpen}
          onClose={() => setBarcodeModalOpen(false)}
          barcodeOptions={barcodeOptions}
          onPrint={(qty, selectedBarcode) => {
            setBarcodeQty(qty);
            if (selectedBarcode) {
              setBarcodeProduct((prev: any) => ({ ...prev, barcode: selectedBarcode }));
            }
            setTimeout(() => handleBarcodePrint?.(), 500);
          }}
        />

        {barcodeProduct && barcodeQty > 0 && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <PrintableBarcode
              ref={barcodeRef}
              product={barcodeProduct}
              quantity={barcodeQty}
            />
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default ProductServices;
