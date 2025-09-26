import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import { FaCalendarAlt, FaFileAlt } from "react-icons/fa";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { usePaymentMutations, usePaymentByIDQuery } from "../../../graphql/hooks/payments";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";

const AddEditPayment = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);

  const { data: existingData } = usePaymentByIDQuery(id || "");
  const { data: accountsData } = useAccountsQuery();

  const [formValues, setFormValues] = useState({
    paymentdate: new Date().toISOString().slice(0, 10),
    type: "payment",
    mode: "cash",
    partyid: "",
    amount: "",
    reference: "",
    remarks: "",
    status: true,
    adminid: adminId || "",
    branchid: branchId || "",
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const { addPaymentMutation, editPaymentMutation } = usePaymentMutations();

  useEffect(() => {
    if (isEdit && existingData?.getPaymentById) {
      const p = existingData.getPaymentById;
      setFormValues({
        paymentdate: formatDate(p.paymentdate) || "",
        type: p.type || "payment",
        mode: p.mode || "cash",
        partyid: typeof p.partyid === "string"
          ? p.partyid
          : p.partyid?.id || p.partyid?._id || "",
        amount: p.amount !== undefined && p.amount !== null ? p.amount : "", 
        reference: p.reference || "",
        remarks: p.remarks || "",
        status: p.status ?? true,
        adminid: p.adminid?.id || p.adminid?._id || adminId,
        branchid: p.branchid?.id || p.branchid?._id || branchId,
      });
    }
  }, [isEdit, existingData]);

  const formatDate = (date: any) => {
    if (!date) return new Date().toISOString().slice(0, 10);
    const ts = Number(date);
    if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
    return new Date(date).toISOString().slice(0, 10);
  };

  const handleChange = (name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errors: { [key: string]: string } = {};

    if (!formValues.partyid) {
      errors.partyid = "Select a party account";
    }

    const amount = parseFloat(formValues.amount as any); // convert string to number
    if (isNaN(amount) || amount <= 0) {
      errors.amount = "Enter a valid amount";
    }

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
      amount: parseFloat(String(formValues.amount)),
    };

    try {
      if (isEdit) {
        await editPaymentMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Payment updated successfully", type: "success" }));
      } else {
        await addPaymentMutation({ variables: { input } });
        dispatch(showMessage({ message: "Payment added successfully", type: "success" }));
      }
      navigate("/payments");
    } catch (error) {
      dispatch(showMessage({ message: "Error saving payment", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 text-sm sm:text-base">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
          {isEdit ? "Edit Payment" : "Add Payment"}
        </h2>

        <fieldset className="border rounded-xl p-4">
          <legend className="text-sm sm:text-base font-medium px-2">Payment Info</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <FormField
              label="Payment Date"
              name="paymentdate"
              type="date"
              value={formValues.paymentdate}
              onChange={(e) => handleChange("paymentdate", e.target.value)}
              icon={<FaCalendarAlt />}
            />

            <FormField
              label="Type"
              name="type"
              type="select"
              value={formValues.type}
              onChange={(e) => handleChange("type", e.target.value)}
              options={[
                { label: "Payment", value: "payment" },
                { label: "Receipt", value: "receipt" },
              ]}
            />

            <FormField
              label="Mode"
              name="mode"
              type="select"
              value={formValues.mode}
              onChange={(e) => handleChange("mode", e.target.value)}
              options={[
                { label: "Cash", value: "cash" },
                { label: "Bank", value: "bank" },
                { label: "UPI", value: "upi" },
                { label: "Card", value: "card" },
                { label: "Cheque", value: "cheque" },
                { label: "Other", value: "other" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <FormField
              label="Party Account"
              name="partyid"
              type="select"
              value={formValues.partyid}
              onChange={(e) => handleChange("partyid", e.target.value)}
              options={accountsData?.getAccounts?.map(acc => ({ label: acc.name, value: acc.id })) || []}
              placeholder="Select party"
              searchable
            />

            <FormField
              label="Amount"
              name="amount"
              type="number"
              value={formValues.amount}
              onChange={(e) => handleChange("amount", e.target.value)}
            />

            <FormField
              label="Reference"
              name="reference"
              value={formValues.reference}
              onChange={(e) => handleChange("reference", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <FormField
            label="Remarks"
            name="remarks"
            value={formValues.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
            placeholder="Optional"
          />

          <FormSwitch
            label="Status"
            name="status"
            checked={formValues.status}
            onChange={(val) => handleChange("status", val)}
          />
        </fieldset>

        <div className="flex justify-end gap-4 mt-4">
          <Button variant="outline" onClick={() => navigate("/payments")}>Cancel</Button>
          <Button variant="outline" onClick={handleSubmit}>{isEdit ? "Update Payment" : "Add Payment"}</Button>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditPayment;
