import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useLazyQuery } from "@apollo/client";
import { REVERSE_GEOCODE } from "../../../graphql/queries/accounts";
import HomeLayout from "../../../layouts/home";
import {
  FaUser, FaMobileAlt, FaEnvelope, FaLocationArrow, FaCity,
  FaMoneyCheckAlt, FaRupeeSign,
  FaUniversity, FaCrosshairs, FaMapMarkedAlt, FaTimes
} from "react-icons/fa";
import FormField from "../../../components/formfiled";
import LocationPreviewMap from "../../../components/locationpreviewmap";
import FormSwitch from "../../../components/formswitch";
import Button from "../../../components/button";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useAccountMutations, useAccountByIDQuery, useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useImageUpload } from "../../../graphql/hooks/uploads";
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
  // Both sides on ONE ledger, filed with the debtors. The group only decides
  // where the party is listed; which way the balance actually leans is decided
  // by the bills, and a both-party can end up on either side.
  both:     { names: ["sundry debtor", "debtor", "trade receivable", "receivable"], category: "assets" },
  bank:     { names: ["bank account", "bank", "cash"],                               category: "assets" },
  expense:  { names: ["direct expense", "indirect expense", "expense"],              category: "expenses" },
  other:    { names: ["miscellaneous", "suspense", "other"],                         category: "liabilities" },
};


// "lat, lng" or any Google Maps link (…/@23.02,72.57,… or ?q=23.02,72.57).
const parseLatLng = (text: string): { lat: number; lng: number } | null => {
  const m = String(text || "").match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]); const lng = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
};

