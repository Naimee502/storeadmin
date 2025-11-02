import React, { useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch } from "../../redux/hooks";
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

const ProductServices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch, loading } = useProductServicesQuery();
  const productServiceList = data?.getProductServices ?? [];
  console.log("ProductServiceList:", JSON.stringify(productServiceList));
  const { deleteProductServiceMutation } = useProductServiceMutations();

  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);
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
    { label: "Sales Rate / Service Rate", key: "salesrate" },
    { label: "Sales Unit / UOM", key: "salesunit" },
    { label: "Status", key: "status" },
  ];

  const capitalize = (str: string | undefined) => 
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "-";

  const tableData = productServiceList?.map((item: any, index: number) => {
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
        <div>
          {variants?.map((variant: any, i: number) => (
            <div key={i}>
              {item.isservice ? capitalize(variant?.locationType) || "-" : variant?.currentstock ?? 0}
            </div>
          ))}
        </div>
      ),

      salesrate: (
      <div>
        {variants?.map((variant: any, i: number) => (
          <div key={i} className="border-b border-gray-200 pb-1 mb-1">
            {item.isservice
              ? `${variant?.servicerate || 0}` // service rate
              : variant?.pricing?.[0]?.unitprices?.map((up: any, j: number) => (
                  <div key={j}>
                    {up.salesrate} 
                  </div>
                )) || "-"}
          </div>
        ))}
      </div>
    ),

    // Sales Unit / UOM
    salesunit: (
      <div>
        {variants?.map((variant: any, i: number) => (
          <div key={i} className="border-b border-gray-200 pb-1 mb-1">
            {item.isservice
              ? capitalize(variant?.uom) || "-" // service unit
              : variant?.pricing?.[0]?.unitprices?.map((up: any, j: number) => (
                  <div key={j}>
                    {up.quantity} {up.unitid?.unitname || "-"}
                  </div>
                )) || "-"}
          </div>
        ))}
      </div>
    ),

      status: item.status ? "Active" : "Inactive",
    };
  });

  const handleExport = () => {
    const exportData = tableData.map((item: any) => ({
      ID: item.seqNo,
      Code: item.code,
      Name: item.name,
      CurrentStock: item.currentstock,
      SalesRate: item.salesrate,
      SalesUnit: item.salesunit,
      Status: item.status,
    }));

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

        <DataTable
          title="Manage Product Services"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showPrint={false}
          showAdd={true}
          showBarcode={true}
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

            if (row.isservice) {
              const serviceVariant = row.servicevariants?.[0];
              if (!serviceVariant) return; 
              barcodeValue = serviceVariant.servicebarcode || "";
              itemName = serviceVariant.name || row.name;
            } else {
              const productVariant = row.productvariants?.[0];
              if (!productVariant) return;
              barcodeValue = productVariant.productbarcode || "";
            }

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
          onPrint={(qty) => {
            setBarcodeQty(qty);
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
