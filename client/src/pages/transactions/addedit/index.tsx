import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import { FaCalendarAlt, FaFileAlt, FaTrash } from "react-icons/fa";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import BillAllocation, { type Allocation } from "../../../components/billallocation";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useTransactionMutations, useTransactionByIDQuery, usePreviewInvoiceJournalLazy, useTransactionsQuery } from "../../../graphql/hooks/transactions";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useExpenseNotesQuery } from "../../../graphql/hooks/expensenote";


const AddEditTransaction = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);

  const adminId = admin?.id;
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);

  // Who is creating this entry — so "Created By" is never N/A (mirrors Payment page).
  const creator = useMemo(() => {
    if (type === "admin" && admin) return { id: admin.id, name: admin.name, type: "admin" };
    if (type === "branch" && branch) return { id: branch.id, name: branch.branchname || branch.name || "Branch", type: "branch" };
    if (type === "staff" && staff) return { id: staff.id, name: staff.name, type: "staff" };
    return { id: "", name: "Unknown", type: "unknown" };
  }, [type, admin, branch, staff]);

  const transactionFormPermissions = useAppSelector(state => state.permissions.permissions?.formPermissions?.transactions || {});
  const isFieldEnabled = (fieldId: string) => transactionFormPermissions[fieldId] !== false;

  const { data: existingData } = useTransactionByIDQuery(id || "");
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: accountsData } = useAccountsQuery();
  const { data: expenseNotesData } = useExpenseNotesQuery();
  const { data: transactionsData } = useTransactionsQuery();
  const ledgerList = ledgerData?.getAccountLedgers || [];

  // Expense notes already journal-recorded (linked to a transaction) — hidden so
  // the same note can't be recorded twice. Exclude the current txn in edit mode.
  const recordedExpenseNoteIds = useMemo(() => {
    const s = new Set<string>();
    (transactionsData?.getTransactions || []).forEach((txn: any) => {
      if (id && txn.id === id) return;
      (txn.invoices || []).forEach((inv: any) => {
        if (inv.invoicemodel === "ExpenseNote" && inv.invoiceid) s.add(inv.invoiceid);
      });
    });
    return s;
  }, [transactionsData, id]);

  const expenseNoteOptions = useMemo(
    () =>
      (expenseNotesData?.getExpenseNotes || [])
        .filter((e: any) => !recordedExpenseNoteIds.has(e.id))
        .map((e: any) => ({
          value: e.id,
          label: `${e.expensenumber || e.id} · ₹${Number(e.totalamount || 0).toFixed(2)}${
            e.narration ? ` · ${e.narration}` : ""
          }`,
        })),
    [expenseNotesData, recordedExpenseNoteIds]
  );

  // ── Tally-style bill allocation (Agst Ref) ─────────────────────────────
  const [partyid, setPartyid] = useState("");
  const [settleSide, setSettleSide] = useState<"SalesInvoice" | "PurchaseInvoice" | "ExpenseNote">("SalesInvoice");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenseNoteId, setExpenseNoteId] = useState("");
  const fetchPreview = usePreviewInvoiceJournalLazy();

  const partyOptions = useMemo(() => {
    return (accountsData?.getAccounts || [])
      .filter((a: any) =>
        settleSide === "SalesInvoice"
          ? a.type === "customer"
          : a.type === "vendor" || a.type === "other"
      )
      .map((a: any) => ({
        value: a.id,
        label: `${a.name}${a.mobile ? ` - ${a.mobile}` : ""}`,
      }));
  }, [accountsData, settleSide]);

  // Full Journal: rebuild the invoice's complete accounting journal
  // (Dr Debtor / Cr Sales / Cr GST … or Dr Purchase / Dr GST / Cr Vendor) from
  // the server — identical to what auto-posting creates. Used when the
  // auto-create-journal flag is OFF and the user records the sale manually.
  useEffect(() => {
    if (allocations.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const lines: any[] = [];
        for (const a of allocations) {
          const res: any = await fetchPreview({
            variables: { invoiceid: a.invoiceid, invoicemodel: a.invoicemodel },
          });
          (res?.data?.previewInvoiceJournal || []).forEach((l: any) => {
            lines.push({
              ledgerid: l.ledgerid || "",
              debit: l.debit ? String(l.debit) : "",
              credit: l.credit ? String(l.credit) : "",
              remarks: l.remarks || "",
            });
          });
        }
        if (!cancelled && lines.length) {
          setFormValues(prev => ({ ...prev, entries: lines }));
          setFormErrors(prev => ({ ...prev, entries: "" }));
        }
      } catch {
        /* preview failed — leave entries as-is */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allocations.map(a => a.invoiceid)), settleSide]);

  // Expense Note: pull its full journal (Dr Expense / Cr Cash-or-Payable) from
  // the server, so when auto-posting is OFF you record it manually here.
  useEffect(() => {
    if (settleSide !== "ExpenseNote" || !expenseNoteId) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await fetchPreview({
          variables: { invoiceid: expenseNoteId, invoicemodel: "ExpenseNote" },
        });
        const lines = (res?.data?.previewInvoiceJournal || []).map((l: any) => ({
          ledgerid: l.ledgerid || "",
          debit: l.debit ? String(l.debit) : "",
          credit: l.credit ? String(l.credit) : "",
          remarks: l.remarks || "",
        }));
        if (!cancelled && lines.length) {
          setFormValues(prev => ({ ...prev, entries: lines }));
          setFormErrors(prev => ({ ...prev, entries: "" }));
        }
      } catch {
        /* preview failed — leave entries as-is */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleSide, expenseNoteId]);

  const [formValues, setFormValues] = useState({
    transactiondate: new Date().toISOString().slice(0, 10),
    narration: "",
    entrytype: "manual",
    entries: [
      { ledgerid: "", debit: "", credit: "", remarks: "" } 
    ],
    status: true,
    adminid: adminId || "",
    branchid: branchId || "",
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const { addTransactionMutation, editTransactionMutation } = useTransactionMutations();

  // Load existing transaction for edit
  useEffect(() => {
  if (isEdit && existingData?.getTransactionById) {
    const t = existingData.getTransactionById;
    setFormValues({
      transactiondate: formatTransactionDate(t.transactiondate),
      narration: t.narration || "",
      entrytype: t.entrytype || "manual",
      entries: t.entries?.map((e: any) => ({
        ledgerid: e.ledgerid.id,
        debit: e.debit !== undefined ? e.debit : "",   
        credit: e.credit !== undefined ? e.credit : "",
        remarks: e.remarks || "",
      })) || [],
      status: t.status ?? true,
      adminid: typeof t.adminid === "string" ? t.adminid : t.adminid?.id || t.adminid?._id || adminId || "",
      branchid: typeof t.branchid === "string" ? t.branchid : t.branchid?.id || t.branchid?._id || branchId || "",
    });

    // Restore bill allocation
    if (t.partyid) setPartyid(typeof t.partyid === "string" ? t.partyid : t.partyid?.id || "");
    if (t.invoices?.length) {
      setSettleSide(t.invoices[0]?.invoicemodel === "PurchaseInvoice" ? "PurchaseInvoice" : "SalesInvoice");
      setAllocations(
        t.invoices.map((iv: any) => ({
          invoiceid: typeof iv.invoiceid === "string" ? iv.invoiceid : iv.invoiceid?.id,
          invoicemodel: iv.invoicemodel,
          settledamount: iv.settledamount,
        }))
      );
    }
  }
}, [isEdit, existingData]);

const formatTransactionDate = (date: any) => {
  if (!date) return new Date().toISOString().slice(0, 10);
  const ts = Number(date);
  if (!isNaN(ts)) {
    const dt = new Date(ts);
    return dt.toISOString().slice(0, 10);
  }
  // fallback for ISO string
  return new Date(date).toISOString().slice(0, 10);
};

  // Handlers
  const handleChange = (name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleEntryChange = (index: number, field: string, value: any) => {
    const updatedEntries = [...formValues.entries];
    updatedEntries[index][field] = value;
    setFormValues(prev => ({ ...prev, entries: updatedEntries }));
  };

  const addEntryRow = () => {
    setFormValues(prev => ({
      ...prev,
      entries: [...prev.entries, { ledgerid: "", debit: "", credit: "", remarks: "" }]
    }));
  };

  const removeEntryRow = (index: number) => {
    setFormValues(prev => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index)
    }));
  };

  // Validation: must balance
  const validate = () => {
    const errors: { [key: string]: string } = {};
    const totalDebit = formValues.entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    const totalCredit = formValues.entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);

    if (totalDebit !== totalCredit) {
      errors.entries = "Transaction not balanced (Debit ≠ Credit)";
    }
    if (formValues.entries.some(e => !e.ledgerid)) errors.entries = "All entries must have a ledger";
    return errors;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setFormErrors(validationErrors);
      return;
    }

    const input = {
      ...formValues,
      entries: formValues.entries.map(e => ({
        ledgerid: e.ledgerid,
        debit: parseFloat(String(e.debit)) || 0,
        credit: parseFloat(String(e.credit)) || 0,
        remarks: e.remarks,
      })),
      createdby_id: creator.id,
      createdby_name: creator.name,
      createdby_type: creator.type,
      partyid: partyid || null,
      // This page only RECORDS the full journal of a sale/purchase/expense note
      // (Dr Debtor / Cr Sales / Cr GST …). It never settles a bill — settledamount
      // is 0 so the invoice/note's outstanding is untouched. The link is stored only
      // so the same invoice/expense note can't be journal-recorded twice (it's hidden
      // next time).
      invoices:
        settleSide === "ExpenseNote"
          ? (expenseNoteId
              ? [{ invoiceid: expenseNoteId, invoicemodel: "ExpenseNote", settledamount: 0 }]
              : [])
          : allocations
              .filter(a => a.invoiceid)
              .map(a => ({
                invoiceid: a.invoiceid,
                invoicemodel: a.invoicemodel,
                settledamount: 0,
              })),
    };

    try {
      if (isEdit) {
        await editTransactionMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Transaction updated successfully", type: "success" }));
      } else {
        await addTransactionMutation({ variables: { input } });
        dispatch(showMessage({ message: "Transaction added successfully", type: "success" }));
      }
      navigate("/transactions");
    } catch (error) {
      dispatch(showMessage({ message: "Error saving transaction", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 text-sm sm:text-base">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
          {isEdit ? "Edit Transaction" : "Add Transaction"}
        </h2>

        <div className="space-y-6">
          {/* Basic Info */}
        <fieldset className="border rounded-xl p-4">
        <legend className="text-sm sm:text-base font-medium px-2">Transaction Info</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {isFieldEnabled("date") && (<FormField
            label="Date"
            name="transactiondate"
            type="date"
            value={formValues.transactiondate}
            onChange={(e) => handleChange("transactiondate", e.target.value)}
            icon={<FaCalendarAlt />}
            />)}

            {isFieldEnabled("narration") && (<FormField
            label="Narration"
            name="narration"
            value={formValues.narration}
            onChange={(e) => handleChange("narration", e.target.value)}
            icon={<FaFileAlt />}
            placeholder="Enter narration"
            />)}

            {isFieldEnabled("entrytype") && (<FormField
              label="Entry Type"
              name="entrytype"
              type="select"
              value={formValues.entrytype}
              onChange={(e) => handleChange("entrytype", e.target.value)}
              options={[
                { label: "Manual", value: "manual" },
                { label: "Auto", value: "auto" },
              ]}
            />)}

            {isFieldEnabled("status") && (<FormSwitch
            label="Status"
            name="status"
            checked={formValues.status}
            onChange={(val) => handleChange("status", val)}
            />)}
        </div>
        </fieldset>


          {/* Bill Allocation (Tally "Agst Ref") — optional */}
          {isFieldEnabled("record_journal_section") && (
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm sm:text-base font-medium px-2">
              Record Full Journal (Sale / Purchase / Expense Note) — optional
            </legend>
            <p className="text-xs text-gray-500">
              Select a party + invoice (or an expense note) and the Entries below are
              filled with its complete accounting journal — identical to auto-posting.
              The bill stays outstanding; this only records the journal.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isFieldEnabled("record_from") && (<FormField
                label="Record From"
                name="settleSide"
                type="select"
                value={settleSide}
                onChange={(e) => {
                  setSettleSide(e.target.value as "SalesInvoice" | "PurchaseInvoice" | "ExpenseNote");
                  setPartyid("");
                  setAllocations([]);
                  setExpenseNoteId("");
                }}
                options={[
                  { label: "Customer (Sales Invoices)", value: "SalesInvoice" },
                  { label: "Vendor (Purchase Invoices)", value: "PurchaseInvoice" },
                  { label: "Expense Note (record journal)", value: "ExpenseNote" },
                ]}
              />)}
              {isFieldEnabled("record_party") && (
                settleSide === "ExpenseNote" ? (
                  <FormField
                    label="Expense Note"
                    name="expenseNoteId"
                    type="select"
                    value={expenseNoteId}
                    onChange={(e) => setExpenseNoteId(e.target.value)}
                    options={expenseNoteOptions}
                    placeholder="Select expense note"
                    searchable
                  />
                ) : (
                  <FormField
                    label={settleSide === "SalesInvoice" ? "Customer (Party)" : "Vendor (Party)"}
                    name="partyid"
                    type="select"
                    value={partyid}
                    onChange={(e) => {
                      setPartyid(e.target.value);
                      setAllocations([]);
                    }}
                    options={partyOptions}
                    placeholder="Select party (optional)"
                    searchable
                  />
                )
              )}
            </div>

            {settleSide !== "ExpenseNote" && partyid && (
              <BillAllocation
                partyid={partyid}
                invoicemodel={settleSide as "SalesInvoice" | "PurchaseInvoice"}
                value={allocations}
                onChange={setAllocations}
                excludeTransactionId={id}
                mode="record"
              />
            )}

            {/* EXPENSE NOTE — full journal pulled from the server */}
            {settleSide === "ExpenseNote" && expenseNoteId && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900">
                The Entries below have been filled with this Expense Note's journal —
                <b> identical to what auto-posting creates</b> (Dr Expense / Cr Input GST /
                Cr Cash-or-Payable). Use this when "Auto-create journal on expense" is OFF
                and you're recording it manually. You can still tweak any line below.
              </div>
            )}

            {/* Full Journal — entries are fetched from the server */}
            {partyid && allocations.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900">
                The Entries below have been filled with the invoice's complete accounting
                journal — <b>identical to what auto-posting creates</b> (Dr Debtor / Cr Sales /
                Cr Output GST / charges …). Use this when "Auto-create journal on invoice" is OFF
                and you're recording the sale manually. You can still tweak any line above.
              </div>
            )}
          </fieldset>
          )}

          {/* Entries */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Entries</legend>
            {formValues.entries.map((entry, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-3">
                {isFieldEnabled("ledger") && (<FormField
                  label="Ledger"
                  name={`ledgerid-${index}`}
                  type="select"
                  value={entry.ledgerid}
                  onChange={(e) => handleEntryChange(index, "ledgerid", e.target.value)}
                  options={ledgerList.map(l => ({
                    label: l.ledgername,
                    value: l.id
                  }))}
                  placeholder="Select ledger"
                  searchable
                />)}
                {isFieldEnabled("debit") && (<FormField
                  label="Debit"
                  name={`debit-${index}`}
                  type="number"
                  value={entry.debit}
                  onChange={(e) => handleEntryChange(index, "debit", e.target.value)}
                />)}
                {isFieldEnabled("credit") && (<FormField
                  label="Credit"
                  name={`credit-${index}`}
                  type="number"
                  value={entry.credit}
                  onChange={(e) => handleEntryChange(index, "credit", e.target.value)}
                />)}
                {isFieldEnabled("remarks") && (<FormField
                  label="Remarks"
                  name={`remarks-${index}`}
                  value={entry.remarks}
                  onChange={(e) => handleEntryChange(index, "remarks", e.target.value)}
                  placeholder="Optional"
                />)}
                <div
                    onClick={() => removeEntryRow(index)}
                    className="flex items-center justify-center w-9 h-9 border border-red-500 text-red-500 rounded cursor-pointer hover:bg-red-500 hover:text-white"
                    >
                    <FaTrash className="w-4 h-4" />
                </div>
              </div>
            ))}
            {isFieldEnabled("add_entry_button") && (<Button variant="outline" onClick={addEntryRow}>
              ➕ Add Entry
            </Button>)}
            {formErrors.entries && (
              <p className="text-red-500 text-sm mt-2">{formErrors.entries}</p>
            )}
          </fieldset>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/transactions")}>Cancel</Button>
            <Button variant="outline" onClick={handleSubmit}>{isEdit ? "Update Transaction" : "Add Transaction"}</Button>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditTransaction;
