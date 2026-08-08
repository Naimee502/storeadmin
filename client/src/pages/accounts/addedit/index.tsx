import { useState, useEffect, useCallback, useMemo } from "react";
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
import { regionOptions, stateOptions } from "../../../utils/constants";
import { selectIsModuleAllowed, selectIsFormFieldEnabled } from "../../../redux/slices/permissions";

// Tally-style: auto-map party type to standard account group name patterns + category fallback
const TYPE_GROUP_MAP: Record<string, { names: string[]; category: string }> = {
  customer: { names: ["sundry debtor", "debtor", "trade receivable", "receivable"], category: "assets" },
  vendor:   { names: ["sundry creditor", "creditor", "trade payable", "payable"],   category: "liabilities" },
  bank:     { names: ["bank account", "bank", "cash"],                               category: "assets" },
  expense:  { names: ["direct expense", "indirect expense", "expense"],              category: "expenses" },
  other:    { names: ["miscellaneous", "suspense", "other"],                         category: "liabilities" },
};

const AddEditAccount = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { admin } = useAppSelector((state: any) => state.auth);
  const adminId = admin?.id;
  // Channel & Region (and Assigned Salesman) only when the channels module is
  // enabled — salesmen are channel-based; sales routes are optional, so the
  // salesman assignment is gated by channel, not by the routes module.
  const channelAllowed = useAppSelector((s: any) => selectIsModuleAllowed(s, "channels"));
  // "Assign parent party" only when downline management is on.
  const partyManagesDownline = useAppSelector((s: any) => !!s.adminsettings?.settings?.partyManagesDownline);

  const isFieldEnabled = (fieldId: string) => 
    useAppSelector(state => selectIsFormFieldEnabled(state, "accounts", fieldId));

  const { data: existingData } = useAccountByIDQuery(id || "");
  const { data: accountGroupData } = useAccountGroupsQuery();
  const { data: assignAccountData } = useAccountsQuery();
  const { data: staffData } = useStaffQuery();
  const { data: channelData } = useChannelsQuery(adminId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _ledgersData } = useAccountLedgersQuery();

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
    branchid: null as any,
    channel: "",
    region: "default",
    latitude: "",
    longitude: "",
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const { addAccountMutation, editAccountMutation } = useAccountMutations();

  // Resolve which account group to auto-set for a given party type
  const resolveAccountGroup = useCallback((partyType: string) => {
    const groups = accountGroupData?.getAccountGroups || [];
    if (!groups.length) return "";
    const rule = TYPE_GROUP_MAP[partyType];
    if (!rule) return "";

    // 1. Try name match (case-insensitive substring)
    const byName = groups.find((g: any) =>
      rule.names.some(n => g.accountgroupname.toLowerCase().includes(n))
    );
    if (byName) return byName.id;

    // 2. Fallback: category match
    const byCat = groups.find((g: any) => g.category === rule.category);
    return byCat?.id || "";
  }, [accountGroupData]);

  // Auto-set account group for new accounts when groups data loads
  useEffect(() => {
    if (isEdit) return;
    const resolved = resolveAccountGroup(formValues.type);
    if (resolved) {
      setFormValues(prev => ({ ...prev, accountgroupid: resolved }));
    }
  }, [accountGroupData, isEdit]); // intentionally not including type — only on data load

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
        latitude: a.latitude ?? "",
        longitude: a.longitude ?? "",
      });
    }
  }, [isEdit, existingData]);

  const handleChange = (name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: "" }));
  };

  // Parent (upline) party options for downline hierarchy. When a channel is
  // selected, only parties whose channel HANDLES the selected channel show
  // (e.g. selecting "Retailer" → parent options = Wholesaler/Superstockist
  // parties). If no channel selected, all parties are eligible.
  const parentPartyOptions = useMemo(() => {
    const sel = formValues.channel;
    // Load parent options only AFTER a channel is selected.
    if (!sel) return [];
    const accounts = assignAccountData?.getAccounts || [];
    const channels = channelData?.getChannels || [];
    const parentChannelIds = channels
      .filter((c: any) => (c.handlesChannels || []).some((h: any) => h.id === sel))
      .map((c: any) => c.id);
    // Only parties whose channel handles the selected channel.
    return accounts
      .filter((acc: any) => acc.id !== id)
      .filter((acc: any) => acc.channel?.id && parentChannelIds.includes(acc.channel.id))
      .map((acc: any) => ({ label: acc.name, value: acc.id }));
  }, [assignAccountData, channelData, formValues.channel, id]);

  // When type changes: update field and auto-resolve account group
  const handleTypeChange = (value: string) => {
    const resolved = resolveAccountGroup(value);
    // Accounting convention: customer = receivable (debit), vendor = payable (credit).
    const autoBalType =
      value === "customer" ? "debit" : value === "vendor" ? "credit" : undefined;
    setFormValues(prev => ({
      ...prev,
      type: value,
      accountgroupid: resolved || prev.accountgroupid,
      ...(autoBalType ? { openingbalancetype: autoBalType } : {}),
    }));
    setFormErrors(prev => ({ ...prev, type: "", accountgroupid: "" }));
  };

  const validate = () => {
    const errors: { [key: string]: string } = {};
    if (!formValues.name.trim()) errors.name = "Name is required";
    if (!formValues.mobile.trim()) errors.mobile = "Mobile is required";
    if (!formValues.state) errors.state = "State is required";
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

    // Ensure account group is resolved before saving
    const accountgroupid = formValues.accountgroupid || resolveAccountGroup(formValues.type);
    if (!accountgroupid) {
      dispatch(showMessage({ message: "No matching account group found. Please create a standard account group (e.g. Sundry Debtors, Sundry Creditors) first.", type: "error" }));
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
      accountgroupid,
      assignaccountid: formValues.assignaccountid || null,
      salesmanid: formValues.salesmanid || null,
      admin: formValues.admin,
      branchid: formValues.branchid || null,
      channel: formValues.channel || null,
      region: formValues.region || "default",
      latitude: formValues.latitude !== "" ? Number(formValues.latitude) : null,
      longitude: formValues.longitude !== "" ? Number(formValues.longitude) : null,
    };

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

  const groups = accountGroupData?.getAccountGroups || [];
  const autoGroupName = groups.find((g: any) => g.id === formValues.accountgroupid)?.accountgroupname;

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
                {isFieldEnabled("name") && (
                  <FormField
                    label="Name"
                    name="name"
                    value={formValues.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    icon={<FaUser />}
                    error={formErrors.name}
                    placeholder="Enter full name"
                  />
                )}
                {isFieldEnabled("mobile") && (
                  <FormField
                    label="Mobile"
                    name="mobile"
                    value={formValues.mobile}
                    onChange={(e) => handleChange("mobile", e.target.value)}
                    icon={<FaMobileAlt />}
                    error={formErrors.mobile}
                    placeholder="Enter mobile number"
                  />
                )}
                {isFieldEnabled("email") && (
                  <FormField
                    label="Email"
                    name="email"
                    type="email"
                    value={formValues.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    icon={<FaEnvelope />}
                    placeholder="Enter email address"
                  />
                )}

                {/* Party Type — auto-triggers account group selection */}
                {/* Party Type — auto-triggers account group selection */}
                {isFieldEnabled("type") && (
                  <FormField
                    label="Party Type"
                    name="type"
                    type="select"
                    value={formValues.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    options={[
                      { label: "Customer",          value: "customer" },
                      { label: "Vendor / Supplier", value: "vendor" },
                      { label: "Expense Account",   value: "expense" },
                      { label: "Bank / Cash",        value: "bank" },
                      { label: "Other",              value: "other" },
                    ]}
                    placeholder="Select type"
                  />
                )}

                {/* Account Group — auto-set based on type, can be overridden */}
                {/* Account Group — auto-set based on type, can be overridden */}
                {isFieldEnabled("accountgroupid") && (
                  <div>
                    <FormField
                      label="Account Group"
                      name="accountgroupid"
                      type="select"
                      value={formValues.accountgroupid}
                      onChange={(e) => handleChange("accountgroupid", e.target.value)}
                      options={groups.map((g: any) => ({ label: g.accountgroupname, value: g.id }))}
                      error={formErrors.accountgroupid}
                      placeholder="Select Account Group"
                      searchable
                    />
                    {autoGroupName && (
                      <p className="text-xs text-green-600 mt-0.5 pl-1">
                        Auto-selected: <strong>{autoGroupName}</strong> — change if needed
                      </p>
                    )}
                  </div>
                )}

                {/* Channel & Region — only when the channels module is enabled */}
                {/* Channel & Region — only when the channels module is enabled */}
                {channelAllowed && (
                  <>
                    {isFieldEnabled("channel") && (
                      <div>
                        <FormField
                          label="Sales Channel"
                          name="channel"
                          type="select"
                          value={formValues.channel}
                          onChange={(e) => handleChange("channel", e.target.value)}
                          options={channelData?.getChannels?.map((c: any) => ({ label: c.channelName, value: c.id })) || []}
                          placeholder="Select Channel (optional)"
                          searchable
                        />
                        <p className="text-xs text-gray-400 mt-0.5 pl-1">
                          Used for channel-specific pricing from price assignments
                        </p>
                      </div>
                    )}

                    {isFieldEnabled("region") && (
                      <div>
                        <FormField
                          label="Region / Price Zone"
                          name="region"
                          type="select"
                          value={formValues.region}
                          onChange={(e) => handleChange("region", e.target.value)}
                          options={regionOptions}
                          placeholder="Select Region (optional)"
                          searchable
                        />
                        <p className="text-xs text-gray-400 mt-0.5 pl-1">
                          Used for region-specific pricing from price assignments
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Salesman — channel-based; shown when channels module is enabled */}
                {/* Salesman — channel-based; shown when channels module is enabled */}
                {channelAllowed && isFieldEnabled("salesmanid") && (
                  <div>
                    <FormField
                      label="Assigned Salesman"
                      name="salesmanid"
                      type="select"
                      value={formValues.salesmanid}
                      onChange={(e) => handleChange("salesmanid", e.target.value)}
                      options={
                        staffData?.getStaffAccounts
                          ?.filter((staff: any) => staff.role?.toLowerCase() === "salesman")
                          ?.map((staff: any) => ({ label: staff.name, value: staff.id })) || []
                      }
                      placeholder="Select Salesman (optional)"
                      searchable
                    />
                    <p className="text-xs text-gray-400 mt-0.5 pl-1">
                      Links this party to a salesman's sales route
                    </p>
                  </div>
                )}

                {/* Assign Parent Party — only when downline management is on */}
                {/* Assign Parent Party — only when downline management is on */}
                {partyManagesDownline && isFieldEnabled("assignaccountid") && (
                  <div>
                    <FormField
                      label="Assign Parent Party"
                      name="assignaccountid"
                      type="select"
                      value={formValues.assignaccountid}
                      onChange={(e) => handleChange("assignaccountid", e.target.value)}
                      options={parentPartyOptions}
                      placeholder={formValues.channel ? "Select parent party (optional)" : "Select a channel first"}
                      searchable
                    />
                    <p className="text-xs text-gray-400 mt-0.5 pl-1">
                      Upline party (e.g. wholesaler) that handles this party's orders &amp; payments.
                    </p>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Address Info */}
            {(isFieldEnabled("address") || isFieldEnabled("city") || isFieldEnabled("state") || isFieldEnabled("country") || isFieldEnabled("pincode") || isFieldEnabled("latitude") || isFieldEnabled("longitude")) && (
              <fieldset className="border rounded-xl p-4">
                <legend className="text-sm sm:text-base font-medium px-2">Address Info</legend>
                <div className="grid grid-cols-1 gap-4 mb-4">
                {/* Address Info is not rendered directly here anymore since the fields are broken out. Wait, Mobile and Email were duplicated here earlier by me? Actually let's just remove them from Address Info because they belong in Account Info. */}
                {isFieldEnabled("address") && <FormField label="Address" name="address" value={formValues.address} onChange={(e) => handleChange("address", e.target.value)} icon={<FaLocationArrow />} placeholder="Enter address" />}
                {isFieldEnabled("city") && <FormField label="City" name="city" value={formValues.city} onChange={(e) => handleChange("city", e.target.value)} icon={<FaCity />} placeholder="Enter city" />}
                {isFieldEnabled("state") && <FormField
                    label="State"
                    name="state"
                    type="select"
                    options={stateOptions}
                    value={formValues.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    placeholder="Select state"
                    error={formErrors.state}
                  />
                }
                {isFieldEnabled("country") && <FormField label="Country" name="country" value={formValues.country} onChange={(e) => handleChange("country", e.target.value)} placeholder="Enter country" />}
                {isFieldEnabled("pincode") && <FormField label="Pincode" name="pincode" value={formValues.pincode} onChange={(e) => handleChange("pincode", e.target.value)} placeholder="Enter pincode" />}
                {isFieldEnabled("latitude") && <FormField label="Latitude" name="latitude" value={formValues.latitude} onChange={(e) => handleChange("latitude", e.target.value)} placeholder="e.g. 23.0225" />}
                {isFieldEnabled("longitude") && <FormField label="Longitude" name="longitude" value={formValues.longitude} onChange={(e) => handleChange("longitude", e.target.value)} placeholder="e.g. 72.5714" />}
              </div>
            </fieldset>
            )}

            {/* Financial Info */}
            {(isFieldEnabled("openingbalance") || isFieldEnabled("openingbalancetype") || isFieldEnabled("creditlimit") || isFieldEnabled("gstnumber") || isFieldEnabled("pan")) && (
              <fieldset className="border rounded-xl p-4">
                <legend className="text-sm sm:text-base font-medium px-2">Financial Info</legend>
                <div className="grid grid-cols-1 gap-4 mb-4">
                {isFieldEnabled("openingbalance") && (
                  <FormField
                    label="Opening Balance"
                    name="openingbalance"
                    type="number"
                    value={formValues.openingbalance}
                    onChange={(e) => handleChange("openingbalance", e.target.value === "" ? "" : parseFloat(e.target.value))}
                    icon={<FaRupeeSign />}
                    placeholder="Enter opening balance"
                    error={formErrors.openingbalance}
                  />
                )}
                {isFieldEnabled("openingbalancetype") && (
                  <FormField label="Balance Type" name="openingbalancetype" type="select" value={formValues.openingbalancetype} onChange={(e) => handleChange("openingbalancetype", e.target.value)} options={[{ label: "Debit", value: "debit" }, { label: "Credit", value: "credit" }]} placeholder="Select balance type" />
                )}
                {isFieldEnabled("creditlimit") && (
                  <FormField
                    label="Credit Limit"
                    name="creditlimit"
                    type="number"
                    value={formValues.creditlimit}
                    onChange={(e) => handleChange("creditlimit", e.target.value === "" ? "" : parseFloat(e.target.value))}
                    icon={<FaRupeeSign />}
                    placeholder="Enter credit limit"
                  />
                )}
                {isFieldEnabled("gstnumber") && <FormField label="GST Number" name="gstnumber" value={formValues.gstnumber} onChange={(e) => handleChange("gstnumber", e.target.value)} placeholder="Enter GST number" />}
                {isFieldEnabled("pan") && <FormField label="PAN" name="pan" value={formValues.pan} onChange={(e) => handleChange("pan", e.target.value)} placeholder="Enter PAN" />}
              </div>
            </fieldset>
            )}

            {/* Bank Info */}
            {(isFieldEnabled("bankname") || isFieldEnabled("bankaccountnumber") || isFieldEnabled("ifsc") || isFieldEnabled("upiid")) && (
              <fieldset className="border rounded-xl p-4">
                <legend className="text-sm sm:text-base font-medium px-2">Bank Info</legend>
              <div className="grid grid-cols-1 gap-4 mb-4">
                {isFieldEnabled("bankname") && <FormField label="Bank Name" name="bankname" value={formValues.bankname} onChange={(e) => handleChange("bankname", e.target.value)} icon={<FaUniversity />} placeholder="Enter bank name" />}
                {isFieldEnabled("bankaccountnumber") && <FormField label="Account No." name="bankaccountnumber" value={formValues.bankaccountnumber} onChange={(e) => handleChange("bankaccountnumber", e.target.value)} icon={<FaMoneyCheckAlt />} placeholder="Enter account number" />}
                {isFieldEnabled("ifsc") && <FormField label="IFSC" name="ifsc" value={formValues.ifsc} onChange={(e) => handleChange("ifsc", e.target.value)} placeholder="Enter IFSC code" />}
                {isFieldEnabled("upiid") && <FormField label="UPI ID" name="upiid" value={formValues.upiid} onChange={(e) => handleChange("upiid", e.target.value)} placeholder="Enter UPI ID" />}
              </div>
            </fieldset>
            )}
          </div>

          {/* Preferences */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Preferences</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormField
                label="Billing Cycle"
                name="billingcycle"
                type="select"
                value={formValues.billingcycle}
                onChange={(e) => handleChange("billingcycle", e.target.value)}
                options={[
                  { label: "Daily",   value: "daily" },
                  { label: "Weekly",  value: "weekly" },
                  { label: "Monthly", value: "monthly" },
                ]}
                placeholder="Select billing cycle"
              />
              <FormField
                label="Due Days"
                name="duedays"
                type="number"
                value={formValues.duedays}
                onChange={(e) => handleChange("duedays", e.target.value === "" ? "" : parseInt(e.target.value))}
                placeholder="Enter due days"
              />
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
