// src/pages/payments/deletedentries.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { useDeletedPaymentsQuery, usePaymentMutations } from "../../../graphql/hooks/payments";
import { showMessage } from "../../../redux/slices/message";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";

const DeletedPayments = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedPaymentsQuery();
  const { resetPaymentMutation } = usePaymentMutations();
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const deletedPayments = data?.getDeletedPayments || [];
  
  const { data: accountsData, refetch: accountsDataRefetch } = useAccountsQuery();

  useEffect(() => {
    const fetchDeleted = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching deleted payments:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchDeleted();
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

  const tableData = deletedPayments.map((pay: any, index: number) => {
    let formattedDate = "-";
    if (pay.paymentdate) {
      const ts = Number(pay.paymentdate);
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) formattedDate = dt.toLocaleDateString();
    }

    const capitalizeFirstLetter = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    const party = accountsData?.getAccounts.find(a => a.id === pay.partyid);

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
          title="Deleted Payments"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showAdd={false}
          showReset={true} // ✅ Reset action
          onReset={async (row: any) => {
            if (
              window.confirm(
                `Are you sure you want to restore payment "${row.paymentcode}"?`
              )
            ) {
              try {
                await resetPaymentMutation({ variables: { id: row.id } });
                dispatch(
                  showMessage({
                    message: "Payment restored successfully.",
                    type: "success",
                  })
                );
                await refetch();
                navigate("/payments");
              } catch (error) {
                console.error("Reset error:", error);
                dispatch(
                  showMessage({
                    message: "Failed to restore payment.",
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

export default DeletedPayments;
