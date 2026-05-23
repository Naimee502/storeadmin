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
import { showMessage } from "../../../redux/slices/message";

const DeletedTransferStocks = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((state) => selectModuleActions(state, "transferstock"));

  const { data, refetch } = useDeletedTransferStocksQuery();
  const { resetTransferStockMutation } = useTransferStockMutations();
  const { data: branchesData } = useBranchesQuery();

  const branches = branchesData?.getBranches || [];
  const transferStockList = data?.getDeletedTransferStocks || [];

  useEffect(() => {
    refetch();
  }, [refetch]);

  const columns = [
    { label: "Voucher #",   key: "vouchernumber" },
    { label: "From Branch", key: "fromBranchName" },
    { label: "To Branch",   key: "toBranchName" },
    { label: "Date",        key: "transferdate" },
    { label: "Items",       key: "itemCount" },
    { label: "Total Value", key: "totalamountDisplay" },
    { label: "Created By",  key: "createdByDisplay" },
    { label: "Status",      key: "status" },
  ];

  const tableData = transferStockList.map((ts: any) => {
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
