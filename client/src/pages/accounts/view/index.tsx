// Party View — left: the party's profile; right: its own Orders and Payments
// and the sub-parties under it (channel downline). Opened from the View
// button on Party Accounts (permission: Party Accounts → View).
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { gql, useQuery } from "@apollo/client";
import { FaArrowLeft, FaEdit } from "react-icons/fa";
import HomeLayout from "../../../layouts/home";
import { useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import { useAccountByIDQuery, useAccountsQuery, usePartyOutstandingSummaryQuery } from "../../../graphql/hooks/accounts";
import { GET_SALES_ORDERS } from "../../../graphql/queries/salesorder";
import { GET_PAYMENTS } from "../../../graphql/queries/payments";
import { formatINR, toTitleCase } from "../../../utils/helper";
import { InfoRow, OrdersTable, PartiesTable, PartyStockTable, PaymentsTable, StatTile, Tabs } from "../../../components/accountview";

const GET_PARTY_STOCK = gql`
  query GetPartyStock($partyid: ID!) {
    getPartyStock(partyid: $partyid) { id productid variantid productname variantname productcode unitname qty }
  }
`;

const PartyView = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const actions = useAppSelector((s) => selectModuleActions(s, "accounts"));
  const manageDownline = useAppSelector((s: any) => !!s.adminsettings?.settings?.partyManagesDownline);
  const trackStock = useAppSelector((s: any) => !!s.adminsettings?.settings?.trackPartyStock) && manageDownline;
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data: accData, loading: accLoading } = useAccountByIDQuery(id);
  const party = accData?.getAccountById;
  const { data: allData } = useAccountsQuery();
  const { outstandingById } = usePartyOutstandingSummaryQuery();

  const { data: ordData, loading: ordLoading } = useQuery(GET_SALES_ORDERS, {
    variables: { filter: { adminid, partyacc: id, includeConverted: true } },
    skip: !adminid || !id,
    fetchPolicy: "cache-and-network",
  });
  const { data: payData, loading: payLoading } = useQuery(GET_PAYMENTS, {
    variables: { filter: { adminid, partyid: id } },
    skip: !adminid || !id,
    fetchPolicy: "cache-and-network",
  });

  const { data: stockData, loading: stockLoading } = useQuery(GET_PARTY_STOCK, {
    variables: { partyid: id },
    skip: !id || !trackStock,
    fetchPolicy: "cache-and-network",
  });
  const stockRows = stockData?.getPartyStock ?? [];
  const orders = useMemo(() => [...(ordData?.getSalesOrders ?? [])].reverse(), [ordData]);
  const payments = useMemo(() => [...(payData?.getPayments ?? [])].reverse(), [payData]);
  // Direct children only — each sub-party's own View shows the level below it.
  const subParties = useMemo(
    () => (allData?.getAccounts ?? []).filter((a: any) => a.assignaccountid?.id === id),
    [allData, id],
  );
  const showSubTab = manageDownline || subParties.length > 0;
  const [tab, setTab] = useState("orders");

  const orderValue = orders.reduce((a: number, o: any) => a + (o.cancelStatus === "cancelled" ? 0 : Number(o.totalamount) || 0), 0);
  const received = payments.filter((p: any) => p.status !== false).reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0);

  if (!actions.showView) {
    return (
      <HomeLayout>
        <div className="p-6 text-center text-gray-500">You do not have permission to view party details.</div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={() => navigate("/accounts")} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
            <FaArrowLeft /> Party Accounts
          </button>
          {actions.showEdit && party && (
            <button onClick={() => navigate(`/accounts/addedit/${id}`)} className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <FaEdit /> Edit
            </button>
          )}
        </div>

        {accLoading && !party ? (
          <p className="py-10 text-center text-gray-400">Loading…</p>
        ) : !party ? (
          <p className="py-10 text-center text-gray-400">Party not found.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Left: profile */}
            <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                  {String(party.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900">{party.name}</p>
                  <p className="text-xs text-gray-500">#{party.accountcode} · {party.type ? toTitleCase(party.type) : "Party"}</p>
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <StatTile label="Outstanding" value={formatINR(outstandingById[id] || 0)} tone="text-red-600" />
                <StatTile label="Sub-parties" value={subParties.length} />
              </div>
              <InfoRow label="Mobile" value={party.mobile} />
              <InfoRow label="Email" value={party.email} />
              <InfoRow label="Channel" value={party.channel?.channelName} />
              <InfoRow
                label="Parent party"
                value={party.assignaccountid?.id ? (
                  <button className="text-blue-700 hover:underline" onClick={() => navigate(`/accounts/view/${party.assignaccountid.id}`)}>
                    {party.assignaccountid.name}
                  </button>
                ) : undefined}
              />
              <InfoRow label="Salesman" value={party.salesmanid?.name} />
              <InfoRow label="GST No" value={party.gstnumber} />
              <InfoRow label="Address" value={[party.address, party.city, party.state, party.pincode].filter(Boolean).join(", ") || undefined} />
              <InfoRow label="Credit limit" value={party.creditlimit ? formatINR(party.creditlimit) : undefined} />
              <InfoRow label="Branch" value={party.branchid?.branchname} />
              <InfoRow label="Status" value={party.status ? "Active" : "Inactive"} />
            </aside>

            {/* Right: tabs */}
            <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Total orders" value={orders.length} />
                <StatTile label="Order value" value={formatINR(orderValue)} tone="text-green-700" />
                <StatTile label="Payments" value={payments.length} />
                <StatTile label="Received" value={formatINR(received)} tone="text-green-700" />
              </div>
              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: "orders", label: "Orders", count: orders.length },
                  { key: "payments", label: "Payments", count: payments.length },
                  ...(showSubTab ? [{ key: "subparties", label: "Sub-parties", count: subParties.length }] : []),
                  ...(trackStock ? [{ key: "stock", label: "Stock", count: stockRows.length }] : []),
                ]}
              />
              {tab === "orders" && <OrdersTable orders={orders} loading={ordLoading && !ordData} />}
              {tab === "payments" && <PaymentsTable payments={payments} loading={payLoading && !payData} />}
              {tab === "stock" && <PartyStockTable rows={stockRows} loading={stockLoading && !stockData} />}
              {tab === "subparties" && (
                <PartiesTable
                  parties={subParties}
                  outstandingById={outstandingById}
                  canView={actions.showView}
                  emptyText="No parties under this party."
                />
              )}
            </section>
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default PartyView;
