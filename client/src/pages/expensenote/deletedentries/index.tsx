import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";

import {
  useDeletedExpenseNotesQuery,
  useExpenseNoteMutations,
} from "../../../graphql/hooks/expensenote";

import { showMessage } from "../../../redux/slices/message";
import { showLoading, hideLoading } from "../../../redux/slices/loader";

const DeletedExpenseNotes = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "expensenote"));
  const dispatch = useAppDispatch();

  const { data, refetch } = useDeletedExpenseNotesQuery();
  const { resetExpenseNoteMutation } = useExpenseNoteMutations();

  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const deletedExpenseNotes = data?.getDeletedExpenseNotes || [];

  /* =========================
     FETCH
     ========================= */

  useEffect(() => {
    const fetchDeleted = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching deleted expense notes:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchDeleted();
  }, [dispatch, refetch]);

  /* =========================
     TABLE COLUMNS
     ========================= */

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Expense No", key: "expensenumber" },
    { label: "Date", key: "expensedate" },
    { label: "Payment Type", key: "paymenttype" },
    { label: "Narration", key: "narration" },
    { label: "Total Amount", key: "totalamount" },
    { label: "GST", key: "totalgst" },
    { label: "Status", key: "status" },
  ];

  /* =========================
     FORMAT DATA
     ========================= */

  const tableData = deletedExpenseNotes.map((exp: any, index: number) => {
    let formattedDate = "-";

    if (exp.expensedate) {
      const timestamp = Number(exp.expensedate); // 🔥 FIX
      const dt = new Date(timestamp);

      if (!isNaN(dt.getTime())) {
        formattedDate = dt.toLocaleDateString("en-IN");
      }
    }

    const capitalize = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    return {
      ...exp,
      seqNo: index + 1,
      expensedate: formattedDate,
      paymenttype: capitalize(exp.paymenttype),
      totalamount: Number(exp.totalamount || 0).toFixed(2),
      totalgst: Number(exp.totalgst || 0).toFixed(2),
      status: exp.status ? "Active" : "Inactive",
    };
  });

  /* =========================
     UI
     ========================= */

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Deleted Expense Notes"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showAdd={false}
          showReset={actions.canReset}
          showImport={false}
          showExport={false}
          
          onReset={async (row: any) => {
            if (
              window.confirm(
                `Are you sure you want to restore expense note "${row.expensenumber}"?`
              )
            ) {
              try {
                await resetExpenseNoteMutation({
                  variables: { id: row.id },
                });

                dispatch(
                  showMessage({
                    message: "Expense note restored successfully.",
                    type: "success",
                  })
                );

                await refetch();
                navigate("/expensenote");
              } catch (error) {
                console.error("Reset error:", error);
                dispatch(
                  showMessage({
                    message: "Failed to restore expense note.",
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

export default DeletedExpenseNotes;
