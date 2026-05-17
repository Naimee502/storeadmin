import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useTransactionsQuery,
  useTransactionMutations,
} from "../../graphql/hooks/transactions";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";

const Transaction = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "transactions"));
  const dispatch = useAppDispatch();
  const { data, refetch } = useTransactionsQuery();
  const { deleteTransactionMutation } = useTransactionMutations();

  const transactionList = data?.getTransactions || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  console.log("Transaction List:", JSON.stringify(transactionList));

  useEffect(() => {
    const fetchTransactions = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchTransactions();
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

  const tableData = transactionList.map((txn: any, index: number) => {
    // 🔹 Convert string timestamp to number and format
    let formattedDate = "-";
    if (txn.transactiondate) {
      const ts = Number(txn.transactiondate);
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) {
        formattedDate = dt.toLocaleDateString();
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
          title="Manage Transactions"
          columns={columns}
          data={tableData}
          
          
          
          
          
          
          onEdit={(row) => navigate(`/transactions/addedit/${row.id}`)}
          onDelete={async (row: any) => {
            if (window.confirm(`Delete transaction ${row.transactioncode}?`)) {
              try {
                await deleteTransactionMutation({ variables: { id: row.id } });
                dispatch(
                  showMessage({
                    message: "Transaction deleted successfully.",
                    type: "success",
                  })
                );
                await refetch();
              } catch (err) {
                console.error("Delete error:", err);
                dispatch(
                  showMessage({
                    message: "Failed to delete transaction.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onAdd={() => navigate("/transactions/addedit")}
          onShowDeleted={() => navigate("/transactions/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default Transaction;
