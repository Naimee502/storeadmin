// Add / Edit an Expense Note (voucher).
//
// Tally-style multi-line journal voucher with three smart presets:
//   - "general" — ad-hoc expenses (existing behaviour)
//   - "tada"    — Travelling/Daily Allowance for a salesman or staff
//   - "salary"  — monthly salary entry for a staff member
//
// When the user picks "tada" or "salary":
//   1. We lazy-fetch (and create-if-missing) the canonical expense ledger
//      ("TA/DA Expense" or "Staff Salary") and pin it into line 1.
//   2. A staff selector appears. Selecting a staff:
//        - For salary: pre-fills line 1 amount from staff.salary
//        - For credit payment type: pins the staff's personal ledger as
//          the party ledger (the credit side of the voucher).
//   3. A salary-period field shows up for category=salary so the server
//      can prevent paying the same staff twice for the same month.

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import { FaCalendarAlt, FaFileAlt, FaTrash } from "react-icons/fa";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

import {
  useExpenseNoteMutations,
  useExpenseNoteByIDQuery,
  useExpenseCategoryLedgerLazy,
} from "../../../graphql/hooks/expensenote";

import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";

const CATEGORY_OPTIONS = [
  { label: "General Expense", value: "general" },
  { label: "TA / DA (Salesman/Staff travel)", value: "tada" },
  { label: "Salary", value: "salary" },
  { label: "Other", value: "other" },
];

const monthYear = (d: Date = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};