// Shop front photo — taken by the salesman in the app, or uploaded here.
const ShopPhotoField = ({ value, onChange }: { value: string; onChange: (url: string) => void }) => {
  const { uploadImageMutation } = useImageUpload();
  const dispatch = useAppDispatch();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const onFile = async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { data: up } = await uploadImageMutation({ variables: { file } }, "product");
      onChange(up?.uploadImage?.url || "");
    } catch (err: any) {
      dispatch(showMessage({ message: err?.message || "Photo upload failed.", type: "error" }));
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">Shop Photo</label>
      <div className="flex items-center gap-3">
        {value ? (
          <button type="button" onClick={() => setOpen(true)} title="View photo"
            className="w-20 h-20 rounded-lg overflow-hidden border-2 border-green-500 shrink-0 hover:opacity-90">
            <img src={value} alt="shop" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs text-center shrink-0">
            No photo
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium ${uploading ? "opacity-60 pointer-events-none" : "hover:bg-gray-50"}`}>
            {uploading ? "Uploading…" : value ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
          {value && !uploading && (
            <button type="button" onClick={() => onChange("")}
              className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50">
              Remove
            </button>
          )}
        </div>
      </div>
      {open && value && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-3 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-semibold text-gray-700">Shop photo</span>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-800 text-xl leading-none px-1" aria-label="Close">×</button>
            </div>
            <img src={value} alt="shop" className="w-full max-h-[65vh] object-contain rounded-xl bg-gray-50" />
          </div>
        </div>
      )}
    </div>
  );
};

// One "Shop Location (GPS)" field, same as the app: tap the target to capture
// the current position, or paste "lat, lng" / a Google Maps link.
const ShopLocationField = ({ latitude, longitude, onChange }: {
  latitude: any; longitude: any;
  onChange: (lat: string, lng: string) => void;
}) => {
  const has = latitude !== "" && latitude != null && longitude !== "" && longitude != null;
  const fmt = (v: any) => Number(v).toFixed(6);
  const [text, setText] = useState(has ? `${fmt(latitude)}, ${fmt(longitude)}` : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Keep the box in sync when the record loads (edit mode).
  useEffect(() => {
    if (has) {
      const cur = parseLatLng(text);
      if (!cur || cur.lat !== Number(latitude) || cur.lng !== Number(longitude)) setText(`${fmt(latitude)}, ${fmt(longitude)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  const capture = () => {
    if (busy) return;
    if (!navigator.geolocation) { setMsg({ type: "err", text: "This browser does not support location." }); return; }
    setBusy(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6), lng = pos.coords.longitude.toFixed(6);
        setText(`${lat}, ${lng}`); onChange(lat, lng); setBusy(false);
        const acc = Math.round(pos.coords.accuracy || 0);
        setMsg({ type: "ok", text: acc ? `Location captured (±${acc} m)` : "Location captured" });
      },
      (err) => {
        setBusy(false);
        setMsg({ type: "err", text: err.code === 1 ? "Location permission denied — allow it in the browser and try again." : "Could not get location. Try again or paste from Google Maps." });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const onType = (v: string) => {
    setText(v); setMsg(null);
    if (!v.trim()) { onChange("", ""); return; }
    const p = parseLatLng(v);
    if (p) onChange(String(p.lat), String(p.lng));
  };

  const clear = () => { setText(""); setMsg(null); onChange("", ""); };
  const invalid = !!text.trim() && !parseLatLng(text);

  return (
    <div className="flex flex-col w-full gap-1">
      <label className="text-sm font-medium text-gray-700">Shop Location (GPS)</label>
      <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 ${invalid ? "border-red-500" : "border-gray-300"}`}>
        <button type="button" onClick={capture} disabled={busy} title="Capture current location"
          className={`text-green-600 hover:text-green-700 cursor-pointer ${busy ? "animate-spin opacity-60" : ""}`}>
          <FaCrosshairs />
        </button>
        <input
          className="w-full text-sm bg-transparent outline-none"
          value={text}
          onChange={(e) => onType(e.target.value)}
          placeholder={busy ? "Getting location…" : "Tap to capture current location, or paste lat, lng / Google Maps link"}
          onClick={() => { if (!text.trim()) capture(); }}
        />
        {has && !invalid && (
          <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer"
            title="View on map" className="text-blue-500 hover:text-blue-700"><FaMapMarkedAlt /></a>
        )}
        {!!text && (
          <button type="button" onClick={clear} title="Clear" className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
        )}
      </div>
      {invalid ? <p className="text-red-600 text-xs">Enter as "lat, lng" (e.g. 23.0225, 72.5714) or paste a Google Maps link.</p>
        : msg ? <p className={`text-xs ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
        : <p className="text-xs text-gray-400">Capture works best on a phone at the shop. On a computer, location can be approximate.</p>}
    </div>
  );
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
    shopimage: "",
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

    // 1. Name match, walking the patterns in PRIORITY order and preferring a
    //    group whose category also fits.
    //
    //    Scanning groups first and asking "does any pattern match?" picked
    //    whichever group the DB happened to return first, so the loose
    //    catch-all pattern beat the specific one: "Expense Account" landed on
    //    "Prepaid Expenses" (an ASSET group) because it contains "expense",
    //    and "Bank / Cash" could land on "Bank OD A/c" (a LIABILITY) because
    //    it contains "bank". The party then sat on the wrong side of the
    //    balance sheet unless someone spotted it and changed it by hand.
    for (const n of rule.names) {
      const matches = groups.filter((g: any) =>
        g.accountgroupname.toLowerCase().includes(n)
      );
      if (!matches.length) continue;
      const best = matches.find((g: any) => g.category === rule.category) || matches[0];
      return best.id;
    }

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
        shopimage: a.shopimage ?? "",
      });
    }
  }, [isEdit, existingData]);

  const handleChange = (name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: "" }));
  };

  // Shop location set (captured or pasted) → Address / City / State / Pincode
  // filled from it, same as the app's Add New Party. Only EMPTY fields are
  // filled, so nothing already typed is overwritten; all stay editable.
  const [reverseGeocode] = useLazyQuery(REVERSE_GEOCODE, { fetchPolicy: "network-only" });
  const [fillingAddress, setFillingAddress] = useState(false);
  const normState = (v: string) => String(v || "").toLowerCase().replace(/[^a-z]/g, "");
  const fillAddressFrom = async (lat: string, lng: string) => {
    const la = Number(lat), lo = Number(lng);
    if (!lat || !lng || !isFinite(la) || !isFinite(lo)) return;
    setFillingAddress(true);
    try {
      const res: any = await reverseGeocode({ variables: { latitude: la, longitude: lo } });
      const g = res?.data?.reverseGeocode;
      if (!g) return;
      const stateMatch = g.state
        ? stateOptions.find((o: any) => o.value && normState(o.label) === normState(g.state))
        : null;
      setFormValues((prev: any) => ({
        ...prev,
        address: String(prev.address || "").trim() ? prev.address : (g.address || prev.address),
        city: String(prev.city || "").trim() ? prev.city : (g.city || prev.city),
        pincode: String(prev.pincode || "").trim() ? prev.pincode : (/^\d{6}$/.test(g.pincode || "") ? g.pincode : prev.pincode),
        state: prev.state ? prev.state : (stateMatch?.value || prev.state),
      }));
      setFormErrors((prev: any) => ({ ...prev, address: "", city: "", pincode: "", state: "" }));
    } catch {
      // Best effort — the fields can always be typed by hand.
    } finally {
      setFillingAddress(false);
    }
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
    // A both-party starts on the debit side, but it is only a starting point —
    // which way they actually stand is whatever their bills add up to, and the
    // user can flip it here if the opening balance says otherwise.
    const autoBalType =
      value === "customer" || value === "both"
        ? "debit"
        : value === "vendor"
        ? "credit"
        : undefined;

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
      shopimage: formValues.shopimage || null,
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
    } catch (error: any) {
      // Show the server's reason (e.g. "This email is already registered…").
      dispatch(showMessage({ message: error?.message || "Error saving account", type: "error" }));
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
                      { label: "Customer & Vendor",  value: "both" },
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
              <fieldset className="border rounded-xl p-4 flex flex-col">
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
                {(isFieldEnabled("latitude") || isFieldEnabled("longitude")) && (
                  <ShopLocationField
                    latitude={formValues.latitude}
                    longitude={formValues.longitude}
                    onChange={(lat, lng) => {
                      handleChange("latitude", lat); handleChange("longitude", lng);
                      fillAddressFrom(lat, lng);
                    }}
                  />
                )}
                {fillingAddress && <p className="-mt-3 text-xs text-blue-600">Filling address from location…</p>}
                <ShopPhotoField value={formValues.shopimage || ""} onChange={(url) => handleChange("shopimage", url)} />
              </div>
              {/* Map of the saved shop location, in the empty space left below
                  the fields. It fills that space and never grows the card. */}
              {(isFieldEnabled("latitude") || isFieldEnabled("longitude")) && (
                <LocationPreviewMap latitude={formValues.latitude} longitude={formValues.longitude} />
              )}
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
                  /* Debit or credit only. Whether the opening can be settled
                     from BOTH payment screens follows the PARTY type — a
                     Customer & Vendor party's opening is offered on each — so
                     there is nothing to pick here for it. A "Debit & Credit"
                     option was tried and removed: it read as though the money
                     sat on both sides of the books at once. */
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
