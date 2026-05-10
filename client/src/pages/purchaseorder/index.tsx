import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  usePurchaseOrdersQuery,
  usePurchaseOrderMutations,
} from "../../graphql/hooks/purchaseorder";

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { type } = useAppSelector((state) => state.auth);

  const { data, refetch } = usePurchaseOrdersQuery();
  const { deletePurchaseOrderMutation, cancelPurchaseOrderMutation } = usePurchaseOrderMutations();
  const orderList = data?.getPurchaseOrders || [];
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
    { label: "Created By", key: "createdby_name" },
    { label: "Status", key: "status" },
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
      billtype_billnumber: `PO-${order.billnumber}`,
      paymenttype: capitalizeFirst(order.paymenttype),
      createdby_name: order.createdby_name || "N/A",
      status: order.cancelStatus === "cancelled"
        ? "Cancelled"
        : (order.status ? "Active" : "Inactive"),
      cancelStatus: order.cancelStatus,
      isConverted: order.isConverted,
    };
  });

  // Convert is allowed to branch login (and admin) — staff cannot convert
  const canConvert = type === "branch" || type === "admin";

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Purchase Orders"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={true}
          showPrint={false}
          onView={(row) => navigate(`/purchaseorder/view/${row.id}`)}
          onEdit={(row) => navigate(`/purchaseorder/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to delete order ${row.billnumber}?`
              )
            ) {
              try {
                await deletePurchaseOrderMutation({
                  variables: { id: row.id },
                });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Order deleted successfully.",
                    type: "success",
                  })
                );
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(
                  showMessage({
                    message: "Failed to delete order.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onAdd={() => navigate("/purchaseorder/addedit")}
          showConvert={canConvert}
          onConvert={
            canConvert
              ? (row) =>
                  navigate(`/purchaseinvoice/addedit?orderId=${row.id}`)
              : undefined
          }
          showCancel={(row: any) => !row.isConverted && row.cancelStatus !== "cancelled"}
          onCancel={async (row: any) => {
            const reason = window.prompt(`Cancel Purchase Order ${row.billnumber}? Enter reason:`);
            if (reason === null) return;
            try {
              await cancelPurchaseOrderMutation({ variables: { id: row.id, reason } });
              await refetch();
              dispatch(showMessage({ message: "Order cancelled.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to cancel.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/purchaseorder/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default PurchaseOrders;
