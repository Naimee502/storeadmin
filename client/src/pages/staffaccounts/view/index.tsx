// Staff View — left: the staff member's profile; right: the parties assigned
// to them and the orders they took (filter by date, status, party). Opened
// from the View button on Staff Accounts (permission: Staff Accounts → View).
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { gql, useQuery } from "@apollo/client";
import { FaArrowLeft } from "react-icons/fa";
import HomeLayout from "../../../layouts/home";
import { useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import { useStaffByIDQuery } from "../../../graphql/hooks/staffaccounts";
import { usePartyOutstandingSummaryQuery } from "../../../graphql/hooks/accounts";
import { GET_SALES_ORDERS } from "../../../graphql/queries/salesorder";
import { GET_PAYMENTS } from "../../../graphql/queries/payments";
import { GET_ACCOUNTS } from "../../../graphql/queries/accounts";
import { formatINR, toTitleCase } from "../../../utils/helper";
import { DeliveriesTable, InfoRow, OrdersTable, PartiesTable, PaymentsTable, StatTile, Tabs } from "../../../components/accountview";

// Invoices handed to a delivery boy (same source as the delivery app).
const GET_STAFF_DELIVERIES = gql`
  query GetStaffDeliveries($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id billnumber billdate createdAt totalamount outstanding
      deliveryStatus deliveredAt
      partyacc { id accountname }
    }
  }
`;

const StaffView = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const actions = useAppSelector((s) => selectModuleActions(s, "staffaccounts"));
  const partyActions = useAppSelector((s) => selectModuleActions(s, "accounts"));
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data: stData, loading: stLoading } = useStaffByIDQuery(id);
  const member = stData?.getStaffAccountById;
  const { outstandingById } = usePartyOutstandingSummaryQuery();

  // Server expands salesmenid to: orders they created + orders assigned to
  // them + orders of their parties.
  const { data: ordData, loading: ordLoading } = useQuery(GET_SALES_ORDERS, {
    variables: { filter: { adminid, salesmenid: id, includeConverted: true } },
    skip: !adminid || !id,
    fetchPolicy: "cache-and-network",
  });
  const orders = useMemo(() => [...(ordData?.getSalesOrders ?? [])].reverse(), [ordData]);

  // Delivery boy: deliveries + the payments he collected instead of orders.
  const isDeliveryBoy = member?.role === "deliveryboy";
  const { data: delData, loading: delLoading } = useQuery(GET_STAFF_DELIVERIES, {
    variables: { filter: { adminid, deliveryboyid: id } },
    skip: !adminid || !id || !isDeliveryBoy,
    fetchPolicy: "cache-and-network",
  });
  const { data: payData, loading: payLoading } = useQuery(GET_PAYMENTS, {
    variables: { filter: { adminid } },
    skip: !adminid || !id || !isDeliveryBoy,
    fetchPolicy: "cache-and-network",
  });
  const deliveries = useMemo(() => [...(delData?.getSalesInvoices ?? [])].reverse(), [delData]);
  const collections = useMemo(
    () => (payData?.getPayments ?? []).filter((p: any) => String(p.createdby_id || "") === id).reverse(),
    [payData, id],
  );
  const deliveredCount = deliveries.filter((d: any) => d.deliveryStatus === "delivered").length;
  const collected = collections.filter((p: any) => p.status !== false).reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0);
  // Parties — the same list the staff member works with in the app:
  //  • Salesman: parties linked to him + parties on his Sales Routes (the
  //    server's salesmanid filter, exactly what "My Parties" shows).
  //  • Other staff: every party of the business, as in the staff app.
  const isSalesman = member?.role === "salesman";
  // directOnly: with "Company sees direct-party orders only" on, only parties
  // with no parent party (the server ignores it when the setting is off).
  const { data: smData } = useQuery(GET_ACCOUNTS, {
    variables: { filter: { admin: adminid, status: true, directOnly: true, ...(isSalesman ? { salesmanid: id } : {}) } },
    skip: !adminid || !id || !member,
    fetchPolicy: "cache-and-network",
  });
  const parties = useMemo(() => smData?.getAccounts ?? [], [smData]);
  const orderCountById = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach((o: any) => { const p = o.partyacc?.id; if (p) m[p] = (m[p] || 0) + 1; });
    return m;
  }, [orders]);
  // Filter options: assigned parties plus any other party they took an order for.
  const partyOptions = useMemo(() => {
    const m = new Map<string, string>();
    parties.forEach((p: any) => m.set(p.id, p.name));
    orders.forEach((o: any) => { if (o.partyacc?.id && !m.has(o.partyacc.id)) m.set(o.partyacc.id, o.partyacc.accountname || "—"); });
    return [...m.entries()].map(([pid, name]) => ({ id: pid, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [parties, orders]);

  const [tabPick, setTab] = useState<string | null>(null);
  const tab = tabPick ?? (isDeliveryBoy ? "deliveries" : "orders");
  const orderValue = orders.reduce((a: number, o: any) => a + (o.cancelStatus === "cancelled" ? 0 : Number(o.totalamount) || 0), 0);
  const target = Number(member?.target) || 0;

  if (!actions.showView) {
    return (
      <HomeLayout>
        <div className="p-6 text-center text-gray-500">You do not have permission to view staff details.</div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-4">
          <button onClick={() => navigate("/staffaccounts")} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
            <FaArrowLeft /> Staff Accounts
          </button>
        </div>

        {stLoading && !member ? (
          <p className="py-10 text-center text-gray-400">Loading…</p>
        ) : !member ? (
          <p className="py-10 text-center text-gray-400">Staff member not found.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-3">
                {member.imageurl || member.profilepicture ? (
                  <img src={member.imageurl || member.profilepicture} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
                    {String(member.name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.role ? toTitleCase(member.role) : "Staff"}{member.staffcode ? ` · #${member.staffcode}` : ""}</p>
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {isDeliveryBoy ? (
                  <>
                    <StatTile label="Delivered" value={deliveredCount} tone="text-green-700" />
                    <StatTile label="Collected" value={formatINR(collected)} tone="text-green-700" />
                  </>
                ) : (
                  <>
                    <StatTile label="Parties" value={parties.length} />
                    <StatTile label="Orders" value={orders.length} />
                  </>
                )}
              </div>
              <InfoRow label="Mobile" value={member.mobile} />
              <InfoRow label="Email" value={member.email} />
              <InfoRow label="Branch" value={member.branchid?.branchname} />
              <InfoRow label="Salary" value={member.salary ? formatINR(member.salary) : undefined} />
              <InfoRow label="Commission" value={member.commission ? `${member.commission}%` : undefined} />
              <InfoRow label="Target" value={target ? formatINR(target) : undefined} />
              <InfoRow label="Channels" value={(member.assignedChannels || []).map((c: any) => c.channelName).join(", ") || undefined} />
              <InfoRow label="Address" value={member.address} />
              <InfoRow label="Status" value={member.status ? "Active" : "Inactive"} />
            </aside>

            <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
              {isDeliveryBoy ? (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatTile label="Assigned" value={deliveries.length} />
                    <StatTile label="Delivered" value={deliveredCount} tone="text-green-700" />
                    <StatTile label="Pending" value={deliveries.length - deliveredCount} tone="text-amber-600" />
                    <StatTile label="Collected" value={formatINR(collected)} tone="text-green-700" />
                  </div>
                  <Tabs
                    active={tab}
                    onChange={setTab}
                    tabs={[
                      { key: "deliveries", label: "Deliveries", count: deliveries.length },
                      { key: "collections", label: "Collections", count: collections.length },
                    ]}
                  />
                  {tab === "deliveries" && <DeliveriesTable invoices={deliveries} loading={delLoading && !delData} />}
                  {tab === "collections" && <PaymentsTable payments={collections} loading={payLoading && !payData} />}
                </>
              ) : (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <StatTile label="Total orders" value={orders.length} />
                    <StatTile label="Order value" value={formatINR(orderValue)} tone="text-green-700" />
                    <StatTile label="Target achieved" value={target ? `${Math.round((orderValue / target) * 100)}%` : "—"} />
                  </div>
                  <Tabs
                    active={tab}
                    onChange={setTab}
                    tabs={[
                      { key: "orders", label: "Orders", count: orders.length },
                      { key: "parties", label: "Parties", count: parties.length },
                    ]}
                  />
                  {tab === "orders" && (
                    <OrdersTable orders={orders} loading={ordLoading && !ordData} showParty partyOptions={partyOptions} />
                  )}
                  {tab === "parties" && (
                    <PartiesTable
                      parties={parties}
                      outstandingById={outstandingById}
                      orderCountById={orderCountById}
                      canView={partyActions.showView}
                      emptyText={isSalesman ? "No parties assigned to this salesman (party or Sales Route)." : "No parties."}
                    />
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default StaffView;
