import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesOrdersQuery,
  useSalesOrderMutations,
} from "../../graphql/hooks/salesorder";

const SalesOrders = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "salesorder"));
  const dispatch = useAppDispatch();
  
  const { data, refetch } = useSalesOrdersQuery();
  const {
    deleteSalesOrderMutation,
    cancelSalesOrderMutation,
    confirmSalesOrderMutation,
    dispatchSalesOrderMutation,
    deliverSalesOrderMutation,
    reopenSalesOrderMutation,
  } = useSalesOrderMutations();

  // Drive the order through its lifecycle from the listing dropdown.
  const STATUS_OPTIONS = [
    { label: "Pending",    value: "pending" },
    { label: "Confirmed",  value: "confirmed" },
    { label: "Dispatched", value: "dispatched" },
    { label: "Delivered",  value: "delivered" },
    { label: "Cancelled",  value: "cancelled" },
  ];
  const handleStatusChange = async (row: any, status: string) => {
    try {
      if (status === "confirmed")       await confirmSalesOrderMutation({ variables: { id: row.id } });
      else if (status === "dispatched") await dispatchSalesOrderMutation({ variables: { id: row.id } });
      else if (status === "delivered")  await deliverSalesOrderMutation({ variables: { id: row.id, byType: "admin" } });
      else if (status === "cancelled") {
        const reason = window.prompt(`Cancel SO-${row.billnumber}? Reason:`);
        if (reason === null) return;
        await cancelSalesOrderMutation({ variables: { id: row.id, reason } });
      }
      else if (status === "pending")    await reopenSalesOrderMutation({ variables: { id: row.id } });
      await refetch();
      dispatch(showMessage({ message: "Order status updated.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Failed to update status.", type: "error" }));
    }
  };
  const orderList = data?.getSalesOrders || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  useEffect(() => {
    const fetchOrders = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching orders:", error);
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
    { label: "Ordered By", key: "orderedByDisplay" },
    { label: "Order Status", key: "orderStatusCell" },
    { label: "Status", key: "activeStatus" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  // Show NAME (with role); if only an email is stored, fall back to the role.
  const personLabel = (name?: string, type?: string) => {
    const role = type ? capitalizeFirst(type) : "";
    if (name && !name.includes("@")) return role ? `${name} (${role})` : name;
    return role || "—";
  };

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
      orderedByDisplay: personLabel(order.createdby_name, order.createdby_type),
      orderStatusCell: (
        <StatusDropdown
          current={order.orderStatus || (order.cancelStatus === "cancelled" ? "cancelled" : "pending")}
          options={STATUS_OPTIONS}
          onSelect={(v) => handleStatusChange(order, v)}
        />
      ),
      activeStatus: order.status ? "Active" : "Inactive",
      cancelStatus: order.cancelStatus,
      isConverted: order.isConverted,
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Manage Sales Orders"
          columns={columns}
          data={tableData}
          showPrint={false}
          onView={(row) => navigate(`/salesorder/view/${row.id}`)}
          onEdit={(row) => navigate(`/salesorder/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete order ${row.billnumber}?`)) {
              try {
                await deleteSalesOrderMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Order deleted successfully.", type: "success" }));
              } catch (error) {
                dispatch(showMessage({ message: "Failed to delete order.", type: "error" }));
              }
            }
          }}
          onAdd={() => navigate("/salesorder/addedit")}
          showConvert={actions.showConvert}
          onConvert={(row) => navigate(`/salesinvoice/addedit?orderId=${row.id}`)}
          showCancel={false}
          onShowDeleted={() => navigate("/salesorder/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default SalesOrders;
