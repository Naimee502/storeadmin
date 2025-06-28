import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addProducts } from "../../redux/slices/products";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useProductsQuery, useProductMutations } from "../../graphql/hooks/products";
import { hideLoading, showLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useUnitsQuery } from "../../graphql/hooks/units";
import BarcodeModal from "../../components/barcodemodal";
import PrintableBarcode from "../../components/printbarcode";
import { useReactToPrint } from "react-to-print";

const Products = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useProductsQuery();
  const { deleteProductMutation } = useProductMutations();
  const productList = data?.getProducts || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);
  const { data: unitData, refetch: refetchUnits } = useUnitsQuery();
  const unitList = unitData?.getUnits || [];

  
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);
  const [barcodeQty, setBarcodeQty] = useState<number>(0);
  const barcodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.products) {
          dispatch(addProducts(data.products));
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
  }, [dispatch, refetch]);


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
    { label: "Product Code", key: "productcode" },
    { label: "Name", key: "name" },
    { label: "Product Qty", key: "currentstock" },
    { label: "Sales Rate", key: "salesrate" },
    { label: "Sales Unit", key: "salesunit" },
    { label: "Status", key: "status" },
  ];

  const tableData = productList.map((product: any, index: number) => {
  const matchedUnit = unitList.find((unit) => unit.id === product.salesunitid);

  return {
    ...product,
    seqNo: index + 1,
    name: product.name,
    salesunit: matchedUnit?.unitname || "-", // 👈 Show unit name here
    status: product.status ? "Active" : "Inactive",
  };
});

  const handleExport = () => {
    const exportData = productList.map((product: any, index: number) => ({
      ID: index + 1,
      ProductCode: product.productcode || "-",
      ProductName: product.name || "-",
      CurrentStock: product.currentstock || "-",
      SalesRate: product.salesrate || "-",
      SalesUnit: product.salesunit || "-",
      Status: product.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "products.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const importedProducts = jsonData.map((row: any) => ({
        productcode: row.ProductCode || "",
        productname: row.ProductName || "",
        currentstock: row.CurrentStock || "",
        salesrate: row.SalesRate || "",
        salesunit: row.SalesUnit || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // Handle importedProducts here (e.g., dispatch to Redux, or call import mutation)
    };

    reader.readAsArrayBuffer(file);
    e.target.value = ""; // reset input
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
          title="Manage Products"
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
          onView={() => console.log("View clicked")}
          onEdit={(row) => 
            navigate(`/products/addedit/${row.id}`, {
              state: {
                barcode: row.barcode,
                productcode: row.productcode,
                productname: row.name,
              }
            })
          }
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete product "${row.name}"?`)) {
              try {
                await deleteProductMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Product deleted successfully.", type: "success" }));
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(showMessage({ message: "Failed to delete product.", type: "error" }));
              }
            }
          }}
          onShowDeleted={() =>navigate("/products/deletedentries")}
          onImport={handleImportClick}
          onExport={handleExport}
          onBarcode={(row) => {
            console.log("Barcode", JSON.stringify(row));
            setBarcodeProduct(row);
            setBarcodeModalOpen(true);
          }}
          onAdd={() => navigate("/products/addedit")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />

        <BarcodeModal
          isOpen={barcodeModalOpen}
          onClose={() => setBarcodeModalOpen(false)}
          onPrint={(qty) => {
            setBarcodeQty(qty);
            setTimeout(() => handleBarcodePrint?.(), 500); // give React time to render
          }}
        />

        {barcodeProduct && barcodeQty > 0 && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <PrintableBarcode ref={barcodeRef} product={barcodeProduct} quantity={barcodeQty} />
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default Products;
