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
  useExpenseNotesQuery,
  useExpenseNoteMutations,
} from "../../graphql/hooks/expensenote";

import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { formatDateDMY } from "../../utils/helper";

const ExpenseNote = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "expensenote"));
  const dispatch = useAppDispatch();

  const location = useLocation();
  const [tabState, setTab] = useState<string>(
    new URLSearchParams(location.search).get("tab") === "claims" ? "claims" : "notes"
  );
  // Pending-claims badge on the tab. Same query the tab itself uses, so it is
  // one request, shared through the Apollo cache.
  // Business Settings → Permissions → Expense Notes → "Expense Claims".
  const claimsOn = actions.showClaims;
  const { data: claimsData } = useExpenseClaimsQuery(!claimsOn);
  const tab = claimsOn ? tabState : "notes";
  const pendingClaims = (claimsData?.getExpenseClaims || []).filter((c: any) => c.status === "pending").length;

  const { data, refetch } = useExpenseNotesQuery();
  const { deleteExpenseNoteMutation } = useExpenseNoteMutations();

  const expenseList = data?.getExpenseNotes || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

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
        {/* Same layout as Attendance & Leave: page title first, tabs under it. */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{claimsOn ? <>Expense Notes &amp; Claims</> : "Expense Notes"}</h1>
        </div>
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
          </TabsContent>
        </Tabs>
      </div>
    </HomeLayout>
  );
};

export default ExpenseNote;
