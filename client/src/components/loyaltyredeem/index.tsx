import React, { useEffect } from "react";
import { useQuery } from "@apollo/client";
import { Gift } from "lucide-react";
import FormField from "../formfiled";
import { useAppSelector } from "../../redux/hooks";
import { GET_PARTY_LOYALTY } from "../../graphql/queries/loyalty";

/** Loyalty Points module ticked for this business (opt-in, so a blank module list is off). */
export const useLoyaltyOn = () =>
  useAppSelector((s: any) => {
    const list = s.auth?.admin?.allowedmodules ?? s.auth?.branch?.admin?.allowedmodules ?? s.auth?.staff?.admin?.allowedmodules;
    return Array.isArray(list) && list.some((m: string) => String(m).toLowerCase() === "loyalty");
  });

type Props = {
  partyId?: string | null;
  /** Bill total before the points discount. */
  billTotal: number;
  points: number | "";
  /** Points this bill already used when it is being edited (still the party's to spend here). */
  heldPoints?: number;
  onChange: (points: number, discount: number) => void;
  compact?: boolean;
};

/** Use a party's loyalty points as a discount on this bill. */
const LoyaltyRedeem: React.FC<Props> = ({ partyId, billTotal, points, heldPoints = 0, onChange, compact }) => {
  const on = useLoyaltyOn();
  const online = typeof navigator === "undefined" || navigator.onLine;
  const { data } = useQuery(GET_PARTY_LOYALTY, { variables: { partyid: partyId }, skip: !on || !partyId, fetchPolicy: "cache-and-network" });
  const acc = data?.getPartyLoyalty;
  const r = acc?.rules;
  const available = Math.max(0, Math.floor((acc?.balance || 0) + heldPoints));
  const capByBill = r ? Math.floor(((Math.max(0, billTotal) * (r.maxRedeemPercent ?? 100)) / 100) / (r.pointValue || 1)) : 0;
  const max = Math.max(0, Math.min(available, capByBill));
  const value = Number(points) || 0;

  // Party or total changed: keep the points within what is allowed.
  useEffect(() => {
    if (!r) return;
    if (value > max) onChange(max, Math.round(max * r.pointValue * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, r?.pointValue]);

  if (!on || !partyId || !r?.enabled || !online) return null;
  if (!available && !value) return null;
  const set = (p: number) => {
    const n = Math.max(0, Math.min(max, Math.floor(p || 0)));
    onChange(n, Math.round(n * r.pointValue * 100) / 100);
  };
  return (
    <div className={compact ? "flex items-end gap-1.5" : "flex items-end gap-1.5"}>
      <div className="flex-1">
        <FormField label={`Loyalty Points (${available} available)`} name="loyaltyPoints" type="number" value={points}
          onChange={(e: any) => set(Number(e.target.value))} />
      </div>
      <button type="button" onClick={() => set(value ? 0 : max)} disabled={!max && !value}
        title={value ? "Remove points" : `Use ${max} points (₹${(max * r.pointValue).toFixed(2)})`}
        className="h-8 shrink-0 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[12px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
        <Gift size={13} /> {value ? `-₹${(value * r.pointValue).toFixed(2)}` : "Use Max"}
      </button>
      {r.minRedeem > 0 && value > 0 && value < r.minRedeem && (
        <span className="text-[11px] text-rose-600">Min {r.minRedeem}</span>
      )}
    </div>
  );
};

export default LoyaltyRedeem;
