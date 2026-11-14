import { useQuery } from "@apollo/client";
import { useAuth } from "../contexts/auth";
import { GET_MY_SERVICE_SUMMARY } from "../graphql/queries/myservice";

/** Which service menus a signed-in customer sees: a module the business uses, or records they already have. */
export const useMyService = () => {
  const { isLoggedIn } = useAuth();
  const { data } = useQuery(GET_MY_SERVICE_SUMMARY, { skip: !isLoggedIn, fetchPolicy: "cache-and-network" });
  const s = data?.getMyServiceSummary;
  return {
    tickets: !!s?.tickets, openTickets: s?.openTickets || 0,
    repairs: (s?.jobcards || 0) > 0, activeRepairs: s?.activeJobcards || 0,
    amc: (s?.contracts || 0) > 0, memberships: (s?.memberships || 0) > 0,
    loyalty: s?.loyaltyPoints !== null && s?.loyaltyPoints !== undefined, loyaltyPoints: s?.loyaltyPoints || 0,
  };
};

/** Menu entries for the customer's service area (path, label). */
export const serviceMenu = (m: ReturnType<typeof useMyService>) => [
  m.repairs && { to: "/account/repairs", label: "My Repairs", badge: m.activeRepairs },
  m.amc && { to: "/account/amc", label: "AMC / Warranty", badge: 0 },
  m.memberships && { to: "/account/memberships", label: "My Membership", badge: 0 },
  m.tickets && { to: "/account/tickets", label: "Support Tickets", badge: m.openTickets },
  m.loyalty && { to: "/account/points", label: "My Points", badge: 0 },
].filter(Boolean) as { to: string; label: string; badge: number }[];
