import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { useAuth } from "../contexts/auth";
import { useTenant } from "../contexts/tenant";
import { GET_DELIVERY_MODE, GET_DOWNLINE_PARTY_BALANCES } from "../graphql/queries/accounts";

// Whether THIS logged-in party may see/manage its sub-parties' orders &
// payments — same two-part check the app uses everywhere: the business-wide
// "Party manages downline" setting AND this specific party actually having
// sub-parties assigned to it (an end-user party has none, so the downline UI
// must stay hidden for them even when the setting is on).
export function useDownline() {
  const { account } = useAuth();
  const { adminid } = useTenant();

  const { data: settingsData } = useQuery(GET_DELIVERY_MODE, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
  const manageDownline = settingsData?.getAdminSettings?.partyManagesDownline === true;

  const { data: downlineBalData } = useQuery(GET_DOWNLINE_PARTY_BALANCES, {
    variables: { partyid: account?.id },
    skip: !account?.id || !manageDownline,
    fetchPolicy: "cache-and-network",
  });
  const downlineParties: any[] = downlineBalData?.getDownlinePartyBalances ?? [];
  const downlineIds = useMemo(() => new Set(downlineParties.map((p: any) => p.id)), [downlineParties]);
  const hasDownline = downlineParties.length > 0;

  const isOwnOrDownline = (partyId?: string | null) =>
    !!partyId && (partyId === account?.id || (manageDownline && downlineIds.has(partyId)));

  return { manageDownline, hasDownline, downlineParties, downlineIds, isOwnOrDownline };
}
