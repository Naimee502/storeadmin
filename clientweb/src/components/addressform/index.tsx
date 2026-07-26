import { useState } from "react";
import { useMutation } from "@apollo/client";
import { MapPin, Building2, Hash } from "lucide-react";
import { EDIT_ACCOUNT } from "../../graphql/queries/accounts";
import { stateOptions } from "../../utils/states";

interface AddressValues {
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface AddressFormProps {
  accountId: string;
  name: string;
  accountGroupId?: string | null;
  initial?: Partial<AddressValues>;
  onSaved: (values: AddressValues) => void;
  submitLabel?: string;
}

// Same field set (Address, City, State, Pincode) the admin panel's Add
// Account "Address Info" section collects — used both to force a delivery
// address at checkout and to edit it later from My Account. Country
// defaults to "India" server-side same as the admin panel; not asked here.
export default function AddressForm({ accountId, name, accountGroupId, initial, onSaved, submitLabel = "Save Address" }: AddressFormProps) {
  const [address, setAddress] = useState(initial?.address || "");
  const [city, setCity] = useState(initial?.city || "");
  const [state, setState] = useState(initial?.state && initial.state !== "default" ? initial.state : "");
  const [pincode, setPincode] = useState(initial?.pincode || "");
  const [error, setError] = useState<string | null>(null);
  const [editAccount, { loading: saving }] = useMutation(EDIT_ACCOUNT);

  const valid = !!(address.trim() && city.trim() && state && pincode.trim().length >= 4);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !accountGroupId) return;
    setError(null);
    try {
      await editAccount({
        variables: {
          id: accountId,
          input: {
            name,
            accountgroupid: accountGroupId,
            address: address.trim(),
            city: city.trim(),
            state,
            pincode: pincode.trim(),
          },
        },
      });
      onSaved({ address: address.trim(), city: city.trim(), state, pincode: pincode.trim() });
    } catch (err: any) {
      setError(err?.message || "Couldn't save your address. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">Address</label>
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 focus-within:border-brand-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <textarea
            required
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House / street / area"
            className="w-full resize-none text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">City</label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">Pincode</label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
            <Hash className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              placeholder="380001"
              className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">State</label>
        <select
          required
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
        >
          <option value="" disabled>
            Select State
          </option>
          {stateOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</div>}

      <button
        type="submit"
        disabled={!valid || saving || !accountGroupId}
        className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
