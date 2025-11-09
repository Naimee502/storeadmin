export const normalizeToDMY = (date: Date | string | null): string | null => {
  if (!date) return null;
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const applyDateShortcut = (
  type: "daily" | "weekly" | "monthly" | "yearly"
): { from: string | null; to: string | null } => {
  const today = new Date();
  const to = normalizeToDMY(today);
  let from: string | null = to;

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
