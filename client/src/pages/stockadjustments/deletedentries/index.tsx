import { useEffect } from "react";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";
import {
  useDeletedStockAdjustments,
  useResetStockAdjustment,
} from "../../../graphql/hooks/stockadjustments";

const DeletedStockAdjustments: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { admin, branch, type } = useAppSelector((state: any) => state.auth);
  const selectedBranchId = useAppSelector(
    (state: any) => state.selectedBranch.branchId
  );
  const adminId = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchId = selectedBranchId || branch?.id;

  const { data, loading, refetch } = useDeletedStockAdjustments({
    adminid: adminId,
    branchid: branchId,
  });

  const { resetStockAdjustment } = useResetStockAdjustment();

  useEffect(() => {
    const fetchData = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching deleted stock adjustments:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchData();
  }, [dispatch, refetch]);

  const adjustmentList = data?.getStockAdjustments || [];

  const columns = [
    { label: "Seq No.", key: "seqNo" },
    { label: "Date", key: "adjustmentdate" },
    { label: "Voucher No.", key: "vouchernumber" },
    { label: "Type", key: "type" },
    { label: "Reason", key: "reason" },
    { label: "Total Amount", key: "totalamount" },
    { label: "Status", key: "status" },
  ];

  const tableData = adjustmentList.map((item: any, index: number) => ({
    ...item,
    seqNo: index + 1,
    adjustmentdate: item.adjustmentdate
      ? format(new Date(item.adjustmentdate), "dd MMM yyyy")
      : "-",
    totalamount: `₹${(item.totalamount ?? 0).toFixed(2)}`,
    status: item.status ? "Active" : "Deleted",
  }));

  const handleReset = async (row: any) => {
    if (
      !window.confirm(
        `Are you sure you want to restore adjustment "${row.vouchernumber}"? This will re-apply the stock impact.`
      )
    )
      return;
    dispatch(showLoading());
    try {
      await resetStockAdjustment({ variables: { id: row.id } });
      await refetch();
      dispatch(
        showMessage({
          message: "Stock adjustment restored successfully.",
          type: "success",
        })
      );
      navigate(-1);
    } catch (error: any) {
      dispatch(
        showMessage({
          message: error.message || "Failed to restore adjustment.",
          type: "error",
        })
      );
    } finally {
      dispatch(hideLoading());
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Stock Adjustments"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showReset={true}
          showImport={false}
          showExport={false}
          showAdd={false}
          showDeleted={false}
          onReset={(row) => handleReset(row)}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedStockAdjustments;