const AddEditExpenseNote = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);

  const adminId = admin?.id;

  const creatorName =
    type === "admin" ? admin?.name :
    type === "branch" ? branch?.branchname || branch?.name :
    type === "staff" ? staff?.name : undefined;

  const branchId = useAppSelector(
    (state) => state.selectedBranch.branchId
  );

  const { data: existingData } = useExpenseNoteByIDQuery(id || "");
  const { data: ledgerData } = useAccountLedgersQuery();
  const { data: staffData } = useStaffQuery();
  const [fetchCategoryLedger] = useExpenseCategoryLedgerLazy();

  const ledgerList = ledgerData?.getAccountLedgers || [];
  const staffList = staffData?.getStaffAccounts || [];

  // For TA/DA, restrict the staff dropdown to roles that travel; for
  // salary, every staff role is paid. Pure cosmetic — server doesn't enforce.
  const filteredStaffOptions = useMemo(
    () => (category: string) => {
      const filtered =
        category === "tada"
          ? staffList.filter((s: any) =>
              ["salesman", "deliveryboy", "staff"].includes(s.role)
            )
          : staffList;
      return filtered.map((s: any) => ({
        label: `${s.name} (${s.staffcode}) · ${s.role}`,
        value: s.id,
      }));
    },
    [staffList]
  );

  const [formValues, setFormValues] = useState({
    expensedate: new Date().toISOString().slice(0, 10),
    paymenttype: "cash",
    ledgerid: "",            // party ledger (credit side, for "credit" paymenttype)
    category: "general",     // general | tada | salary | other
    staffid: "",             // selected staff member id (for tada/salary)
    salaryPeriod: monthYear(), // YYYY-MM (only used when category=salary)
    narration: "",
    notes: "",
    expenses: [
      { expenseledgerid: "", amount: "", gstpercent: "", remarks: "" },
    ],
    totalamount: 0,
    totalgst: 0,
    status: true,
    adminid: adminId || "",
    branchid: branchId || "",
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const {
    addExpenseNoteMutation,
    editExpenseNoteMutation,
  } = useExpenseNoteMutations();

  // Keep the (new) voucher's branch in sync if the admin switches branches
  // in the header dropdown while this page is open — otherwise formValues
  // would keep whatever branchid was set on mount (possibly "" for "All
  // Branches", which the server rejects).
  useEffect(() => {
    if (!isEdit) {
      setFormValues((prev) => ({ ...prev, branchid: branchId || "" }));
    }
  }, [branchId, isEdit]);

  /* =========================
     LOAD EDIT DATA
     ========================= */

  useEffect(() => {
    if (isEdit && existingData?.getExpenseNoteById) {
      const e = existingData.getExpenseNoteById;

      setFormValues({
        expensedate: formatDate(e.expensedate),
        paymenttype: e.paymenttype,
        ledgerid: e.ledgerid?.id || "",
        category: e.category || "general",
        staffid: e.staffid?.id || "",
        salaryPeriod: e.salaryPeriod || monthYear(),
        narration: e.narration || "",
        notes: e.notes || "",
        expenses:
          e.expenses?.map((x: any) => ({
            expenseledgerid: x.expenseledgerid.id,
            amount: x.amount,
            gstpercent: x.gstpercent || "",
            remarks: x.remarks || "",
          })) || [],
        totalamount: e.totalamount,
        totalgst: e.totalgst || 0,
        status: e.status ?? true,
        adminid: e.adminid,
        branchid: e.branchid,
      });
    }
  }, [isEdit, existingData]);

  const formatDate = (date: any) => {
    if (!date) return "";
    const timestamp =
      typeof date === "string" && /^\d+$/.test(date) ? Number(date) : date;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  /* =========================
     HANDLERS
     ========================= */

  const handleChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // When the user picks TA/DA or Salary, fetch (and lazily create) the
  // canonical expense ledger and pin it as the first expense line. We only
  // touch line 1 — additional lines stay untouched if the user added them.
  const handleCategoryChange = async (category: string) => {
    setFormValues((prev) => ({
      ...prev,
      category,
      staffid: "",          // reset selection when category flips
    }));

    if (category === "tada" || category === "salary") {
      try {
        const { data } = await fetchCategoryLedger({
          variables: { adminid: adminId, category },
        });
        const ledger = data?.getExpenseCategoryLedger;
        if (ledger?.id) {
          setFormValues((prev) => {
            const next = { ...prev };
            next.expenses = [...next.expenses];
            // Replace line-1 ledger; create line-1 if list empty
            if (!next.expenses.length) {
              next.expenses.push({
                expenseledgerid: ledger.id,
                amount: "",
                gstpercent: "",
                remarks: "",
              });
            } else {
              next.expenses[0] = {
                ...next.expenses[0],
                expenseledgerid: ledger.id,
              };
            }
            return next;
          });
        }
      } catch (err) {
        console.error("Failed to fetch category ledger", err);
      }
    }
  };

  // Selecting a staff member for TA/DA or Salary triggers smart fills.
  const handleStaffChange = (staffid: string) => {
    const staff = staffList.find((s: any) => s.id === staffid);
    setFormValues((prev) => {
      const next = { ...prev, staffid };

      // For credit payments, pin the staff's personal ledger as the
      // party (credit-side) ledger. Cash/bank doesn't need this.
      if (next.paymenttype === "credit" && staff?.ledgerid?.id) {
        next.ledgerid = staff.ledgerid.id;
      }

      // For salary, prefill amount on line 1 from staff's configured salary.
      if (next.category === "salary" && staff?.salary && next.expenses.length) {
        next.expenses = [...next.expenses];
        next.expenses[0] = {
          ...next.expenses[0],
          amount: staff.salary,
          remarks:
            next.expenses[0].remarks ||
            `Salary for ${staff.name} - ${next.salaryPeriod}`,
        };
        // Recompute totals after the prefill
        recomputeTotals(next);
      } else if (next.category === "tada" && staff && next.expenses.length) {
        next.expenses = [...next.expenses];
        next.expenses[0] = {
          ...next.expenses[0],
          remarks:
            next.expenses[0].remarks || `TA/DA for ${staff.name}`,
        };
      }

      return next;
    });
  };

  const handleExpenseChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const updated = [...formValues.expenses];
    updated[index][field] = value;
    setFormValues((prev) => ({ ...prev, expenses: updated }));
    calculateTotals(updated);
  };

  const addExpenseRow = () => {
    setFormValues((prev) => ({
      ...prev,
      expenses: [
        ...prev.expenses,
        { expenseledgerid: "", amount: "", gstpercent: "", remarks: "" },
      ],
    }));
  };

  const removeExpenseRow = (index: number) => {
    const updated = formValues.expenses.filter((_, i) => i !== index);
    setFormValues((prev) => ({ ...prev, expenses: updated }));
    calculateTotals(updated);
  };

  /* =========================
     TOTAL CALCULATION
     ========================= */

  const calculateTotals = (rows: any[]) => {
    let total = 0;
    let gst = 0;

    rows.forEach((r) => {
      const amt = Number(r.amount || 0);
      const gstp = Number(r.gstpercent || 0);
      total += amt;
      gst += (amt * gstp) / 100;
    });

    setFormValues((prev) => ({
      ...prev,
      totalamount: total + gst,
      totalgst: gst,
    }));
  };

  // Mutates `obj.totalamount` / `obj.totalgst` in place. Used inside
  // `setFormValues` callbacks where we already hold a fresh draft.
  const recomputeTotals = (obj: any) => {
    let total = 0;
    let gst = 0;
    obj.expenses.forEach((r: any) => {
      const amt = Number(r.amount || 0);
      const gstp = Number(r.gstpercent || 0);
      total += amt;
      gst += (amt * gstp) / 100;
    });
    obj.totalamount = total + gst;
    obj.totalgst = gst;
  };

  /* =========================
     VALIDATION
     ========================= */

  const validate = () => {
    const errors: { [key: string]: string } = {};

    // The header's branch dropdown includes "All Branches" (value "") for
    // filtering lists — but an Expense Note must belong to one real branch
    // (server requires it). Catch that here instead of letting an empty
    // string reach the server as a raw ObjectId cast error.
    if (!formValues.branchid) {
      errors.branchid =
        "Select a specific branch from the dropdown in the top-right (not \"All Branches\") before adding an expense.";
    }

    if (!formValues.paymenttype) errors.paymenttype = "Payment type required";

    if (!formValues.ledgerid) {
      errors.ledgerid =
        formValues.paymenttype === "credit"
          ? "Party ledger required for credit expense"
          : "Payment account ledger is required";
    }

    if (
      (formValues.category === "tada" || formValues.category === "salary") &&
      !formValues.staffid
    ) {
      errors.staffid = "Select a staff member";
    }

    if (formValues.category === "salary" && !formValues.salaryPeriod) {
      errors.salaryPeriod = "Salary period (YYYY-MM) required";
    }

    if (
      formValues.expenses.some((e) => !e.expenseledgerid || !e.amount)
    ) {
      errors.expenses = "All expense rows must have a ledger and amount";
    }

    return errors;
  };

  /* =========================
     SUBMIT
     ========================= */

  const handleSubmit = async () => {
    const errors = validate();
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      dispatch(
        showMessage({
          // branchid has no dedicated field on this form (it comes from the
          // header dropdown), so surface its message directly rather than
          // the generic "fix highlighted fields" — there's nothing on this
          // screen for the user to see highlighted.
          message: errors.branchid || "Please fix highlighted fields",
          type: "error",
        })
      );
      return;
    }

    const input = {
      adminid: formValues.adminid,
      branchid: formValues.branchid,
      createdby_id: admin?.id || branch?.id || staff?.id,
      createdby_name: creatorName,
      createdby_type: type || 'admin',
      expensedate: formValues.expensedate,
      paymenttype: formValues.paymenttype,
      ledgerid: formValues.ledgerid || undefined,
      category: formValues.category,
      staffid: formValues.staffid || undefined,
      salaryPeriod:
        formValues.category === "salary" ? formValues.salaryPeriod : undefined,
      narration: formValues.narration,
      notes: formValues.notes,
      totalamount: formValues.totalamount,
      totalgst: formValues.totalgst,
      status: formValues.status,
      expenses: formValues.expenses.map((e) => ({
        expenseledgerid: e.expenseledgerid,
        amount: Number(e.amount),
        gstpercent: Number(e.gstpercent || 0),
        remarks: e.remarks,
      })),
    };

    try {
      if (isEdit) {
        await editExpenseNoteMutation({ variables: { id, input } });
        dispatch(
          showMessage({
            message: "Expense note updated successfully",
            type: "success",
          })
        );
      } else {
        await addExpenseNoteMutation({ variables: { input } });
        dispatch(
          showMessage({
            message: "Expense note added successfully",
            type: "success",
          })
        );
      }
      navigate("/expensenote");
    } catch (err: any) {
      dispatch(
        showMessage({
          message: err?.message || "Error saving expense note",
          type: "error",
        })
      );
    }
  };

  /* =========================
     UI
     ========================= */

  const showStaff =
    formValues.category === "tada" || formValues.category === "salary";
  const showSalaryPeriod = formValues.category === "salary";

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h2 className="text-xl font-bold mb-6">
          {isEdit ? "Edit Expense Note" : "Add Expense Note"}
        </h2>

        {/* BASIC INFO */}
        <fieldset className="border rounded-xl p-4 mb-6">
          <legend className="font-medium px-2">Expense Info</legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Date"
              type="date"
              name="expensedate"
              value={formValues.expensedate}
              onChange={(e) => handleChange("expensedate", e.target.value)}
              icon={<FaCalendarAlt />}
            />

            <FormField
              label="Category"
              type="select"
              name="category"
              value={formValues.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              options={CATEGORY_OPTIONS}
            />

            <FormField
              label="Payment Type"
              type="select"
              name="paymenttype"
              value={formValues.paymenttype}
              onChange={(e) => handleChange("paymenttype", e.target.value)}
              options={[
                { label: "Cash", value: "cash" },
                { label: "Bank", value: "bank" },
                { label: "Credit", value: "credit" },
                { label: "UPI", value: "upi" },
                { label: "Card", value: "card" },
                { label: "Cheque", value: "cheque" },
                { label: "Other", value: "other" },
              ]}
            />

            {showStaff && (
              <FormField
                label={
                  formValues.category === "salary"
                    ? "Staff (whose salary)"
                    : "Staff / Salesman"
                }
                type="select"
                name="staffid"
                value={formValues.staffid}
                onChange={(e) => handleStaffChange(e.target.value)}
                options={filteredStaffOptions(formValues.category)}
                searchable
                required
                error={formErrors.staffid}
              />
            )}

            {showSalaryPeriod && (
              <FormField
                label="Salary Period (YYYY-MM)"
                name="salaryPeriod"
                value={formValues.salaryPeriod}
                onChange={(e) => handleChange("salaryPeriod", e.target.value)}
                placeholder="2026-05"
                required
                error={formErrors.salaryPeriod}
              />
            )}

            <FormField
              label={
                formValues.paymenttype === "credit"
                  ? "Party Ledger (Payable)"
                  : "Payment Account Ledger"
              }
              type="select"
              name="ledgerid"
              value={formValues.ledgerid}
              onChange={(e) => handleChange("ledgerid", e.target.value)}
              options={ledgerList.map((l) => ({
                label: l.ledgername,
                value: l.id,
              }))}
              searchable
              required
              error={formErrors.ledgerid}
            />

            <FormField
              label="Narration"
              name="narration"
              value={formValues.narration}
              onChange={(e) => handleChange("narration", e.target.value)}
              icon={<FaFileAlt />}
              placeholder="Enter narration"
            />

            <FormField
              label="Notes"
              name="notes"
              value={formValues.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              icon={<FaFileAlt />}
              placeholder="Enter notes"
            />

            <FormSwitch
              label="Status"
              name="status"
              checked={formValues.status}
              onChange={(val) => handleChange("status", val)}
            />
          </div>

          {showStaff && formValues.staffid && (
            <div className="mt-3 text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded p-2">
              {formValues.category === "salary"
                ? "Salary amount auto-filled from staff record. The salary period prevents the same staff from being paid twice for the same month."
                : "TA/DA expense: amount is per-trip. For credit payment, the staff's personal ledger is the credit side and gets cleared via a Payment voucher later."}
            </div>
          )}
        </fieldset>

        {/* EXPENSES */}
        <fieldset className="border rounded-xl p-4 mb-6">
          <legend className="font-medium px-2">Expenses</legend>

          {formValues.expenses.map((e, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-3"
            >
              <FormField
                label="Ledger"
                type="select"
                name={`expenseledgerid-${i}`}
                value={e.expenseledgerid}
                onChange={(ev) =>
                  handleExpenseChange(i, "expenseledgerid", ev.target.value)
                }
                options={ledgerList.map((l) => ({
                  label: l.ledgername,
                  value: l.id,
                }))}
                searchable
              />

              <FormField
                label="Amount"
                type="number"
                name={`amount-${i}`}
                value={e.amount}
                onChange={(ev) =>
                  handleExpenseChange(i, "amount", ev.target.value)
                }
              />

              <FormField
                label="GST %"
                type="number"
                name={`gstpercent-${i}`}
                value={e.gstpercent}
                onChange={(ev) =>
                  handleExpenseChange(i, "gstpercent", ev.target.value)
                }
              />

              <FormField
                label="Remarks"
                value={e.remarks}
                name={`remarks-${i}`}
                onChange={(ev) =>
                  handleExpenseChange(i, "remarks", ev.target.value)
                }
              />

              <div
                onClick={() => removeExpenseRow(i)}
                className="w-9 h-9 flex items-center justify-center border border-red-500 text-red-500 rounded cursor-pointer hover:bg-red-500 hover:text-white"
              >
                <FaTrash />
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addExpenseRow}>
            ➕ Add Expense
          </Button>

          {formErrors.expenses && (
            <p className="text-red-500 mt-2">{formErrors.expenses}</p>
          )}
        </fieldset>

        {/* TOTALS */}
        <div className="flex justify-end gap-6 mb-6">
          <div>GST: ₹ {formValues.totalgst.toFixed(2)}</div>
          <div className="font-bold">
            Total: ₹ {formValues.totalamount.toFixed(2)}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate("/expensenote")}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSubmit}>
            {isEdit ? "Update Expense" : "Add Expense"}
          </Button>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditExpenseNote;
