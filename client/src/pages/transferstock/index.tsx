import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import { showMessage } from "../../redux/slices/message";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { useTransferStockMutations, useTransferStocksQuery } from "../../graphql/hooks/transferstock";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { formatDateDMY } from "../../utils/helper";

const TransferStock = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((state) => selectModuleActions(state, "transferstock"));

  const { data: transfersData, refetch } = useTransferStocksQuery();
  const { data: branchesData } = useBranchesQuery();
  const { data: productData } = useProductServicesQuery(true, 500, 0);
  const { deleteTransferStockMutation } = useTransferStockMutations();

  const branches = branchesData?.getBranches || [];
  const allProducts = productData?.getProductServices || [];
  const transferStocks = transfersData?.getTransferStocks || [];

  // Resolve a transfer line's product (+ variant) name and the unit label
  // picked for it (transferunitid points at one of that product variant's
  // unit conversions, or its base unit — neither is populated by the
  // transfer query itself).
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
    {
      label: "Status",
      key: "status",
      render: (value: any) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          value === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
        }`}>
          {value}
        </span>
      ),
    },
  ];

  // Stack one line per item so multi-product transfers still read cleanly
  // (most vouchers only have one line, but the model allows several).
  const stackedCell = (items: any[], render: (item: any) => React.ReactNode) => (
    <div className="flex flex-col gap-0">
      {(items || []).map((it, i) => (
        <div key={i} className="py-0.5 border-b border-gray-50 last:border-0 border-dashed">
          {render(it)}
        </div>
      ))}
    </div>
  );

  const tableData = transferStocks.map((ts: any) => {
    const fromBranch = branches.find((b: any) => b.id === ts.frombranchid);
    const toBranch   = branches.find((b: any) => b.id === ts.tobranchid);
    const items = ts.items || [];

    return {
      ...ts,
      transferdate:       formatDateDMY(ts.transferdate),
      fromBranchName:     fromBranch?.branchname || ts.frombranchid,
      toBranchName:       toBranch?.branchname   || ts.tobranchid,
      productCell:        stackedCell(items, (it) => productNameOf(it)),
      qtyCell:             stackedCell(items, (it) => `${it.transferqty} ${unitNameOf(it)}`.trim()),
      rateCell:            stackedCell(items, (it) => `₹${Number(it.rate || 0).toFixed(2)}`),
      totalamountDisplay: `₹${(ts.totalamount || 0).toFixed(2)}`,
      createdByDisplay:   ts.createdby_name || "N/A",
      status:             ts.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          {...actions}
          title="Manage Transfer Stocks"
          columns={columns}
          data={tableData}
          onAdd={() => navigate("/transferstock/add")}
          onEdit={(row: any) => navigate(`/transferstock/edit/${row.id}`)}
          onDelete={async (row: any) => {
            if (
              window.confirm(
                `Delete transfer voucher ${row.vouchernumber || ""}? This will reverse the stock movement.`
              )
            ) {
              try {
                await deleteTransferStockMutation({ variables: { id: row.id } });
                dispatch(showMessage({ message: "Transfer voucher deleted and stock reversed.", type: "success" }));
                await refetch();
              } catch (error) {
                dispatch(showMessage({ message: "Failed to delete transfer voucher.", type: "error" }));
              }
            }
          }}
          onShowDeleted={() => navigate("/transferstock/deletedentries")}
        />
      </div>
    </HomeLayout>
  );
};

export default TransferStock;
