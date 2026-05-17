import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";
import {
  useDeletedPurchaseOrdersQuery,
  usePurchaseOrderMutations,
} from "../../../graphql/hooks/purchaseorder";

const DeletedPurchaseOrders = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector(state => selectModuleActions(state, "purchaseorder"));

  const { data, refetch } = useDeletedPurchaseOrdersQuery();
  const { resetPurchaseOrderMutation } = usePurchaseOrderMutations();
  const orderList = data?.getDeletedPurchaseOrders || [];
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
      billtype_billnumber: `PO-${order.billnumber}`,
      paymenttype: capitalizeFirst(order.paymenttype),
      createdby_name: order.createdby_name || "N/A",
      orderStatus: order.isConverted ? "Invoiced" : "Deleted",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Purchase Orders"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showReset={(row) => actions.canReset && !row.isConverted}
          showImport={false}
          showExport={false}
          showAdd={false}
          showDeleted={false}
          onReset={async (row) => {
            try {
              await resetPurchaseOrderMutation({
                variables: { id: row.id },
              });
              await refetch();
              dispatch(
                showMessage({
                  message: "Order restored successfully.",
                  type: "success",
                })
              );
            } catch (error) {
              console.error("Restore error:", error);
              dispatch(
                showMessage({
                  message: "Failed to restore order.",
                  type: "error",
                })
              );
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

export default DeletedPurchaseOrders;
