import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import { showMessage } from "../../redux/slices/message";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { useTransferStockMutations, useTransferStocksQuery } from "../../graphql/hooks/transferstock";
import { useBranchesQuery } from "../../graphql/hooks/branches";

const TransferStock = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((state) => selectModuleActions(state, "transferstock"));

  const { data: transfersData, refetch } = useTransferStocksQuery();
  const { data: branchesData } = useBranchesQuery();
  const { deleteTransferStockMutation } = useTransferStockMutations();

  const branches = branchesData?.getBranches || [];
  const transferStocks = transfersData?.getTransferStocks || [];

  useEffect(() => {
    refetch();
  }, [refetch]);

  const columns = [
    { label: "Voucher #",    key: "vouchernumber" },
    { label: "From Branch",  key: "fromBranchName" },
    { label: "To Branch",    key: "toBranchName" },
    { label: "Date",         key: "transferdate" },
    { label: "Items",        key: "itemCount" },
    { label: "Total Value",  key: "totalamountDisplay" },
    { label: "Created By",   key: "createdByDisplay" },
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

  const tableData = transferStocks.map((ts: any) => {
    const fromBranch = branches.find((b: any) => b.id === ts.frombranchid);
    const toBranch   = branches.find((b: any) => b.id === ts.tobranchid);

    return {
      ...ts,
      fromBranchName:     fromBranch?.branchname || ts.frombranchid,
      toBranchName:       toBranch?.branchname   || ts.tobranchid,
      itemCount:          `${(ts.items || []).length} item(s)`,
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
