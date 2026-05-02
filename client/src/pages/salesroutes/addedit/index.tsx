import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import {
  useCreateSalesRoute,
  useUpdateSalesRoute,
  useGetSalesRouteById,
} from "../../../graphql/hooks/salesroutes";
import { useStaffQuery } from "../../../graphql/hooks/staffaccounts";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_DAYS = [
  { key: "mon", label: "Monday",    short: "Mon" },
  { key: "tue", label: "Tuesday",   short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday",  short: "Thu" },
  { key: "fri", label: "Friday",    short: "Fri" },
  { key: "sat", label: "Saturday",  short: "Sat" },
  { key: "sun", label: "Sunday",    short: "Sun" },
];

const DAY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  mon: { bg: "bg-blue-50",   border: "border-blue-300",  text: "text-blue-700",  badge: "bg-blue-100 text-blue-700" },
  tue: { bg: "bg-purple-50", border: "border-purple-300",text: "text-purple-700",badge: "bg-purple-100 text-purple-700" },
  wed: { bg: "bg-green-50",  border: "border-green-300", text: "text-green-700", badge: "bg-green-100 text-green-700" },
  thu: { bg: "bg-orange-50", border: "border-orange-300",text: "text-orange-700",badge: "bg-orange-100 text-orange-700" },
  fri: { bg: "bg-red-50",    border: "border-red-300",   text: "text-red-700",   badge: "bg-red-100 text-red-700" },
  sat: { bg: "bg-yellow-50", border: "border-yellow-300",text: "text-yellow-700",badge: "bg-yellow-100 text-yellow-700" },
  sun: { bg: "bg-gray-50",   border: "border-gray-300",  text: "text-gray-700",  badge: "bg-gray-100 text-gray-700" },
};

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DayWiseEntry {
  day: string;
  accounts: string[]; // account IDs
  visitorder: number;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const SalesRouteAddEdit: React.FC = () => {
  const navigate  = useNavigate();
  const dispatch  = useAppDispatch();
  const { id }    = useParams<{ id?: string }>();
  const isEdit    = Boolean(id);

  const { admin, branch, type } = useAppSelector((state: any) => state.auth);
  const selectedBranchId = useAppSelector((state: any) => state.selectedBranch.branchId);

  const adminId  = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchId = selectedBranchId || branch?.id;

  // ── Form state ────────────────────────────────────────────────────────────────
  const [routename,     setRouteName]     = useState("");
  const [description,   setDescription]   = useState("");
  const [salesmanid,    setSalesmanId]    = useState("");
  const [visitdays,     setVisitdays]     = useState<string[]>([]);
  const [dayWiseAccounts, setDayWiseAccounts] = useState<DayWiseEntry[]>([]);
  const [expandedDay,   setExpandedDay]   = useState<string | null>(null);
  const [partySearch,   setPartySearch]   = useState<Record<string, string>>({});

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const { data: staffData }  = useStaffQuery();
  const { data: accountsData } = useAccountsQuery(true);
  const { data: editData, loading: loadingEdit } = useGetSalesRouteById(id || "", adminId, branchId);

  const { createSalesRoute, loading: creating } = useCreateSalesRoute();
  const { updateSalesRoute, loading: updating }  = useUpdateSalesRoute();
  const loading = creating || updating;

  const salesmen = useMemo(
    () => (staffData?.getStaffAccounts || []).filter((s: any) => s.role === "salesman" && s.status),
    [staffData]
  );
  const allAccounts = useMemo(
    () => (accountsData?.getAccounts || []).filter((a: any) => a.type === "customer"),
    [accountsData]
  );

  // ── Populate on edit ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEdit && editData?.getSalesRouteById) {
      const route = editData.getSalesRouteById;
      setRouteName(route.routename || "");
      setDescription(route.description || "");
      setSalesmanId(route.salesmanid?.id || "");

      const days: string[] = route.visitdays || [];
      setVisitdays(days);

      if (route.dayWiseAccounts?.length) {
        setDayWiseAccounts(
          route.dayWiseAccounts.map((dw: any) => ({
            day: dw.day,
            visitorder: dw.visitorder ?? 0,
            accounts: (dw.accounts || []).map((a: any) => a.id || a),
          }))
        );
      } else if (days.length) {
        setDayWiseAccounts(days.map((d) => ({ day: d, accounts: [], visitorder: 0 })));
      }
    }
  }, [isEdit, editData]);

  // ── Day toggle ────────────────────────────────────────────────────────────────
  const toggleDay = (day: string) => {
    setVisitdays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      // Sync dayWiseAccounts
      setDayWiseAccounts((dwa) => {
        if (!prev.includes(day)) {
          // Adding day — create entry if missing
          return dwa.some((e) => e.day === day)
            ? dwa
            : [...dwa, { day, accounts: [], visitorder: dwa.length }];
        } else {
          // Removing day — keep data but remove from list
          return dwa.filter((e) => e.day !== day);
        }
      });
      if (!prev.includes(day)) setExpandedDay(day);
      return next;
    });
  };

  const getDayEntry = (day: string): DayWiseEntry =>
    dayWiseAccounts.find((e) => e.day === day) || { day, accounts: [], visitorder: 0 };

  const toggleAccountForDay = (day: string, accountId: string) => {
    setDayWiseAccounts((prev) => {
      const existing = prev.find((e) => e.day === day);
      if (!existing) {
        return [...prev, { day, accounts: [accountId], visitorder: prev.length }];
      }
      return prev.map((e) =>
        e.day === day
          ? {
              ...e,
              accounts: e.accounts.includes(accountId)
                ? e.accounts.filter((a) => a !== accountId)
                : [...e.accounts, accountId],
            }
          : e
      );
    });
  };

  // Select / deselect all accounts for a day
  const selectAllForDay = (day: string) => {
    const search = (partySearch[day] || "").toLowerCase();
    const filtered = allAccounts.filter(
      (a: any) =>
        a.name.toLowerCase().includes(search) ||
        (a.accountcode || "").toLowerCase().includes(search)
    );
    const allIds = filtered.map((a: any) => a.id);
    setDayWiseAccounts((prev) => {
      const existing = prev.find((e) => e.day === day);
      if (!existing) return [...prev, { day, accounts: allIds, visitorder: prev.length }];
      const alreadyAll = allIds.every((id) => existing.accounts.includes(id));
      return prev.map((e) =>
        e.day === day
          ? { ...e, accounts: alreadyAll ? e.accounts.filter((a) => !allIds.includes(a)) : [...new Set([...e.accounts, ...allIds])] }
          : e
      );
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routename.trim()) {
      dispatch(showMessage({ message: "Route name is required.", type: "error" }));
      return;
    }
    if (!salesmanid) {
      dispatch(showMessage({ message: "Please assign a salesman.", type: "error" }));
      return;
    }
    if (visitdays.length === 0) {
      dispatch(showMessage({ message: "Select at least one visit day.", type: "error" }));
      return;
    }

    // Build unified accounts (all accounts across all days)
    const allAccountIds = Array.from(
      new Set(dayWiseAccounts.flatMap((e) => e.accounts))
    );

    const payload = {
      routename,
      description,
      visitdays,
      salesmanid,
      accounts: allAccountIds,
      dayWiseAccounts: dayWiseAccounts.map(({ day, accounts, visitorder }) => ({
        day,
        visitorder,
        accounts,
      })),
    };

    try {
      if (isEdit && id) {
        await updateSalesRoute({ variables: { id, input: payload } });
        dispatch(showMessage({ message: "Sales Route updated successfully!", type: "success" }));
      } else {
        await createSalesRoute({
          variables: { input: { ...payload, adminid: adminId, branchid: branchId } },
        });
        dispatch(showMessage({ message: "Sales Route created successfully!", type: "success" }));
      }
      navigate("/salesroutes");
    } catch (error: any) {
      dispatch(showMessage({ message: error.message || "Failed to save route", type: "error" }));
    }
  };

  // ── Total parties ─────────────────────────────────────────────────────────────
  const totalUniqueParties = useMemo(
    () => new Set(dayWiseAccounts.flatMap((e) => e.accounts)).size,
    [dayWiseAccounts]
  );

  if (isEdit && loadingEdit) {
    return (
      <HomeLayout>
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading route details...</p>
          </div>
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-10">
        <form onSubmit={handleSubmit}>

          {/* ── Header ─────────────────────────────────────────────────────────── */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold">
              {isEdit ? "Edit Sales Route" : "Add Sales Route"}
            </h2>
            <div className="flex gap-2 text-sm">
              <span className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 font-medium">
                📅 {visitdays.length} Day{visitdays.length !== 1 ? "s" : ""}
              </span>
              <span className="bg-green-100 text-green-800 rounded-full px-3 py-1 font-medium">
                🏪 {totalUniqueParties} Part{totalUniqueParties !== 1 ? "ies" : "y"}
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {/* ── Section 1: Basic Info ────────────────────────────────────────────── */}
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm sm:text-base font-medium px-2">Route Information</legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormField
                label="Route Name *"
                name="routename"
                type="text"
                value={routename}
                onChange={(e: any) => setRouteName(e.target.value)}
                placeholder="e.g. North Zone Route"
                required
              />

              <FormField
                label="Assign Salesman *"
                name="salesmanid"
                type="select"
                value={salesmanid}
                onChange={(e: any) => setSalesmanId(e.target.value)}
                searchable={true}
                options={salesmen.map((s: any) => ({
                  value: s.id,
                  label: `${s.name} (${s.staffcode})`,
                }))}
                required
              />

              <FormField
                label="Description / Notes"
                name="description"
                type="text"
                value={description}
                onChange={(e: any) => setDescription(e.target.value)}
                placeholder="Route details..."
              />
            </div>
          </fieldset>

          {/* ── Section 2: Visit Days ─────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Select Visit Days</legend>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map(({ key, label, short }) => {
                const active = visitdays.includes(key);
                const col = DAY_COLORS[key];
                const count = getDayEntry(key).accounts.length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={`
                      relative flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 font-semibold text-sm
                      transition-all duration-200 cursor-pointer select-none
                      ${active
                        ? `${col.bg} ${col.border} ${col.text} shadow-sm scale-105`
                        : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                      }
                    `}
                  >
                    <span className="text-base font-bold">{short}</span>
                    <span className={`text-[10px] ${active ? col.text : "text-gray-400"}`}>{label}</span>
                    {active && count > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.badge}`}>
                        {count}
                      </span>
                    )}
                    {active && (
                      <span className="absolute -top-1 -left-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </button>
                );
              })}
            </div>
            {visitdays.length === 0 && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Please select at least one visit day to assign parties.
              </p>
            )}
          </fieldset>

          {/* ── Section 3: Day-wise Party Assignment ─────────────────────────────── */}
          {visitdays.length > 0 && (
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm sm:text-base font-medium px-2">
                Day-wise Party Assignment
                <span className="ml-3 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {totalUniqueParties} unique {totalUniqueParties === 1 ? "party" : "parties"} total
                </span>
              </legend>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {ALL_DAYS.filter((d) => visitdays.includes(d.key)).map(({ key, label, short }) => {
                  const col = DAY_COLORS[key];
                  const entry = getDayEntry(key);
                  const isOpen = expandedDay === key;
                  const search = partySearch[key] || "";
                  const filteredAccounts = allAccounts.filter((a: any) => {
                    if (!search) return true;
                    return (
                      a.name.toLowerCase().includes(search.toLowerCase()) ||
                      (a.accountcode || "").toLowerCase().includes(search.toLowerCase())
                    );
                  });
                  const allFilteredSelected = filteredAccounts.length > 0 &&
                    filteredAccounts.every((a: any) => entry.accounts.includes(a.id));

                  return (
                    <div key={key} className={`rounded-xl border-2 overflow-hidden transition-all ${col.border}`}>
                      {/* Day header (accordion toggle) */}
                      <button
                        type="button"
                        onClick={() => setExpandedDay(isOpen ? null : key)}
                        className={`w-full flex items-center justify-between px-4 py-3 ${col.bg} hover:brightness-95 transition`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full ${col.badge} font-bold text-sm flex items-center justify-center`}>
                            {short}
                          </span>
                          <div className="text-left">
                            <p className={`font-semibold text-sm ${col.text}`}>{label}</p>
                            <p className="text-xs text-gray-500">
                              {entry.accounts.length > 0
                                ? `${entry.accounts.length} ${entry.accounts.length === 1 ? "party" : "parties"} assigned`
                                : "No parties assigned yet"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.accounts.length > 0 && (
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${col.badge}`}>
                              {entry.accounts.length}
                            </span>
                          )}
                          <svg
                            className={`w-4 h-4 ${col.text} transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded: party list */}
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-white">
                          {/* Search & select-all toolbar */}
                          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <input
                              type="text"
                              value={search}
                              onChange={(e) => setPartySearch((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder="Search parties..."
                              className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <button
                              type="button"
                              onClick={() => selectAllForDay(key)}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition whitespace-nowrap
                                ${allFilteredSelected
                                  ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                                  : `${col.bg} ${col.border} ${col.text} hover:brightness-95`
                                }`}
                            >
                              {allFilteredSelected ? "Deselect All" : "Select All"}
                            </button>
                          </div>

                          {/* Party list */}
                          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                            {filteredAccounts.length === 0 ? (
                              <p className="text-center text-gray-400 text-xs py-6">
                                {allAccounts.length === 0 ? "No customer accounts found." : "No results for your search."}
                              </p>
                            ) : (
                              filteredAccounts.map((acc: any) => {
                                const checked = entry.accounts.includes(acc.id);
                                return (
                                  <label
                                    key={acc.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                                      ${checked ? col.bg : "hover:bg-gray-50"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleAccountForDay(key, acc.id)}
                                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium truncate ${checked ? col.text : "text-gray-700"}`}>
                                        {acc.name}
                                      </p>
                                      <p className="text-[11px] text-gray-400">{acc.accountcode}</p>
                                    </div>
                                    {checked && (
                                      <svg className={`w-4 h-4 flex-shrink-0 ${col.text}`} fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </label>
                                );
                              })
                            )}
                          </div>

                          {/* Footer count */}
                          {entry.accounts.length > 0 && (
                            <div className={`px-4 py-2 ${col.bg} border-t ${col.border} flex items-center justify-between`}>
                              <p className={`text-xs font-semibold ${col.text}`}>
                                {entry.accounts.length} {entry.accounts.length === 1 ? "party" : "parties"} selected for {label}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setDayWiseAccounts((prev) =>
                                    prev.map((e) => (e.day === key ? { ...e, accounts: [] } : e))
                                  )
                                }
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* ── Summary Card ────────────────────────────────────────────────────── */}
          {visitdays.length > 0 && (
            <fieldset className="border rounded-xl p-4">
              <legend className="text-sm sm:text-base font-medium px-2 text-blue-700">📋 Route Summary</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ALL_DAYS.filter((d) => visitdays.includes(d.key)).map(({ key, short }) => {
                  const count = getDayEntry(key).accounts.length;
                  const col = DAY_COLORS[key];
                  return (
                    <div key={key} className={`rounded-lg px-3 py-2 ${col.bg} border ${col.border} flex items-center justify-between`}>
                      <span className={`text-xs font-semibold ${col.text}`}>{short}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.badge}`}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}
          {/* ── Action Buttons ───────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" type="button" onClick={() => navigate("/salesroutes")}>
              Cancel
            </Button>
            <Button variant="outline" type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update Route" : "Save Route"}
            </Button>
          </div>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default SalesRouteAddEdit;
