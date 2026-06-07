import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";
import {
  useDeletedSalesOrdersQuery,
  useSalesOrderMutations,
} from "../../../graphql/hooks/salesorder";

const DeletedSalesOrders = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector(state => selectModuleActions(state, "salesorder"));
  
  const { data, refetch } = useDeletedSalesOrdersQuery();
  const { resetSalesOrderMutation } = useSalesOrderMutations();
  const orderList = data?.getDeletedSalesOrders || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  useEffect(() => {
    const fetchOrders = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching deleted orders:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchOrders();
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Payment Type", key: "paymenttype" },
    { label: "Party A/c", key: "partyacc" },
    { label: "Total Items", key: "totalitem" },
    { label: "Total Qty", key: "totalqty" },
    { label: "Order Date", key: "billdate" },
    { label: "Order No", key: "billtype_billnumber" },
    { label: "Total Amount", key: "totalamount" },
    { label: "Created By", key: "createdby_name" },
    { label: "Status", key: "orderStatus" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const tableData = orderList.map((order: any, index: number) => {
    const totalqty = order.productservice.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...order,
      seqNo: index + 1,
      partyacc: `${order.partyacc?.accountname ?? "N/A"} - ${order.partyacc?.mobile ?? "N/A"}`,
      totalitem: order.productservice.length,
      totalqty,
      billtype_billnumber: `SO-${order.billnumber}`,
      paymenttype: capitalizeFirst(order.paymenttype),
      createdby_name: order.createdby_type
        ? `${order.createdby_name || "N/A"} (${capitalizeFirst(order.createdby_type)})`
        : (order.createdby_name || "N/A"),
      orderStatus: "Deleted",
    };
  });


  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Sales Orders"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showReset={actions.canReset}
          showImport={false}
          showExport={false}
          showAdd={false}
          showDeleted={false}
          onReset={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to restore order "${row.billtype_billnumber}"?`
              )
            ) {
              try {
                await resetSalesOrderMutation({
                  variables: { id: row.id },
                });
                dispatch(
                  showMessage({
                    message: "Order restored successfully.",
                    type: "success",
                  })
                );
                navigate("/salesorder");
              } catch (error) {
                console.error("Restore error:", error);
                dispatch(
                  showMessage({
                    message: "Failed to restore order.",
                    type: "error",
                  })
                );
              }
            }
          }}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

// Simple Button component if not imported
const Button = ({ children, variant, onClick }: any) => (
    <button 
        onClick={onClick}
        className={`px-4 py-2 rounded ${variant === 'outline' ? 'border border-gray-300' : 'bg-blue-500 text-white'}`}
    >
        {children}
    </button>
);

export default DeletedSalesOrders;
