import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useAccountsLiteQuery } from "../../graphql/hooks/accounts";
import { TICKET_PRIORITY, TICKET_STATUS, useSupportTicketMutations, useSupportTicketsQuery } from "../../graphql/hooks/supportticket";
import { partyLabel } from "../../utils/partylabel";
import { formatDateDMY } from "../../utils/helper";
import { ShortcutButton } from "../followups";

const TABS: Array<[string, string]> = [["", "All"], ...Object.entries(TICKET_STATUS)];

/** Support tickets: customer complaints and service requests, by status. */
const SupportTickets = ({ deleted = false }: { deleted?: boolean }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "supporttickets"));
  const [tab, setTab] = useState("");
  const { data, loading, refetch } = useSupportTicketsQuery(deleted ? { deleted: true } : tab ? { ticketstatus: tab } : {});
  const { remove, reset } = useSupportTicketMutations();
  const { data: accountData } = useAccountsLiteQuery();
  const parties = useMemo(() => new Map((accountData?.getAccounts || []).map((a: any) => [a.id, a])), [accountData]);

  const rows = (data?.getSupportTickets || []).map((t: any, i: number) => ({
    ...t,
    seqNo: i + 1,
    date: formatDateDMY(t.createdAt),
    party: t.party ? partyLabel(parties.get(t.party.id) || { name: t.party.name }) : "-",
    assigned: t.assignedto?.name || "-",
    priorityText: TICKET_PRIORITY[t.priority] || t.priority,
    statusText: TICKET_STATUS[t.ticketstatus] || t.ticketstatus,
  }));
  const say = (message: string, type: "success" | "error" = "success") => dispatch(showMessage({ message, type }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 space-y-3">
        {!deleted && (
          <div className="flex flex-wrap gap-1 border-b border-slate-200">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={`h-8 px-3 text-[13px] font-medium ${tab === key ? "border-b-2 border-indigo-600 text-indigo-700" : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <DataTable
          {...actions}
          title={deleted ? "Deleted Support Tickets" : "Support Tickets"}
          columns={[
            { label: "Ticket No.", key: "ticketno" },
            { label: "Date", key: "date" },
            { label: "Party", key: "party" },
            { label: "Subject", key: "subject" },
            { label: "Priority", key: "priorityText" },
            { label: "Status", key: "statusText" },
            { label: "Assigned To", key: "assigned" },
          ]}
          data={rows}
          isLoading={loading}
          showAdd={false}
          showImport={false}
          showExport={false}
          showView={false}
          showEdit={!deleted && actions.showEdit}
          showDelete={!deleted && actions.showDelete}
          showDeleted={!deleted}
          showReset={deleted && actions.canReset}
          toolbarActions={!deleted && actions.showAdd ? <ShortcutButton label="Add Ticket" keyCode="N" onClick={() => navigate("/supporttickets/addedit")} /> : undefined}
          onEdit={(row) => navigate(`/supporttickets/addedit/${row.id}`)}
          onShowDeleted={() => navigate("/supporttickets/deletedentries")}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ticket ${row.ticketno}?`)) return;
            try { await remove({ variables: { id: row.id } }); say("Ticket deleted."); await refetch(); }
            catch (e: any) { say(e?.message || "Delete failed.", "error"); }
          }}
          onReset={async (row) => {
            if (!window.confirm(`Restore ticket ${row.ticketno}?`)) return;
            try { await reset({ variables: { id: row.id } }); say("Ticket restored."); navigate("/supporttickets"); }
            catch (e: any) { say(e?.message || "Restore failed.", "error"); }
          }}
          entriesOptions={[10, 25, 50]}
          defaultEntriesPerPage={25}
        />
      </div>
    </HomeLayout>
  );
};

export default SupportTickets;
