import { X } from "lucide-react";
import { useState, useMemo } from "react";
import FormField from "../formfiled";
import { useAccountMutations } from "../../graphql/hooks/accounts";
import { useAccountGroupsQuery } from "../../graphql/hooks/accountgroups";
import { useAppSelector } from "../../redux/hooks";

type ErrorState = {
    name?: string;
    mobile?: string;
};

/* ---------- REGION LIST ---------- */
export const regionOptions: any[] = [
    { value: "andhra_pradesh", label: "Andhra Pradesh" },
    { value: "arunachal_pradesh", label: "Arunachal Pradesh" },
    { value: "assam", label: "Assam" },
    { value: "bihar", label: "Bihar" },
    { value: "chhattisgarh", label: "Chhattisgarh" },
    { value: "goa", label: "Goa" },
    { value: "gujarat", label: "Gujarat" },
    { value: "haryana", label: "Haryana" },
    { value: "himachal_pradesh", label: "Himachal Pradesh" },
    { value: "jharkhand", label: "Jharkhand" },
    { value: "karnataka", label: "Karnataka" },
    { value: "kerala", label: "Kerala" },
    { value: "madhya_pradesh", label: "Madhya Pradesh" },
    { value: "maharashtra", label: "Maharashtra" },
    { value: "manipur", label: "Manipur" },
    { value: "meghalaya", label: "Meghalaya" },
    { value: "mizoram", label: "Mizoram" },
    { value: "nagaland", label: "Nagaland" },
    { value: "odisha", label: "Odisha" },
    { value: "punjab", label: "Punjab" },
    { value: "rajasthan", label: "Rajasthan" },
    { value: "sikkim", label: "Sikkim" },
    { value: "tamil_nadu", label: "Tamil Nadu" },
    { value: "telangana", label: "Telangana" },
    { value: "tripura", label: "Tripura" },
    { value: "uttar_pradesh", label: "Uttar Pradesh" },
    { value: "uttarakhand", label: "Uttarakhand" },
    { value: "west_bengal", label: "West Bengal" },

    { value: "andaman_nicobar", label: "Andaman and Nicobar Islands" },
    { value: "chandigarh", label: "Chandigarh" },
    { value: "dadra_nagar_haveli_daman_diu", label: "Dadra and Nagar Haveli and Daman and Diu" },
    { value: "delhi", label: "Delhi" },
    { value: "jammu_kashmir", label: "Jammu and Kashmir" },
    { value: "ladakh", label: "Ladakh" },
    { value: "lakshadweep", label: "Lakshadweep" },
    { value: "puducherry", label: "Puducherry" },

    { value: "international", label: "International" }
];

export default function PosAddCustomer({
    open,
    onClose,
    onCreated,
    mode = "customer",            // ⭐ CUSTOMER | VENDOR
}: {
    open: boolean;
    onClose: () => void;
    onCreated: (id: string) => void;
    mode?: "customer" | "vendor"; // ⭐ NEW PROP
}) {
    const { admin, branch, staff, type } = useAppSelector((s) => s.auth);
    const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

    const adminId = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
    const branchId = type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : selectedBranchId;

    const { addAccountMutation } = useAccountMutations();
    const { data: accountGroupData } = useAccountGroupsQuery();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [mobile, setMobile] = useState("");
    const [stateName, setStateName] = useState("gujarat");
    const [accountType, setAccountType] = useState("retail");
    const [errors, setErrors] = useState<ErrorState>({});
    const [loading, setLoading] = useState(false);

    /* -----------------------------------------
       AUTO-FIND "SUNDRY DEBTORS" ACCOUNT GROUP
    ------------------------------------------ */
    const accountGroupId = useMemo(() => {
        if (!accountGroupData?.getAccountGroups) return "";

        const groups = accountGroupData.getAccountGroups;

        if (mode === "customer") {
            return (
                groups.find(
                    (g) =>
                        g.accountgroupname.toLowerCase().includes("sund") &&
                        g.accountgroupname.toLowerCase().includes("debt")
                )?.id || ""
            );
        }

        // Vendor case → Sundry Creditors
        return (
            groups.find(
                (g) =>
                    g.accountgroupname.toLowerCase().includes("sund") &&
                    g.accountgroupname.toLowerCase().includes("cred")
            )?.id || ""
        );
    }, [accountGroupData, mode]);


    const validate = () => {
        const err: ErrorState = {};
        if (!name.trim()) err.name = "Enter customer name";
        if (!mobile.trim() || mobile.length !== 10) err.mobile = "Enter valid 10 digit mobile no.";
        return err;
    };

    const handleCreate = async () => {
        const err = validate();
        if (Object.keys(err).length) {
            setErrors(err);
            return;
        }

        if (!accountGroupId) {
            alert(`Required account group for ${mode} not found!`);
            return;
        }

        setLoading(true);

        try {
            const input = {
                name,
                mobile,
                state: stateName,
                region: stateName,
                accountgroupid: accountGroupId,
                type: mode === "customer" ? "customer" : "vendor",
                status: true,
                admin: adminId,
                branchid: branchId || null,
                openingbalance: 0,
                openingbalancetype: mode === "customer" ? "debit" : "credit",
            };

            if (email.trim()) {
                (input as any).email = email.trim();
            }

            const res = await addAccountMutation({ variables: { input } });

            const newCustomerId = res?.data?.addAccount?.id;

            onCreated(newCustomerId);
            onClose();
        } catch (err: any) {
            console.error("AddCustomer error:", err);
            const msg =
                err?.graphQLErrors?.[0]?.message ||
                err?.networkError?.message ||
                err?.message ||
                "Failed to create account";
            alert(msg);
        }

        setLoading(false);
    };

    return (
        <div
            className={`fixed inset-0 z-50 bg-black/40 flex items-center justify-center transition ${
                open ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
        >
            <div className="bg-white w-[400px] rounded-xl shadow-xl p-5">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-lg font-semibold">
                     {mode === "customer" ? "Add Customer" : "Add Vendor"}
                    </h2>
                    <button onClick={onClose}><X /></button>
                </div>

                <FormField
                     label={mode === "customer" ? "Customer Name" : "Vendor Name"}
                    name="name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder="Enter name"
                    error={errors.name}
                />

                <FormField
                    label="Mobile"
                    name="mobile"
                    value={mobile}
                    onChange={(e) => {
                        setMobile(e.target.value);
                        setErrors((prev) => ({ ...prev, mobile: "" }));
                    }}
                    placeholder="Enter mobile number"
                    error={errors.mobile}
                />

                <FormField
                    label="Email (Optional)"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email (optional)"
                />

                <FormField
                    label="State"
                    name="state"
                    type="select"
                    value={stateName}
                    searchable
                    onChange={(e) => setStateName(e.target.value)}
                    options={regionOptions}
                />

                { mode === "vendor" && (
                    <FormField
                        label="Account Type"
                        name="accounttype"
                        type="select"
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value)}
                        options={[
                            { label: "End User", value: "enduser" },
                            { label: "Retail", value: "retail" },
                            { label: "Dealer", value: "dealer" },
                            { label: "Super Stockist", value: "superstockist" },
                            { label: "Distributor", value: "distributor" },
                            { label: "Manufacturer", value: "manufacturer" },
                            { label: "Exporter", value: "exporter" },
                        ]}
                        placeholder="Select account type"
                    />
                )}
                
                <button
                    className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg border disabled:opacity-60"
                    onClick={handleCreate}
                    disabled={loading}
                >
                    {loading ? "Saving..." : `Add ${mode === "customer" ? "Customer" : "Vendor"}`}
                </button>
            </div>
        </div>
    );
}
