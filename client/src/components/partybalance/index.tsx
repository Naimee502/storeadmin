import { gql, useQuery } from "@apollo/client";
import { useAppSelector } from "../../redux/hooks";

const GET_PARTY_BILL_BALANCE = gql`
  query GetPartyBillBalance($partyid: ID!, $excludeInvoiceId: ID, $excludePurchaseInvoiceId: ID, $excludePaymentId: ID) {
    getPartyBillBalance(partyid: $partyid, excludeInvoiceId: $excludeInvoiceId, excludePurchaseInvoiceId: $excludePurchaseInvoiceId, excludePaymentId: $excludePaymentId)
  }
`;

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}₹${Math.abs(n).toFixed(2)}`;
const tone = (n: number) => (n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : "text-slate-500");

/** Under a party picker: balance before this bill and after it (+ = party owes us, - = we owe / advance with us). Purchase bills lower it. */
// A payment passes its signed effect as `total` (receipt negative) and its own id to leave out on edit.
export default function PartyBalanceNote({ partyId, total, excludeInvoiceId, purchase, excludePaymentId }: { partyId?: string | null; total: number; excludeInvoiceId?: string | null; purchase?: boolean; excludePaymentId?: string | null }) {
  // Shown only when Business Settings -> Invoice Print -> "Party Previous / Current balance" is on.
  const on = useAppSelector((s: any) => s.adminsettings?.settings?.printShowPartyBalance === true);
  const { data } = useQuery(GET_PARTY_BILL_BALANCE, {
    variables: excludePaymentId
      ? { partyid: partyId, excludePaymentId }
      : purchase
      ? { partyid: partyId, excludePurchaseInvoiceId: excludeInvoiceId || null }
      : { partyid: partyId, excludeInvoiceId: excludeInvoiceId || null },
    skip: !partyId || !on,
    fetchPolicy: "cache-and-network",
  });
  const prev = data?.getPartyBillBalance;
  if (!on || !partyId || typeof prev !== "number") return null;
  const current = Math.round((prev + (purchase ? -1 : 1) * (Number(total) || 0)) * 100) / 100;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] leading-tight">
      <span className="text-slate-500">Previous Balance: <span className={`font-semibold ${tone(prev)}`}>{signed(prev)}</span></span>
      <span className="text-slate-500">Current Balance: <span className={`font-semibold ${tone(current)}`}>{signed(current)}</span></span>
    </div>
  );
}
