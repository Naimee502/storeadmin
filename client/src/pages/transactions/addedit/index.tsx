import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import { FaCalendarAlt, FaFileAlt, FaTrash } from "react-icons/fa";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useTransactionMutations, useTransactionByIDQuery } from "../../../graphql/hooks/transactions";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";


const AddEditTransaction = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId = admin?.id;
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);

  const { data: existingData } = useTransactionByIDQuery(id || "");
  const { data: ledgerData } = useAccountLedgersQuery();
  const ledgerList = ledgerData?.getAccountLedgers || [];

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
    };

    console.log("Submitting Transaction Input:", JSON.stringify(input, null, 2));

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
            <FormField
            label="Date"
            name="transactiondate"
            type="date"
            value={formValues.transactiondate}
            onChange={(e) => handleChange("transactiondate", e.target.value)}
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
              label="Entry Type"
              name="entrytype"
              type="select"
              value={formValues.entrytype}
              onChange={(e) => handleChange("entrytype", e.target.value)}
              options={[
                { label: "Manual", value: "manual" },
                { label: "Auto", value: "auto" },
              ]}
            />

            <FormSwitch
            label="Status"
            name="status"
            checked={formValues.status}
            onChange={(val) => handleChange("status", val)}
            />
        </div>
        </fieldset>


          {/* Entries */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Entries</legend>
            {formValues.entries.map((entry, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-3">
                <FormField
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
                />
                <FormField
                  label="Debit"
                  name={`debit-${index}`}
                  type="number"
                  value={entry.debit}
                  onChange={(e) => handleEntryChange(index, "debit", e.target.value)}
                />
                <FormField
                  label="Credit"
                  name={`credit-${index}`}
                  type="number"
                  value={entry.credit}
                  onChange={(e) => handleEntryChange(index, "credit", e.target.value)}
                />
                <FormField
                  label="Remarks"
                  name={`remarks-${index}`}
                  value={entry.remarks}
                  onChange={(e) => handleEntryChange(index, "remarks", e.target.value)}
                  placeholder="Optional"
                />
                <div
                    onClick={() => removeEntryRow(index)}
                    className="flex items-center justify-center w-9 h-9 border border-red-500 text-red-500 rounded cursor-pointer hover:bg-red-500 hover:text-white"
                    >
                    <FaTrash className="w-4 h-4" />
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addEntryRow}>
              ➕ Add Entry
            </Button>
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
