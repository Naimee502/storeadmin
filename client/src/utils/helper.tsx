// ✅ converts Date or string to DD/MM/YYYY
export const normalizeToDMY = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// ✅ converts Date or string to YYYY-MM-DD
export const normalizeToYMD = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ✅ converts Date or string to MM/DD/YYYY
export const normalizeToMDY = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

// ✅ Date Shortcut (still returns DMY format unless you change)
export const applyDateShortcut = (
  type: "daily" | "weekly" | "monthly" | "yearly"
): { from: string | null; to: string | null } => {
  const today = new Date();
  const to = normalizeToDMY(today);
  let from = to;

  if (type === "weekly") {
    const f = new Date();
    f.setDate(today.getDate() - 6);
    from = normalizeToDMY(f);
  } else if (type === "monthly") {
    const f = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    from = normalizeToDMY(f);
  } else if (type === "yearly") {
    const f = new Date(today.getFullYear(), 0, 1);
    from = normalizeToDMY(f);
  }

  return { from, to };
};
