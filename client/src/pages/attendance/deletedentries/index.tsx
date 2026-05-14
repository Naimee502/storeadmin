import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useQuery, useMutation } from "@apollo/client";

import HomeLayout from "../../../layouts/home";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/tabs";

import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

import {
  GET_DELETED_ATTENDANCE_LOGS,
  GET_DELETED_HOLIDAYS,
  GET_DELETED_LEAVE_TYPES,
  GET_DELETED_LEAVE_REQUESTS,
  GET_DELETED_LEAVE_BALANCES,
} from "../../../graphql/queries/attendance";
import {
  RESET_ATTENDANCE_LOG,
  RESET_HOLIDAY,
  RESET_LEAVE_TYPE,
  RESET_LEAVE_REQUEST,
  RESET_LEAVE_BALANCE,
} from "../../../graphql/mutations/attendance";

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const cap = (s?: string | null) => {
  if (!s) return "-";
  const str = String(s);
  if (!str.length) return "-";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const ACTIVE_REFETCH_QUERIES = [
  "GetAttendanceLogs",
  "GetAttendanceSummary",
  "GetAttendancePunches",
  "GetHolidays",
  "GetLeaveTypes",
  "GetLeaveRequests",
  "GetLeaveBalances",
];

type DeletedTab = "logs" | "holidays" | "leavetypes" | "leaverequests" | "balances";

const DeletedAttendanceEntries: React.FC = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "attendance"));
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { type, admin, branch } = useAppSelector((s: any) => s.auth);
  const adminId =
    type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : undefined;
  const branchId = useAppSelector((s: any) => s.selectedBranch?.branchId);

  const fromState = (location.state as any)?.from as DeletedTab | undefined;
  const validFrom: DeletedTab | undefined =
    fromState && ["logs", "holidays", "leavetypes", "leaverequests", "balances"].includes(fromState)
      ? fromState
      : undefined;
  const [tab, setTab] = useState<DeletedTab>(validFrom || "logs");

  const logsQ = useQuery(GET_DELETED_ATTENDANCE_LOGS, {
    variables: { filter: { adminid: adminId, branchid: branchId } },
    skip: !adminId,
    fetchPolicy: "cache-and-network",
  });
  const holidaysQ = useQuery(GET_DELETED_HOLIDAYS, {
    variables: { filter: { adminid: adminId } },
    skip: !adminId,
    fetchPolicy: "cache-and-network",
  });
  const leaveTypesQ = useQuery(GET_DELETED_LEAVE_TYPES, {
    variables: { adminid: adminId },
    skip: !adminId,
    fetchPolicy: "cache-and-network",
  });
  const leaveReqsQ = useQuery(GET_DELETED_LEAVE_REQUESTS, {
    variables: { filter: { adminid: adminId, branchid: branchId } },
    skip: !adminId,
    fetchPolicy: "cache-and-network",
  });
  const balancesQ = useQuery(GET_DELETED_LEAVE_BALANCES, {
    variables: { filter: { adminid: adminId } },
    skip: !adminId,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!adminId) return;
    logsQ.refetch();
    holidaysQ.refetch();
    leaveTypesQ.refetch();
    leaveReqsQ.refetch();
    balancesQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, branchId]);

  const [resetLogMut] = useMutation(RESET_ATTENDANCE_LOG, {
    refetchQueries: ["GetDeletedAttendanceLogs", ...ACTIVE_REFETCH_QUERIES],
    awaitRefetchQueries: true,
  });
  const [resetHolidayMut] = useMutation(RESET_HOLIDAY, {
    refetchQueries: ["GetDeletedHolidays", ...ACTIVE_REFETCH_QUERIES],
    awaitRefetchQueries: true,
  });
  const [resetLeaveTypeMut] = useMutation(RESET_LEAVE_TYPE, {
    refetchQueries: ["GetDeletedLeaveTypes", ...ACTIVE_REFETCH_QUERIES],
    awaitRefetchQueries: true,
  });
  const [resetLeaveReqMut] = useMutation(RESET_LEAVE_REQUEST, {
    refetchQueries: ["GetDeletedLeaveRequests", ...ACTIVE_REFETCH_QUERIES],
    awaitRefetchQueries: true,
  });
  const [resetBalanceMut] = useMutation(RESET_LEAVE_BALANCE, {
    refetchQueries: ["GetDeletedLeaveBalances", ...ACTIVE_REFETCH_QUERIES],
    awaitRefetchQueries: true,
  });

  const notify = (msg: string, t: "success" | "error" = "success") =>
    dispatch(showMessage({ message: msg, type: t }));

  const goBack = (returnTab: string) =>
    navigate("/attendance", { state: { tab: returnTab } });

  const logRows = (logsQ.data?.getDeletedAttendanceLogs ?? []).map((l: any, i: number) => ({
    ...l,
    seqNo: i + 1,
    staffName: cap(l.staffid?.name),
    staffCode: l.staffid?.staffcode ?? "-",
    firstIn: fmtDateTime(l.firstPunchIn),
    lastOut: fmtDateTime(l.lastPunchOut),
    statusLabel: cap(l.status),
  }));

  const holidayRows = (holidaysQ.data?.getDeletedHolidays ?? []).map((h: any, i: number) => ({
    ...h,
    seqNo: i + 1,
    name: cap(h.name),
    type: cap(h.type),
    description: h.description ?? "-",
  }));

  const leaveTypeRows = (leaveTypesQ.data?.getDeletedLeaveTypes ?? []).map((lt: any, i: number) => ({
    ...lt,
    seqNo: i + 1,
    name: cap(lt.name),
    code: cap(lt.code),
    accrualType: cap(lt.accrualType),
    paid: lt.isPaid ? "Yes" : "No",
  }));

  const requestRows = (leaveReqsQ.data?.getDeletedLeaveRequests ?? []).map((r: any, i: number) => ({
    ...r,
    seqNo: i + 1,
    staffName: cap(r.staffid?.name),
    typeName: cap(r.leavetypeid?.name),
    range: `${r.fromDate} → ${r.toDate}`,
    status: cap(r.status),
    reason: cap(r.reason),
  }));

  const balanceRows = (balancesQ.data?.getDeletedLeaveBalances ?? []).map((b: any, i: number) => ({
    ...b,
    seqNo: i + 1,
    staffName: cap(b.staffid?.name),
    typeName: cap(b.leavetypeid?.name),
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h1 className="text-2xl font-semibold mb-4">Deleted Attendance Entries</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as DeletedTab)}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="logs">Daily Logs</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            <TabsTrigger value="leavetypes">Leave Types</TabsTrigger>
            <TabsTrigger value="leaverequests">Leave Requests</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <DataTable
          {...actions}
              title="Deleted Attendance Logs"
              columns={[
                { label: "Seq", key: "seqNo" },
                { label: "Date", key: "date" },
                { label: "Staff", key: "staffName" },
                { label: "Code", key: "staffCode" },
                { label: "Status", key: "statusLabel" },
                { label: "First In", key: "firstIn" },
                { label: "Last Out", key: "lastOut" },
              ]}
              data={logRows}
              showAdd={false}
              showEdit={false}
              showDelete={false}
              showDeleted={false}
              showReset
              showView={false}
              showImport={false}
              showExport={false}
              onReset={async (row) => {
                if (!window.confirm(`Restore attendance log for ${row.staffName} on ${row.date}?`))
                  return;
                try {
                  await resetLogMut({ variables: { id: row.id } });
                  notify("Log restored.");
                  goBack("logs");
                } catch {
                  notify("Failed to restore log.", "error");
                }
              }}
              isLoading={logsQ.loading}
              defaultEntriesPerPage={10}
            />
          </TabsContent>

          <TabsContent value="holidays">
            <DataTable
          {...actions}
              title="Deleted Holidays"
              columns={[
                { label: "Seq", key: "seqNo" },
                { label: "Date", key: "date" },
                { label: "Name", key: "name" },
                { label: "Type", key: "type" },
                { label: "Description", key: "description" },
              ]}
              data={holidayRows}
              showAdd={false}
              showEdit={false}
              showDelete={false}
              showDeleted={false}
              showReset
              showView={false}
              showImport={false}
              showExport={false}
              onReset={async (row) => {
                if (!window.confirm(`Restore holiday "${row.name}"?`)) return;
                try {
                  await resetHolidayMut({ variables: { id: row.id } });
                  notify("Holiday restored.");
                  goBack("holidays");
                } catch {
                  notify("Failed to restore holiday.", "error");
                }
              }}
              isLoading={holidaysQ.loading}
              defaultEntriesPerPage={10}
            />
          </TabsContent>

          <TabsContent value="leavetypes">
            <DataTable
          {...actions}
              title="Deleted Leave Types"
              columns={[
                { label: "Seq", key: "seqNo" },
                { label: "Code", key: "code" },
                { label: "Name", key: "name" },
                { label: "Days/Yr", key: "totalDaysPerYear" },
                { label: "Paid", key: "paid" },
                { label: "Accrual", key: "accrualType" },
              ]}
              data={leaveTypeRows}
              showAdd={false}
              showEdit={false}
              showDelete={false}
              showDeleted={false}
              showReset
              showView={false}
              showImport={false}
              showExport={false}
              onReset={async (row) => {
                if (!window.confirm(`Restore leave type "${row.name}"?`)) return;
                try {
                  await resetLeaveTypeMut({ variables: { id: row.id } });
                  notify("Leave type restored.");
                  goBack("leavetypes");
                } catch {
                  notify("Failed to restore.", "error");
                }
              }}
              isLoading={leaveTypesQ.loading}
              defaultEntriesPerPage={10}
            />
          </TabsContent>

          <TabsContent value="leaverequests">
            <DataTable
          {...actions}
              title="Deleted Leave Requests"
              columns={[
                { label: "Seq", key: "seqNo" },
                { label: "Staff", key: "staffName" },
                { label: "Type", key: "typeName" },
                { label: "Dates", key: "range" },
                { label: "Days", key: "totalDays" },
                { label: "Status", key: "status" },
                { label: "Reason", key: "reason" },
              ]}
              data={requestRows}
              showAdd={false}
              showEdit={false}
              showDelete={false}
              showDeleted={false}
              showReset
              showView={false}
              showImport={false}
              showExport={false}
              onReset={async (row) => {
                if (!window.confirm("Restore this leave request?")) return;
                try {
                  await resetLeaveReqMut({ variables: { id: row.id } });
                  notify("Leave request restored.");
                  goBack("leaverequests");
                } catch {
                  notify("Failed to restore.", "error");
                }
              }}
              isLoading={leaveReqsQ.loading}
              defaultEntriesPerPage={10}
            />
          </TabsContent>

          <TabsContent value="balances">
            <DataTable
          {...actions}
              title="Deleted Leave Balances"
              columns={[
                { label: "Seq", key: "seqNo" },
                { label: "Staff", key: "staffName" },
                { label: "Type", key: "typeName" },
                { label: "Year", key: "year" },
                { label: "Allocated", key: "allocated" },
                { label: "Used", key: "used" },
                { label: "Pending", key: "pending" },
                { label: "C/F", key: "carriedForward" },
                { label: "Balance", key: "balance" },
              ]}
              data={balanceRows}
              showAdd={false}
              showEdit={false}
              showDelete={false}
              showDeleted={false}
              showReset
              showView={false}
              showImport={false}
              showExport={false}
              onReset={async (row) => {
                if (!window.confirm(`Restore balance for ${row.staffName} (${row.typeName}) ${row.year}?`)) return;
                try {
                  await resetBalanceMut({ variables: { id: row.id } });
                  notify("Balance restored.");
                  goBack("balances");
                } catch {
                  notify("Failed to restore.", "error");
                }
              }}
              isLoading={balancesQ.loading}
              defaultEntriesPerPage={10}
            />
          </TabsContent>
        </Tabs>
      </div>
    </HomeLayout>
  );
};

export default DeletedAttendanceEntries;
