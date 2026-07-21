import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useTransferStockMutations,
  useDeletedTransferStocksQuery,
} from "../../../graphql/hooks/transferstock";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { showMessage } from "../../../redux/slices/message";
import { formatDateDMY } from "../../../utils/helper";

const DeletedTransferStocks = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((state) => selectModuleActions(state, "transferstock"));

  const { data, refetch } = useDeletedTransferStocksQuery();
  const { resetTransferStockMutation } = useTransferStockMutations();
  const { data: branchesData } = useBranchesQuery();
  const { data: productData } = useProductServicesQuery(true, 500, 0);

  const branches = branchesData?.getBranches || [];
  const allProducts = productData?.getProductServices || [];
  const transferStockList = data?.getDeletedTransferStocks || [];

  // Same resolution as the active Transfer Stock list — transferunitid points
  // at one of the product variant's unit conversions (or its base unit),
  // neither of which the transfer query itself populates.
  const productNameOf = (item: any) => {
    const product = allProducts.find((p: any) => p.id === item.productid);
    if (!product) return "-";
    const variant = (product.productvariants || []).find((v: any) => v.id === item.variantid);
    return variant?.name ? `${product.name} - ${variant.name}` : product.name;
  };

  const unitNameOf = (item: any) => {
    const product = allProducts.find((p: any) => p.id === item.productid);
    const variant = (product?.productvariants || []).find((v: any) => v.id === item.variantid);
    if (!variant) return "";
    const uc = (variant.unitconversions || []).find(
      (u: any) => (typeof u.unitid === "object" ? u.unitid?.id : u.unitid) === item.transferunitid
    );
    if (uc) return typeof uc.unitid === "object" ? uc.unitid?.unitname || "" : "";
    if (variant.baseunitid) {
      const baseId = typeof variant.baseunitid === "object" ? variant.baseunitid.id : variant.baseunitid;
      if (baseId === item.transferunitid) {
        return typeof variant.baseunitid === "object" ? variant.baseunitid.unitname || "" : "";
      }
    }
    return "";
  };

  const stackedCell = (items: any[], render: (item: any) => any) => (
    <div className="flex flex-col gap-0">
      {(items || []).map((it, i) => (
        <div key={i} className="py-0.5 border-b border-gray-50 last:border-0 border-dashed">
          {render(it)}
        </div>
      ))}
    </div>
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  const columns = [
    { label: "Voucher #",     key: "vouchernumber" },
    { label: "From Branch",   key: "fromBranchName" },
    { label: "To Branch",     key: "toBranchName" },
    { label: "Product",       key: "productCell" },
    { label: "Qty",           key: "qtyCell" },
    { label: "Purchase Rate", key: "rateCell" },
    { label: "Total Value",   key: "totalamountDisplay" },
    { label: "Date",          key: "transferdate" },
    { label: "Created By",    key: "createdByDisplay" },
    { label: "Status",        key: "status" },
  ];

  const tableData = transferStockList.map((ts: any) => {
    const fromBranch = branches.find((b: any) => b.id === ts.frombranchid);
    const toBranch   = branches.find((b: any) => b.id === ts.tobranchid);
    const items = ts.items || [];

    return {
      ...ts,
      transferdate:       formatDateDMY(ts.transferdate),
      fromBranchName:     fromBranch?.branchname || ts.frombranchid,
      toBranchName:       toBranch?.branchname   || ts.tobranchid,
      productCell:        stackedCell(items, (it) => productNameOf(it)),
      qtyCell:            stackedCell(items, (it) => `${it.transferqty} ${unitNameOf(it)}`.trim()),
      rateCell:           stackedCell(items, (it) => `₹${Number(it.rate || 0).toFixed(2)}`),
      totalamountDisplay: `₹${(ts.totalamount || 0).toFixed(2)}`,
      createdByDisplay:   ts.createdby_name || "N/A",
      status:             ts.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
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
          showReset={actions.canReset}
          onReset={async (row: any) => {
            if (
              window.confirm(
                `Reset deleted transfer voucher ${row.vouchernumber || ""}? This will re-apply the stock movement.`
              )
            ) {
              try {
                await resetTransferStockMutation({ variables: { id: row.id } });
                dispatch(showMessage({ message: "Transfer stock reset successfully.", type: "success" }));
                await refetch();
                navigate("/transferstock");
              } catch (error) {
                dispatch(showMessage({ message: "Failed to reset transfer stock.", type: "error" }));
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
