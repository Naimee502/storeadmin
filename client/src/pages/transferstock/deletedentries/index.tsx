import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useTransferStockMutations,
  useDeletedTransferStocksQuery,
} from "../../../graphql/hooks/transferstock";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useProductServicesQuery } from "../../../graphql/hooks/products";

const DeletedTransferStocks = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);
  const frombranchid = branchId ? branchId : undefined;
  const { data, refetch } = useDeletedTransferStocksQuery();
  const { resetTransferStockMutation } = useTransferStockMutations();
  const transferStockList = data?.getDeletedTransferStocks || [];
  const { data: branchesData } = useBranchesQuery();
  const { data: productData, refetch: productRefetch } = useProductServicesQuery();
   const transferProductData = productData?.getProductServices ?? [];
  const branches = branchesData?.getBranches || [];
  const products = transferProductData || [];

  console.log("Deleted Transfer Stocks Data:", JSON.stringify(products));

  useEffect(() => {
    if (!data || !data.getDeletedTransferStocks || data.getDeletedTransferStocks.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "From Branch", key: "frombranchid" },
    { label: "To Branch", key: "tobranchname" },
    { label: "Product", key: "productname" },
    { label: "Qty", key: "transferqty" },
    { label: "Unit", key: "transferunitname" },
    { label: "Purchase Rate", key: "purchaserate" },
    { label: "Date", key: "transferdate" },
    {
      label: "Status",
      key: "status",
      render: (value: boolean) => (value ? "Active" : "Inactive"),
    },
  ];

  const tableData = transferStockList.map((stock, index) => {
    const fromBranch = branches.find((b) => b.id === stock.frombranchid);
    const toBranch = branches.find((b) => b.id === stock.tobranchid);
    const product = products.find((p) => p.id === stock.productid);

    // find variant
    const variant = product?.productvariants?.find(v => v.id === stock.variantid);

    // find unit name from variant.unitconversions OR baseunit
    let unitName = "";
    if (variant) {
      const uc = variant.unitconversions?.find(u => {
        const unitId = typeof u.unitid === "object" ? u.unitid.id : u.unitid;
        return unitId === stock.transferunitid;
      });

      if (uc) {
        unitName = typeof uc.unitid === "object" ? uc.unitid.unitname : "Unit";
      } else if (variant.baseunitid) {
        unitName = typeof variant.baseunitid === "object"
          ? variant.baseunitid.unitname
          : "Base Unit";
      }
    }

    return {
      ...stock,
      seqNo: index + 1,
      frombranchid: fromBranch?.branchname || stock.frombranchid,
      tobranchname: toBranch?.branchname || stock.tobranchid,
      productname: product?.name || stock.productid,
      purchaserate: product?.productvariants[0]?.purchaserate,
      transferunitname: unitName,   // ⇦ NEW FIELD
      status: stock.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Transfer Stocks"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          showReset={true}
          onReset={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to reset deleted transfer stock "${row.productname}"?`
              )
            ) {
              try {
                await resetTransferStockMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Transfer stock reset successfully.",
                    type: "success",
                  })
                );
                navigate("/transferstock");
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset transfer stock.",
                    type: "error",
                  })
                );
              }
            }
          }}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedTransferStocks;
