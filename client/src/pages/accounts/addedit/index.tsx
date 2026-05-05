import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import {
  FaUser, FaMobileAlt, FaEnvelope, FaLocationArrow, FaCity,
  FaMoneyCheckAlt, FaRupeeSign,
  FaUniversity
} from "react-icons/fa";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useAccountMutations, useAccountByIDQuery, useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import { useAccountGroupsQuery } from "../../../graphql/hooks/accountgroups";
import { useChannelsQuery } from "../../../graphql/hooks/channels";
import { regionOptions } from "../../../utils/constants";

const AddEditAccount = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { type, admin, branch } = useAppSelector((state: any) => state.auth);
  const adminId = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;
  const branchId = useAppSelector((state: any) => state.selectedBranch.branchId);

  const { data: existingData } = useAccountByIDQuery(id || "");
  const { data: accountGroupData } = useAccountGroupsQuery();
  const { data: ledgersData } = useAccountLedgersQuery();
  const { data: assignAccountData } = useAccountsQuery();
  const { data: staffData } = useStaffQuery();
  const { data: channelData } = useChannelsQuery(adminId);

  const [formValues, setFormValues] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    gstnumber: "",
    pan: "",
    openingbalance: "",
    openingbalancetype: "debit",
    creditlimit: "",
    bankname: "",
    bankaccountnumber: "",
    ifsc: "",
    upiid: "",
    billingcycle: "monthly",
    duedays: "",
    type: "customer",
    status: true,
    accountgroupid: "",
    assignaccountid: "",
    salesmanid: "",
    admin: adminId || "",
    branchid: null,
    channel: "",
    region: "default",
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const { addAccountMutation, editAccountMutation } = useAccountMutations();

  useEffect(() => {
    if (isEdit && existingData?.getAccountById) {
      const a = existingData.getAccountById;
      setFormValues({
        name: a.name || "",
        mobile: a.mobile || "",
        email: a.email || "",
        address: a.address || "",
        city: a.city || "",
        state: a.state || "",
        country: a.country || "India",
        pincode: a.pincode || "",
        gstnumber: a.gstnumber || "",
        pan: a.pan || "",
        openingbalance: a.openingbalance || "",
        openingbalancetype: a.openingbalancetype || "debit",
        creditlimit: a.creditlimit || "",
        bankname: a.bankname || "",
        bankaccountnumber: a.bankaccountnumber || "",
        ifsc: a.ifsc || "",
        upiid: a.upiid || "",
        billingcycle: a.billingcycle || "monthly",
        duedays: a.duedays || "",
        type: a.type || "customer",
        status: a.status ?? true,
        accountgroupid: a.accountgroupid?.id || "",
        assignaccountid: a.assignaccountid?.id || "",
        salesmanid: a.salesmanid?.id || "",
        admin: a.admin?.id || adminId || "",
        branchid: null,
        channel: a.channel?.id || "",
        region: a.region || "default",
      });
    }
  }, [isEdit, existingData]);



  const handleChange = (name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errors: { [key: string]: string } = {};
    if (!formValues.name.trim()) errors.name = "Name is required";
    if (!formValues.mobile.trim()) errors.mobile = "Mobile is required";
    if (!formValues.accountgroupid) errors.accountgroupid = "Account group required";
    if (!formValues.state) errors.state = "State is required";
    // Financial validations
    if (formValues.openingbalance === "" || formValues.openingbalance === null) {
      errors.openingbalance = "Opening balance is required";
    } else if (isNaN(Number(formValues.openingbalance)) || Number(formValues.openingbalance) < 0) {
      errors.openingbalance = "Opening balance must be a valid number";
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
      name: formValues.name,
      mobile: formValues.mobile,
      email: formValues.email,
      address: formValues.address,
      city: formValues.city,
      state: formValues.state,
      country: formValues.country,
      pincode: formValues.pincode,
      gstnumber: formValues.gstnumber,
      pan: formValues.pan,
      openingbalance: Number(formValues.openingbalance) || 0,
      openingbalancetype: formValues.openingbalancetype,
      creditlimit: Number(formValues.creditlimit) || 0,
      bankname: formValues.bankname,
      bankaccountnumber: formValues.bankaccountnumber,
      ifsc: formValues.ifsc,
      upiid: formValues.upiid,
      billingcycle: formValues.billingcycle,
      duedays: Number(formValues.duedays) || 0,
      type: formValues.type,
      status: formValues.status,
      accountgroupid: formValues.accountgroupid,
      assignaccountid: formValues.assignaccountid || null,
      salesmanid: formValues.salesmanid || null,
      admin: formValues.admin,
      branchid: formValues.branchid || null,
      channel: formValues.channel || null,
      region: formValues.region || "default",
    };

    console.log("Submitting Input:", JSON.stringify(input));

    try {
      if (isEdit) {
        await editAccountMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Account updated successfully", type: "success" }));
      } else {
        await addAccountMutation({ variables: { input } });
        dispatch(showMessage({ message: "Account added successfully", type: "success" }));
      }
      navigate("/accounts");
    } catch (error) {
      dispatch(showMessage({ message: "Error saving account", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 text-sm sm:text-base">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
          {isEdit ? "Edit Account" : "Add Account"}
        </h2>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Info */}
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm sm:text-base font-medium px-2">Account Info</legend>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <FormField label="Name" name="name" value={formValues.name} onChange={(e) => handleChange("name", e.target.value)} icon={<FaUser />} error={formErrors.name} placeholder="Enter full name" />
                <FormField label="Mobile" name="mobile" value={formValues.mobile} onChange={(e) => handleChange("mobile", e.target.value)} icon={<FaMobileAlt />} error={formErrors.mobile} placeholder="Enter mobile number" />
                <FormField label="Email" name="email" type="email" value={formValues.email} onChange={(e) => handleChange("email", e.target.value)} icon={<FaEnvelope />} placeholder="Enter email address" />
                <FormField
                  label="Account Group"
                  name="accountgroupid"
                  type="select"
                  value={formValues.accountgroupid}
                  onChange={(e) => handleChange("accountgroupid", e.target.value)}
                  options={
                    accountGroupData?.getAccountGroups?.map((l) => ({
                      label: l.accountgroupname,
                      value: l.id,   
                    })) || []
                  }
                  error={formErrors.accountgroupid}
                  placeholder="Select Account Group"
                  searchable
                />
                <FormField label="Type" name="type" type="select" value={formValues.type} onChange={(e) => handleChange("type", e.target.value)} options={[{ label: "Customer", value: "customer" }, { label: "Vendor", value: "vendor" }, { label: "Expense", value: "expense" }, { label: "Bank", value: "bank" }, { label: "Other", value: "other" }]} placeholder="Select type" />
                <FormField
                  label="Channel"
                  name="channel"
                  type="select"
                  value={formValues.channel}
                  onChange={(e) => handleChange("channel", e.target.value)}
                  options={channelData?.getChannels?.map((c: any) => ({ label: c.channelName, value: c.id })) || []}
                  placeholder="Select Channel"
                  searchable
                />
                <FormField
                  label="Region / Price Group"
                  name="region"
                  type="select"
                  value={formValues.region}
                  onChange={(e) => handleChange("region", e.target.value)}
                  options={regionOptions}
                  placeholder="Select Region"
                  searchable
                />
                {admin?.isChannelCustomers && (
                  <>
                    <FormField
                      label="Assign Customer"
                      name="assignaccountid"
                      type="select"
                      value={formValues.assignaccountid}
                      onChange={(e) => handleChange("assignaccountid", e.target.value)}
                      options={
                        assignAccountData?.getAccounts
                          ?.filter(acc => acc.id !== id) // optional: avoid self-reference
                          ?.map(acc => ({ label: acc.name, value: acc.id })) || []
                      }
                      placeholder="Select Assign Customer"
                      searchable
                    />

                   <FormField
                    label="Salesman"
                    name="salesmanid"
                    type="select"
                    value={formValues.salesmanid}
                    onChange={(e) => handleChange("salesmanid", e.target.value)}
                    options={
                      staffData?.getStaffAccounts
                        ?.filter((staff: any) => staff.role?.toLowerCase() === "salesman") // ✅ Only Salesman
                        ?.map((staff: any) => ({
                          label: staff.name,
                          value: staff.id,
                        })) || []
                    }
                    placeholder="Select Salesman"
                    searchable
                  />
                  </>
                )}
              </div>
            </fieldset>

            {/* Address Info */}
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm sm:text-base font-medium px-2">Address Info</legend>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <FormField label="Address" name="address" value={formValues.address} onChange={(e) => handleChange("address", e.target.value)} icon={<FaLocationArrow />} placeholder="Enter address" />
                <FormField label="City" name="city" value={formValues.city} onChange={(e) => handleChange("city", e.target.value)} icon={<FaCity />} placeholder="Enter city" />
                <FormField
                  label="State"
                  name="state"
                  type="select"                     // make it a dropdown
                  options={regionOptions}           // use the same enum array
                  value={formValues.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  placeholder="Select state"
                  error={formErrors.state}
                />
                <FormField label="Country" name="country" value={formValues.country} onChange={(e) => handleChange("country", e.target.value)} placeholder="Enter country" />
                <FormField label="Pincode" name="pincode" value={formValues.pincode} onChange={(e) => handleChange("pincode", e.target.value)} placeholder="Enter pincode" />
              </div>
            </fieldset>

            {/* Financial Info */}
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm sm:text-base font-medium px-2">Financial Info</legend>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <FormField label="Opening Balance" name="openingbalance" type="number" value={formValues.openingbalance} onChange={(e) => handleChange("openingbalance", e.target.value === "" ? "" : parseFloat(e.target.value))} icon={<FaRupeeSign />} placeholder="Enter opening balance" error={formErrors.openingbalance}/>
                <FormField label="Balance Type" name="openingbalancetype" type="select" value={formValues.openingbalancetype} onChange={(e) => handleChange("openingbalancetype", e.target.value)} options={[{ label: "Debit", value: "debit" }, { label: "Credit", value: "credit" }]} placeholder="Select balance type" />
                <FormField label="Credit Limit" name="creditlimit" type="number" value={formValues.creditlimit} onChange={(e) => handleChange("creditlimit", e.target.value === "" ? "" : parseFloat(e.target.value))} icon={<FaRupeeSign />} placeholder="Enter credit limit" />
                <FormField label="GST Number" name="gstnumber" value={formValues.gstnumber} onChange={(e) => handleChange("gstnumber", e.target.value)} placeholder="Enter GST number" />
                <FormField label="PAN" name="pan" value={formValues.pan} onChange={(e) => handleChange("pan", e.target.value)} placeholder="Enter PAN" />
              </div>
            </fieldset>

            {/* Bank Info */}
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm sm:text-base font-medium px-2">Bank Info</legend>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <FormField label="Bank Name" name="bankname" value={formValues.bankname} onChange={(e) => handleChange("bankname", e.target.value)} icon={<FaUniversity />} placeholder="Enter bank name" />
                <FormField label="Account No." name="bankaccountnumber" value={formValues.bankaccountnumber} onChange={(e) => handleChange("bankaccountnumber", e.target.value)} icon={<FaMoneyCheckAlt />} placeholder="Enter account number" />
                <FormField label="IFSC" name="ifsc" value={formValues.ifsc} onChange={(e) => handleChange("ifsc", e.target.value)} placeholder="Enter IFSC code" />
                <FormField label="UPI ID" name="upiid" value={formValues.upiid} onChange={(e) => handleChange("upiid", e.target.value)} placeholder="Enter UPI ID" />
              </div>
            </fieldset>
          </div>

          {/* Preferences */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Preferences</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormField label="Billing Cycle" name="billingcycle" type="select" value={formValues.billingcycle} onChange={(e) => handleChange("billingcycle", e.target.value)} options={[{ label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }]} placeholder="Select billing cycle" />
              <FormField label="Due Days" name="duedays" type="number" value={formValues.duedays} onChange={(e) => handleChange("duedays", e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="Enter due days" />
              <FormSwitch label="Status" name="status" checked={formValues.status} onChange={(val) => handleChange("status", val)} />
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/accounts")}>Cancel</Button>
            <Button variant="outline" onClick={handleSubmit}>{isEdit ? "Update Account" : "Add Account"}</Button>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditAccount;
