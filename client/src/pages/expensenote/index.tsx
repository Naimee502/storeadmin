import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/tabs";
import ExpenseClaimsTab from "./claims";
import { useExpenseClaimsQuery } from "../../graphql/hooks/expenseclaim";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";

import {
  useExpenseNotesPageQuery,
  useExpenseNoteMutations,
} from "../../graphql/hooks/expensenote";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";

import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { formatDateDMY } from "../../utils/helper";

// Columns the server can filter (Seq is per page, so it has none).
const SERVER_FILTER_KEYS = [
  "expensenumber", "expensedate", "categoryLabel", "staffLabel", "ledgername",
  "paymenttype", "narration", "totalamount", "totalgst", "createdByDisplay", "status",
];

const ExpenseNote = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "expensenote"));
  const dispatch = useAppDispatch();

  const location = useLocation();
  const [tabState, setTab] = useState<string>(
    new URLSearchParams(location.search).get("tab") === "claims" ? "claims" : "notes"
  );
  // Pending-claims badge (shares the tab's query via cache; permission: Expense Claims).
  const claimsOn = actions.showClaims;
  const { data: claimsData } = useExpenseClaimsQuery(!claimsOn);
  const tab = claimsOn ? tabState : "notes";
  const pendingClaims = (claimsData?.getExpenseClaims || []).filter((c: any) => c.status === "pending").length;

  const table = useServerTable("expensenote", SERVER_FILTER_KEYS);
  const { items: expenseList, total, loading, refetch } = useExpenseNotesPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const { deleteExpenseNoteMutation } = useExpenseNoteMutations();

  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Fetch

  useEffect(() => {
    const fetchExpenseNotes = async () => {
      // Rows already cached: refresh quietly without the full-screen loader.
      const blocking = !expenseList.length;
      if (blocking) dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching expense notes:", error);
      } finally {
        if (blocking) dispatch(hideLoading());
      }
    };

    fetchExpenseNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, refetch]);

  // Table columns

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

  // Format data

  const tableData = expenseList.map((exp: any, index: number) => {
    let formattedDate = "-";

    if (exp.expensedate) {
      const timestamp = Number(exp.expensedate);
      const dt = new Date(timestamp);

      if (!isNaN(dt.getTime())) {
        formattedDate = formatDateDMY(dt);
      }
    }

    const capitalize = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    const staffLabel = exp.staffid
      ? `${exp.staffid.name}${exp.staffid.staffcode ? ` (${exp.staffid.staffcode})` : ""}`
      : "-";

    return {
      ...exp,
      seqNo: table.offset + index + 1,
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

  // UI

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        {/* Same layout as Attendance & Leave: page title first, tabs under it. */}
        {/* Title only with tabs; otherwise DataTable shows its own. */}
        {claimsOn && (
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Expense Notes &amp; Claims</h1>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          {claimsOn && (
          <TabsList className="flex flex-wrap mb-3">
            <TabsTrigger value="notes">Expense Notes</TabsTrigger>
            <TabsTrigger value="claims">
              Expense Claims
              {pendingClaims > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-yellow-500 text-white text-[9px] font-bold">
                  {pendingClaims}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          )}
          {claimsOn && (
            <TabsContent value="claims">
              <ExpenseClaimsTab />
            </TabsContent>
          )}
          <TabsContent value="notes">
        <DataTable requireBranchForAdd={true}
          {...actions}
          title="Expense Notes"
          columns={columns}
          data={tableData}
          serverPaging={serverPaging}
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
          isLoading={loading || isLoading}
        />
          </TabsContent>
        </Tabs>
      </div>
    </HomeLayout>
  );
};

export default ExpenseNote;
