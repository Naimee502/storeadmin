// src/pages/payments/index.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  usePaymentsQuery,
  usePaymentMutations,
} from "../../graphql/hooks/payments";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { selectModuleActions } from "../../redux/slices/permissions";

const Payment = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "payments"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = usePaymentsQuery();
  const { deletePaymentMutation } = usePaymentMutations();

  const paymentList = data?.getPayments || [];
  console.log("Payments Data:", JSON.stringify(paymentList));
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const { data: accountsData, refetch: accountsDataRefetch } = useAccountsQuery();

  useEffect(() => {
    const fetchPayments = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchPayments();
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Code", key: "paymentcode" },
    { label: "Type", key: "type" },
    { label: "Mode", key: "mode" },
    { label: "Date", key: "paymentdate" },
    { label: "Leadger", key: "ledgername" },
    { label: "Amount", key: "amount" },
    { label: "Status", key: "status" },
  ];

  const tableData = paymentList.map((pay: any, index: number) => {
    // Format date
    let formattedDate = "-";
    if (pay.paymentdate) {
      const ts = Number(pay.paymentdate);
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) formattedDate = dt.toLocaleDateString();
    }

    // Capitalize first letter
    const capitalizeFirstLetter = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    return {
      ...pay,
      seqNo: index + 1,
      paymentdate: formattedDate,
      type: capitalizeFirstLetter(pay.type),
      mode: capitalizeFirstLetter(pay.mode),
      ledgername: pay?.ledgerid?.ledgername || "-",
      amount: pay.amount?.toFixed(2) || "0.00",
      status: pay.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Payments"
          columns={columns}
          data={tableData}
          {...actions}
          onEdit={(row) => navigate(`/payments/addedit/${row.id}`)}
          onDelete={async (row: any) => {
            if (window.confirm(`Delete payment ${row.paymentcode}?`)) {
              try {
                await deletePaymentMutation({ variables: { id: row.id } });
                dispatch(
                  showMessage({
                    message: "Payment deleted successfully.",
                    type: "success",
                  })
                );
                await refetch();
              } catch (err) {
                console.error("Delete error:", err);
                dispatch(
                  showMessage({
                    message: "Failed to delete payment.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onAdd={() => navigate("/payments/addedit")}
          onShowDeleted={() => navigate("/payments/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default Payment;
