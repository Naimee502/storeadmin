import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useActiveStockAdjustments,
  useDeleteStockAdjustment,
} from "../../graphql/hooks/stockadjustments";
import { formatDateDMY } from "../../utils/helper";

const StockAdjustmentsList: React.FC = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "stockadjustments"));
  const dispatch = useAppDispatch();

  const { admin, branch, staff, type } = useAppSelector((state: any) => state.auth);
  const selectedBranchId = useAppSelector(
    (state: any) => state.selectedBranch.branchId
  );
  const storedAdminId = localStorage.getItem("adminid") || "";
  const storedBranchId = localStorage.getItem("branchid") || "";

  const adminId = type === "admin" ? admin?.id
    : type === "branch" ? (branch?.admin?.id || admin?.id || storedAdminId)
    : type === "staff" ? (staff?.admin?.id || admin?.id || storedAdminId)
    : (admin?.id || storedAdminId);
  const branchId = type === "admin" ? selectedBranchId
    : type === "branch" ? (branch?.id || selectedBranchId || storedBranchId)
    : type === "staff" ? (staff?.branchid?.id || selectedBranchId || storedBranchId)
    : (selectedBranchId || storedBranchId);

  const isLoading = useAppSelector((state: any) => state.loader.isLoading);

  const { data, loading, refetch } = useActiveStockAdjustments({
    adminid: adminId,
    branchid: branchId,
  });

  const { deleteStockAdjustment } = useDeleteStockAdjustment();

  useEffect(() => {
    const fetchData = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching stock adjustments:", error);
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
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "status" },
  ];

  const tableData = adjustmentList.map((item: any, index: number) => ({
    ...item,
    seqNo: index + 1,
    adjustmentdate: item.adjustmentdate
      ? formatDateDMY(item.adjustmentdate)
      : "-",
    totalamount: `₹${(item.totalamount ?? 0).toFixed(2)}`,
    createdByDisplay: item.createdby_name || "N/A",
    status: item.status ? "Active" : "Cancelled",
  }));

  const handleDelete = async (row: any) => {
    if (
      !window.confirm(
        `Are you sure you want to delete adjustment "${row.vouchernumber}"? This will move it to deleted entries.`
      )
    )
      return;
    dispatch(showLoading());
    try {
      await deleteStockAdjustment({ variables: { id: row.id } });
      await refetch();
      dispatch(
        showMessage({
          message: "Stock adjustment deleted successfully.",
          type: "success",
        })
      );
    } catch (error: any) {
      dispatch(
        showMessage({
          message: error.message || "Failed to delete adjustment.",
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
        <DataTable requireBranchForAdd={true}
          {...actions}
          title="Stock Adjustments"
          columns={columns}
          data={tableData}
          
          
          
          showReset={false}
          
          
          
          showDeleted={actions.showDeleted}
          onEdit={(row) => navigate(`/stockadjustments/addedit/${row.id}`)}
          onDelete={(row) => handleDelete(row)}
          onAdd={() => navigate("/stockadjustments/add")}
          onShowDeleted={() => navigate("/stockadjustments/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading || loading}
        />
      </div>
    </HomeLayout>
  );
};

export default StockAdjustmentsList;
