import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { FaCheck, FaTimes, FaMoneyBillWave, FaPaperclip } from "react-icons/fa";

import DataTable from "../../components/datatable";
import Modal from "../../components/modal";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions } from "../../redux/slices/permissions";
import { useExpenseClaimsQuery, useExpenseClaimMutations } from "../../graphql/hooks/expenseclaim";
import { useAccountLedgersQuery } from "../../graphql/hooks/accountledgers";
import { formatDateDMY } from "../../utils/helper";

/**
 * Expense Claims — reimbursement requests a salesman / delivery boy / staff
 * files from the app (Zoho Expense style).
 *
 *   Approve → the server books an Expense Note: Dr TA/DA Expense (or the
 *             ledger picked here) / Cr <staff ledger>.
 *   Pay     → opens Payments → Expense with that note selected; paying it
 *             posts Dr <staff ledger> / Cr Cash-Bank.
 */

export const CLAIM_CATEGORY_LABEL: Record<string, string> = {
  travel: "Travel",
  fuel: "Fuel",
  food: "Food",
  lodging: "Lodging",
  phone: "Phone / Internet",
  other: "Other",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
  paid: "bg-blue-100 text-blue-800",
  partpaid: "bg-indigo-100 text-indigo-800",
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const rupees = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Approved claims also say how far reimbursement has got. */
const payState = (c: any): "paid" | "partpaid" | null => {
  if (c.status !== "approved") return null;
  const due = Number(c.approvedamount ?? c.amount);
  const paid = Number(c.paidamount || 0);
  if (paid >= due - 0.009) return "paid";
  if (paid > 0) return "partpaid";
  return null;
};

const ExpenseClaimsTab = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "expensenote"));
  const authType = useAppSelector((s) => s.auth.type);
  const canDecide = (authType === "admin" || authType === "branch") && actions.showEdit;

  const { data, loading } = useExpenseClaimsQuery();
  const { data: ledgerData } = useAccountLedgersQuery("cache-first");
  const { approveExpenseClaimMutation, rejectExpenseClaimMutation, deleteExpenseClaimMutation } =
    useExpenseClaimMutations();

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [approving, setApproving] = useState<any>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [form, setForm] = useState<{ approvedamount: string; expenseledgerid: string; remarks: string; reason: string }>({
    approvedamount: "",
    expenseledgerid: "",
    remarks: "",
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [receiptView, setReceiptView] = useState<string[] | null>(null);

  const notify = (message: string, type: "success" | "error" = "success") => dispatch(showMessage({ message, type }));

  const claims: any[] = data?.getExpenseClaims || [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { "": claims.length };
    claims.forEach((x) => (c[x.status] = (c[x.status] || 0) + 1));
    return c;
  }, [claims]);

  // Expense-side ledgers for the approval picker. Blank = the TA/DA default.
  const ledgerOptions = useMemo(() => {
    const all: any[] = ledgerData?.getAccountLedgers || [];
    return [
      { label: "TA/DA Expense (default)", value: "" },
      ...all
        .filter((l) => l.status !== false && /expense/i.test(`${l.ledgertype || ""} ${l.accountgroupid?.accountgroupname || ""}`))
        .map((l) => ({ label: l.ledgername, value: l.id })),
    ];
  }, [ledgerData]);

  const openApprove = (row: any) => {
    setForm({ approvedamount: String(row.amount), expenseledgerid: "", remarks: "", reason: "" });
    setApproving(row);
  };
  const openReject = (row: any) => {
    setForm({ approvedamount: "", expenseledgerid: "", remarks: "", reason: "" });
    setRejecting(row);
  };

  const doApprove = async () => {
    const amt = Number(form.approvedamount);
    if (!(amt > 0)) return notify("Enter the amount to approve.", "error");
    if (amt > Number(approving.amount)) return notify("Approved amount cannot be more than claimed.", "error");
    setBusy(true);
    try {
      await approveExpenseClaimMutation({
        variables: {
          id: approving.id,
          approvedamount: amt,
          expenseledgerid: form.expenseledgerid || null,
          remarks: form.remarks || null,
        },
      });
      notify("Claim approved. An Expense Note was created — pay it from Payments → Expense.");
      setApproving(null);
    } catch (e: any) {
      notify(e?.message || "Could not approve the claim.", "error");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!form.reason.trim()) return notify("Enter a reason.", "error");
    setBusy(true);
    try {
      await rejectExpenseClaimMutation({ variables: { id: rejecting.id, reason: form.reason.trim() } });
      notify("Claim rejected.");
      setRejecting(null);
    } catch (e: any) {
      notify(e?.message || "Could not reject the claim.", "error");
    } finally {
      setBusy(false);
    }
  };

  const onChange = (e: any) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const btn = "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border";

  const rows = claims
    .filter((c) => !statusFilter || c.status === statusFilter)
    .map((c, i) => {
      const ps = payState(c);
      const badgeKey = ps || c.status;
      const due = Number(c.approvedamount ?? c.amount);
      return {
        ...c,
        seqNo: i + 1,
        dateLabel: c.claimdate ? formatDateDMY(new Date(c.claimdate)) : "-",
        staffLabel: c.staffid ? `${c.staffid.name}${c.staffid.role ? ` (${c.staffid.role === "deliveryboy" ? "Delivery" : cap(c.staffid.role)})` : ""}` : "-",
        categoryLabel: `${CLAIM_CATEGORY_LABEL[c.category] || "Other"}${c.distancekm ? ` · ${c.distancekm} km` : ""}`,
        amountLabel: rupees(c.amount),
        approvedLabel: c.status === "approved" ? rupees(c.approvedamount) : "-",
        paidLabel: c.status === "approved" ? `${rupees(c.paidamount)} / ${rupees(due)}` : "-",
        noteLabel: c.expensenumber || "-",
        descLabel: (
          <span className="max-w-[220px] inline-block truncate align-middle" title={c.rejectionreason ? `${c.description}\nRejected: ${c.rejectionreason}` : c.description}>
            {c.description || "-"}
            {c.rejectionreason ? <span className="block text-[11px] text-red-600 truncate">Rejected: {c.rejectionreason}</span> : null}
          </span>
        ),
        statusLabel: (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[badgeKey] || ""}`}>
            {ps === "paid" ? "Paid" : ps === "partpaid" ? "Part paid" : cap(c.status)}
          </span>
        ),
        decide: (
          <div className="flex gap-1 flex-nowrap">
            {c.receipts?.length > 0 && (
              <button onClick={() => setReceiptView(c.receipts)} className={`${btn} bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200`} title="View bills">
                <FaPaperclip size={9} /> {c.receipts.length}
              </button>
            )}
            {canDecide && c.status === "pending" && (
              <>
                <button onClick={() => openApprove(c)} className={`${btn} bg-green-50 hover:bg-green-100 text-green-700 border-green-200`}>
                  <FaCheck size={9} /> Approve
                </button>
                <button onClick={() => openReject(c)} className={`${btn} bg-red-50 hover:bg-red-100 text-red-600 border-red-200`}>
                  <FaTimes size={9} /> Reject
                </button>
              </>
            )}
            {c.status === "approved" && ps !== "paid" && c.expensenoteid && (
              <button
                onClick={() => navigate(`/payments/addedit?expensenote=${c.expensenoteid}`)}
                className={`${btn} bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200`}
                title="Reimburse through Payments → Expense"
              >
                <FaMoneyBillWave size={9} /> Pay
              </button>
            )}
          </div>
        ),
      };
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {(["pending", "approved", "rejected", "cancelled", ""] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
              statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
            }`}
          >
            {s ? cap(s) : "All"} ({counts[s] || 0})
          </button>
        ))}
      </div>

      <DataTable
        title="Expense Claims"
        columns={[
          { label: "#", key: "seqNo" },
          { label: "Claim No", key: "claimnumber" },
          { label: "Date", key: "dateLabel" },
          { label: "Staff", key: "staffLabel" },
          { label: "Category", key: "categoryLabel" },
          { label: "Description", key: "descLabel" },
          { label: "Claimed", key: "amountLabel" },
          { label: "Approved", key: "approvedLabel" },
          { label: "Paid", key: "paidLabel" },
          { label: "Expense No", key: "noteLabel" },
          { label: "Status", key: "statusLabel" },
          { label: "Decision", key: "decide" },
        ]}
        data={rows}
        showView={false}
        showEdit={false}
        showAdd={false}
        showReset={false}
        showImport={false}
        showExport={false}
        showDelete={actions.showDelete}
        showDeleted={actions.showDeleted}
        onShowDeleted={() => navigate("/expensenote/deletedentries?tab=claims")}
        onDelete={async (row: any) => {
          if (row.status === "approved") return notify("An approved claim cannot be deleted — delete its Expense Note instead.", "error");
          if (!window.confirm(`Delete claim ${row.claimnumber}?`)) return;
          try {
            await deleteExpenseClaimMutation({ variables: { id: row.id } });
            notify("Claim deleted.");
          } catch (e: any) {
            notify(e?.message || "Could not delete.", "error");
          }
        }}
        entriesOptions={[10, 25, 50]}
        defaultEntriesPerPage={10}
        isLoading={loading && claims.length === 0}
      />

      <Modal isOpen={!!approving} onClose={() => setApproving(null)} type="custom" title="Approve Expense Claim" size="md">
        {approving && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              {approving.claimnumber} · {approving.staffid?.name} · {CLAIM_CATEGORY_LABEL[approving.category]} · claimed{" "}
              <b>{rupees(approving.amount)}</b>
            </div>
            <FormField label="Approved Amount" name="approvedamount" type="number" value={form.approvedamount} onChange={onChange} required />
            <FormField
              label="Expense Ledger"
              name="expenseledgerid"
              type="select"
              searchable
              options={ledgerOptions}
              value={form.expenseledgerid}
              onChange={onChange}
            />
            <FormField label="Remarks (optional)" name="remarks" value={form.remarks} onChange={onChange} />
            <p className="text-xs text-gray-500">
              Books an Expense Note on credit to the staff member's ledger. Reimburse it later with the <b>Pay</b> button
              (Payments → Expense).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
              <Button variant="success" onClick={doApprove} disabled={busy}>{busy ? "Approving…" : "Approve"}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} type="custom" title="Reject Expense Claim" size="md">
        {rejecting && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              {rejecting.claimnumber} · {rejecting.staffid?.name} · {rupees(rejecting.amount)}
            </div>
            <FormField label="Reason" name="reason" value={form.reason} onChange={onChange} required />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doReject} disabled={busy}>{busy ? "Rejecting…" : "Reject"}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!receiptView} onClose={() => setReceiptView(null)} type="custom" title="Bills / Receipts" size="lg">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(receiptView || []).map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block border rounded overflow-hidden hover:shadow">
              <img src={url} alt="receipt" className="w-full h-40 object-cover" />
            </a>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ExpenseClaimsTab;
