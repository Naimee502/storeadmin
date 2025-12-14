import { useState, useEffect } from "react";
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
} from "../../../graphql/hooks/expensenote";

import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";

const AddEditExpenseNote = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? branch?.admin?.id
      : undefined;

  const branchId = useAppSelector(
    (state) => state.selectedBranch.branchId
  );

  const { data: existingData } = useExpenseNoteByIDQuery(id || "");
  const { data: ledgerData } = useAccountLedgersQuery();

  const ledgerList = ledgerData?.getAccountLedgers || [];

  const [formValues, setFormValues] = useState({
    expensedate: new Date().toISOString().slice(0, 10),
    paymenttype: "cash",
    ledgerid: "",
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

    // Handle timestamp string or number
    const timestamp =
      typeof date === "string" && /^\d+$/.test(date)
        ? Number(date)
        : date;

    const d = new Date(timestamp);

    if (isNaN(d.getTime())) {
      console.warn("Invalid date received:", date);
      return "";
    }

    return d.toISOString().slice(0, 10); // yyyy-mm-dd (HTML date input)
  };


  /* =========================
     HANDLERS
     ========================= */

  const handleChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
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

  /* =========================
     VALIDATION
     ========================= */

  const validate = () => {
    const errors: { [key: string]: string } = {};

    if (!formValues.paymenttype)
      errors.paymenttype = "Payment type required";

    if (
      formValues.expenses.some(
        (e) => !e.expenseledgerid || !e.amount
      )
    ) {
      errors.expenses = "All expense rows must be complete";
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
      return;
    }

    const input = {
      ...formValues,
      expenses: formValues.expenses.map((e) => ({
        expenseledgerid: e.expenseledgerid,
        amount: Number(e.amount),
        gstpercent: Number(e.gstpercent || 0),
        remarks: e.remarks,
      })),
    };

    try {
      if (isEdit) {
        await editExpenseNoteMutation({
          variables: { id, input },
        });
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
    } catch (err) {
      dispatch(
        showMessage({
          message: "Error saving expense note",
          type: "error",
        })
      );
    }
  };

  /* =========================
     UI
     ========================= */

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
              onChange={(e) =>
                handleChange("expensedate", e.target.value)
              }
              icon={<FaCalendarAlt />}
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
                label="Paid To / Party Ledger"
                type="select"
                name="ledgerid"
                value={formValues.ledgerid}
                onChange={(e) => handleChange("ledgerid", e.target.value)}
                options={ledgerList.map((l) => ({
                    label: l.ledgername,
                    value: l.id,
                }))}
                searchable
            />

            <FormField
              label="Payment Type"
              type="select"
              name="paymenttype"
              value={formValues.paymenttype}
              onChange={(e) =>
                handleChange("paymenttype", e.target.value)
              }
              options={[
                { label: "Cash", value: "cash" },
                { label: "Bank", value: "bank" },
                { label: "Credit", value: "credit" },
              ]}
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
                  handleExpenseChange(
                    i,
                    "expenseledgerid",
                    ev.target.value
                  )
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
          <Button
            variant="outline"
            onClick={() => navigate("/expensenote")}
          >
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
