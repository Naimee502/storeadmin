// src/pages/payments/deletedentries.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { useDeletedPaymentsQuery, usePaymentMutations } from "../../../graphql/hooks/payments";
import { showMessage } from "../../../redux/slices/message";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { formatDateDMY } from "../../../utils/helper";

const DeletedPayments = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "payments"));
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
    // Who the money actually moved with. Without it two ₹720 receipts on the
    // same day are indistinguishable in the list.
    { label: "Party / Ledger", key: "partyDisplay" },
    { label: "Mode", key: "mode" },
    { label: "Date", key: "paymentdate" },
   { label: "Leadger", key: "ledgername" },
    { label: "Amount", key: "amount" },
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "status" },
  ];

  const tableData = [...deletedPayments].reverse().map((pay: any, index: number) => {
    let formattedDate = "-";
    if (pay.paymentdate) {
      const ts = Number(pay.paymentdate);
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) formattedDate = formatDateDMY(dt);
    }

    const capitalizeFirstLetter = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    // A payment posts against EITHER a party — a customer or vendor whose bills
    // it settles — OR a plain ledger (capital, a loan, rent, salary, a bank
    // charge). Show whichever side this one used. The party's mobile is pulled
    // from the accounts list because the payment itself only carries the name,
    // and this business has parties that share one.
    const partyAcc = pay.partyid?.id
      ? accountsData?.getAccounts?.find((a: any) => a.id === pay.partyid.id)
      : null;
    const partyName = partyAcc?.name || pay.partyid?.name || "";
    const partyDisplay = partyName
      ? `${partyName}${partyAcc?.mobile ? ` - ${partyAcc.mobile}` : ""}`
      : pay?.counterledgerid?.ledgername || "-";

    return {
      ...pay,
      seqNo: index + 1,
      paymentdate: formattedDate,
      type: capitalizeFirstLetter(pay.type),
      partyDisplay,
      mode: capitalizeFirstLetter(pay.mode),
      ledgername: pay?.ledgerid?.ledgername || "-",
      amount: pay.amount?.toFixed(2) || "0.00",
      createdByDisplay: pay.createdby_name || "N/A",
      status: pay.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable          
          {...actions}
          title="Deleted Payments"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showAdd={false}
          showReset={actions.canReset}
           // ✅ Reset action
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
