import { useNavigate } from "react-router";
import DataTable from "../../../components/datatable";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { selectModuleActions } from "../../../redux/slices/permissions";
import { useDeletedExpenseClaimsQuery, useExpenseClaimMutations } from "../../../graphql/hooks/expenseclaim";
import { formatDateDMY } from "../../../utils/helper";
import { CLAIM_CATEGORY_LABEL } from "../claims";

const DeletedExpenseClaims = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "expensenote"));
  const { data, loading } = useDeletedExpenseClaimsQuery();
  const { resetExpenseClaimMutation } = useExpenseClaimMutations();

  const rows = (data?.getDeletedExpenseClaims || []).map((c: any, i: number) => ({
    ...c,
    seqNo: i + 1,
    dateLabel: c.claimdate ? formatDateDMY(new Date(c.claimdate)) : "-",
    staffLabel: c.staffid?.name || "-",
    categoryLabel: CLAIM_CATEGORY_LABEL[c.category] || "Other",
    amountLabel: Number(c.amount || 0).toFixed(2),
    statusLabel: c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : "-",
  }));

  return (
    <DataTable
      title="Deleted Expense Claims"
      columns={[
        { label: "#", key: "seqNo" },
        { label: "Claim No", key: "claimnumber" },
        { label: "Date", key: "dateLabel" },
        { label: "Staff", key: "staffLabel" },
        { label: "Category", key: "categoryLabel" },
        { label: "Amount", key: "amountLabel" },
        { label: "Status", key: "statusLabel" },
      ]}
      data={rows}
      showView={false}
      showEdit={false}
      showDelete={false}
      showAdd={false}
      showImport={false}
      showExport={false}
      showDeleted={false}
      showReset={actions.canReset}
      onReset={async (row: any) => {
        if (!window.confirm(`Restore claim ${row.claimnumber}?`)) return;
        try {
          await resetExpenseClaimMutation({ variables: { id: row.id } });
          dispatch(showMessage({ message: "Claim restored.", type: "success" }));
          navigate("/expensenote?tab=claims");
        } catch (e: any) {
          dispatch(showMessage({ message: e?.message || "Failed to restore claim.", type: "error" }));
        }
      }}
      entriesOptions={[10, 25, 50]}
      defaultEntriesPerPage={10}
      isLoading={loading && rows.length === 0}
    />
  );
};

export default DeletedExpenseClaims;
