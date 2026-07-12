import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useDeletedTransactionsQuery,
  useTransactionMutations,
} from "../../../graphql/hooks/transactions";
import { showMessage } from "../../../redux/slices/message";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { formatDateDMY } from "../../../utils/helper";

const DeletedTransactions = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "transactions"));
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedTransactionsQuery();
  const { resetTransactionMutation } = useTransactionMutations();
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const deletedTransactions = data?.getDeletedTransactions || [];

  useEffect(() => {
    const fetchDeleted = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching deleted transactions:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchDeleted();
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Code", key: "transactioncode" },
    { label: "Type", key: "entrytype" },
    { label: "Date", key: "transactiondate" },
    { label: "Narration", key: "narration" },
    { label: "Total Debit", key: "totaldebit" },
    { label: "Total Credit", key: "totalcredit" },
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "status" },
  ];

  const tableData = deletedTransactions.map((txn: any, index: number) => {
    // 🔹 Convert string timestamp to number and format
    let formattedDate = "-";
    if (txn.transactiondate) {
      const ts = Number(txn.transactiondate);
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) {
        formattedDate = formatDateDMY(dt);
      } else {
        console.warn("Invalid date:", txn.transactiondate);
      }
    }

    // 🔹 Capitalize first letter
    const capitalizeFirstLetter = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    return {
      ...txn,
      seqNo: index + 1,
      transactiondate: formattedDate,
      entrytype: capitalizeFirstLetter(txn.entrytype),
      totaldebit: txn.totaldebit?.toFixed(2) || "0.00",
      totalcredit: txn.totalcredit?.toFixed(2) || "0.00",
      createdByDisplay: txn.createdby_name || "N/A",
      status: txn.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Deleted Transactions"
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
                `Are you sure you want to restore transaction "${row.transactioncode}"?`
              )
            ) {
              try {
                await resetTransactionMutation({ variables: { id: row.id } });
                dispatch(
                  showMessage({
                    message: "Transaction restored successfully.",
                    type: "success",
                  })
                );
                await refetch();
                navigate("/transactions");
              } catch (error) {
                console.error("Reset error:", error);
                dispatch(
                  showMessage({
                    message: "Failed to restore transaction.",
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

export default DeletedTransactions;
