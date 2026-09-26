/**
 * First in, last out, worked and break minutes for one day's attendance,
 * rebuilt from its punches. Shared by the punch mutation and the auto
 * punch-out job so a punch-out counts the same whichever of them records it.
 */
export const recomputeAttendanceTotals = (log: any) => {
  const sorted = [...(log.punches || [])].sort(
    (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;
  let workMs = 0;
  let breakMs = 0;
  let openIn: Date | null = null;
  let openBreak: Date | null = null;
  for (const p of sorted) {
    if (p.status === false) continue;
    const t = new Date(p.timestamp);
    if (p.type === "in") { if (!firstIn) firstIn = t; openIn = t; }
    else if (p.type === "out") { lastOut = t; if (openIn) { workMs += t.getTime() - openIn.getTime(); openIn = null; } }
    else if (p.type === "breakstart") { openBreak = t; }
    else if (p.type === "breakend") { if (openBreak) { breakMs += t.getTime() - openBreak.getTime(); openBreak = null; } }
  }
  log.firstPunchIn = firstIn || log.firstPunchIn;
  log.lastPunchOut = lastOut || log.lastPunchOut;
  log.totalWorkMinutes = Math.round(workMs / 60000);
  log.totalBreakMinutes = Math.round(breakMs / 60000);
  if (log.status === "absent") log.status = "present";
  return log;
};

/** The punch-in that is still open (no punch-out after it), or null. */
export const openPunchIn = (punches: any[] = []) => {
  const sorted = [...punches].sort(
    (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  let open: any = null;
  for (const p of sorted) {
    if (p.status === false) continue;
    if (p.type === "in") open = p;
    else if (p.type === "out") open = null;
  }
  return open;
};
