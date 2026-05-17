import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";

import {
  useExpenseNotesQuery,
  useExpenseNoteMutations,
} from "../../graphql/hooks/expensenote";

import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";

const ExpenseNote = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "expensenote"));
  const dispatch = useAppDispatch();

  const { data, refetch } = useExpenseNotesQuery();
  const { deleteExpenseNoteMutation } = useExpenseNoteMutations();

  const expenseList = data?.getExpenseNotes || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  console.log("Expense Note List:", JSON.stringify(expenseList));

  /* =========================
     FETCH
     ========================= */

  useEffect(() => {
    const fetchExpenseNotes = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching expense notes:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchExpenseNotes();
  }, [dispatch, refetch]);

  /* =========================
     TABLE COLUMNS
     ========================= */

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Expense No", key: "expensenumber" },
    { label: "Date", key: "expensedate" },
    { label: "Category", key: "categoryLabel" },
    { label: "Staff", key: "staffLabel" },
    { label: "Ledger", key: "ledgername" },
    { label: "Payment Type", key: "paymenttype" },
    { label: "Narration", key: "narration" },
    { label: "Total Amount", key: "totalamount" },
    { label: "GST", key: "totalgst" },
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "status" },
  ];

  // Friendly label per category
  const CATEGORY_LABEL: Record<string, string> = {
    general: "General",
    tada: "TA/DA",
    salary: "Salary",
    other: "Other",
  };

  /* =========================
     FORMAT DATA
     ========================= */

  const tableData = expenseList.map((exp: any, index: number) => {
    let formattedDate = "-";

    if (exp.expensedate) {
      const timestamp = Number(exp.expensedate); // 🔥 FIX
      const dt = new Date(timestamp);

      if (!isNaN(dt.getTime())) {
        formattedDate = dt.toLocaleDateString("en-IN"); // 🇮🇳 Optional
      }
    }

    const capitalize = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    const staffLabel = exp.staffid
      ? `${exp.staffid.name}${exp.staffid.staffcode ? ` (${exp.staffid.staffcode})` : ""}`
      : "-";

    return {
      ...exp,
      seqNo: index + 1,
      expensedate: formattedDate,
      categoryLabel: CATEGORY_LABEL[exp.category || "general"] || "General",
      staffLabel,
      ledgername: exp.ledgerid?.ledgername || "-",
      paymenttype: capitalize(exp.paymenttype),
      totalamount: Number(exp.totalamount || 0).toFixed(2),
      totalgst: Number(exp.totalgst || 0).toFixed(2),
      createdByDisplay: exp.createdby_name || "N/A",
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
          title="Manage Expense Notes"
          columns={columns}
          data={tableData}
          
          
          
          
          
          
          onEdit={(row) =>
            navigate(`/expensenote/addedit/${row.id}`)
          }
          onDelete={async (row: any) => {
            if (
              window.confirm(
                `Delete expense note ${row.expensenumber || ""}?`
              )
            ) {
              try {
                await deleteExpenseNoteMutation({
                  variables: { id: row.id },
                });

                dispatch(
                  showMessage({
                    message: "Expense note deleted successfully.",
                    type: "success",
                  })
                );

                await refetch();
              } catch (err) {
                console.error("Delete error:", err);
                dispatch(
                  showMessage({
                    message: "Failed to delete expense note.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onAdd={() => navigate("/expensenote/addedit")}
          onShowDeleted={() =>
            navigate("/expensenote/deletedentries")
          }
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default ExpenseNote;
