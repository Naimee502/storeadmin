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
import { useProductsQuery } from "../../../graphql/hooks/products";

const DeletedTransferStocks = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);
  const frombranchid = branchId ? branchId : undefined;
  const { data, refetch } = useDeletedTransferStocksQuery(frombranchid);
  const { resetTransferStockMutation } = useTransferStockMutations();
  const transferStockList = data?.getDeletedTransferStocks || [];
  const { data: branchesData } = useBranchesQuery();
  const { data: productsData } = useProductsQuery();
  const branches = branchesData?.getBranches || [];
  const products = productsData?.getProducts || [];

  useEffect(() => {
    if (!data || !data.getDeletedTransferStocks || data.getDeletedTransferStocks.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "From Branch ID", key: "frombranchid" },
    { label: "To Branch ID", key: "tobranchid" },
    { label: "Product ID", key: "productid" },
    { label: "Transfer Qty", key: "transferqty" },
    { label: "Purchase Rate", key: "purchaserate" },
    { label: "Transfer Date", key: "transferdate" },
    { label: "Status", key: "status" },
  ];

  const tableData = transferStockList.map((stock, index) => {
    const fromBranch = branches.find((b) => b.id === stock.frombranchid); 
    const toBranch = branches.find((b) => b.id === stock.tobranchid);
    const product = products.find((p) => p.id === stock.productid);

    return {
      ...stock,
      seqNo: index + 1,
      frombranchid: fromBranch?.branchname || stock.frombranchid, 
      tobranchname: toBranch?.branchname || stock.tobranchid,
      productname: product?.name || stock.productid,
      purchaserate: product?.purchaserate,
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
