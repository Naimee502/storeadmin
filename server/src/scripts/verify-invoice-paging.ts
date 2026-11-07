// Read-only check: paged sales invoices must match the full list.
// Usage: VERIFY_TOKEN="<bearer token>" npx ts-node src/scripts/verify-invoice-paging.ts
// Optional: VERIFY_URL (default http://localhost:4000/graphql), VERIFY_PAGE_SIZE (default 25).
// Writes nothing; it only sends queries.

const url = process.env.VERIFY_URL || "http://localhost:4000/graphql";
const token = process.env.VERIFY_TOKEN || "";
const pageSize = Number(process.env.VERIFY_PAGE_SIZE || 25);

async function gql<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables }),
  });
  const json: any = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

const FULL = `query Full($filter: SalesInvoiceFilterInput) { getSalesInvoices(filter: $filter) { id billnumber billdate totalamount paymenttype cancelStatus deliveryStatus status productservice { qty } } }`;
const PAGE = `query Page($filter: SalesInvoiceFilterInput, $page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]) {
  getSalesInvoicesPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) { total items { id billnumber } }
}`;

// Same text the list shows for each filterable column.
function shownValues(inv: any): Record<string, string> {
  const d = String(inv.billdate || "");
  const qty = (inv.productservice || []).reduce((n: number, p: any) => n + (Number(p.qty) || 0), 0);
  const order = inv.cancelStatus === "cancelled"
    ? "cancelled"
    : ["dispatched", "delivered"].includes(inv.deliveryStatus) ? inv.deliveryStatus : "confirmed";
  return {
    billtype_billnumber: `INV-${inv.billnumber}`,
    billdate: `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`,
    totalamount: String(inv.totalamount),
    paymenttype: String(inv.paymenttype || ""),
    totalitem: String((inv.productservice || []).length),
    totalqty: String(qty),
    deliveryDisplay: order,
    status: inv.cancelStatus === "cancelled" ? "Cancelled" : inv.status ? "Active" : "Inactive",
  };
}

async function main() {
  const filter = { includeCancelled: true };
  const full: any[] = (await gql<any>(FULL, { filter })).getSalesInvoices;
  const fullIds = full.map((i) => String(i.id));
  const fullSet = new Set(fullIds);
  console.log(`full list: ${fullIds.length} invoices`);

  const pageIds: string[] = [];
  let total = -1;
  const pages = Math.max(1, Math.ceil(fullIds.length / pageSize));
  for (let page = 1; page <= pages; page++) {
    const r = (await gql<any>(PAGE, { filter, page, pageSize, search: "" })).getSalesInvoicesPage;
    total = r.total;
    pageIds.push(...r.items.map((i: any) => String(i.id)));
  }
  console.log(`paged total: ${total}, collected: ${pageIds.length}`);

  const failures: string[] = [];
  if (total !== fullIds.length) failures.push(`total mismatch: paged ${total} vs full ${fullIds.length}`);
  if (new Set(pageIds).size !== pageIds.length) failures.push("duplicate ids across pages");
  const missing = fullIds.filter((id) => !pageIds.includes(id));
  const extra = pageIds.filter((id) => !fullSet.has(id));
  if (missing.length) failures.push(`missing from pages: ${missing.length}`);
  if (extra.length) failures.push(`extra in pages: ${extra.length}`);

  if (full.length) {
    const sample = full[Math.floor(full.length / 2)];
    const s = (await gql<any>(PAGE, { filter, page: 1, pageSize, search: String(sample.billnumber) })).getSalesInvoicesPage;
    if (!s.items.some((i: any) => String(i.id) === String(sample.id)))
      failures.push(`search did not find bill ${sample.billnumber}`);
    else console.log(`search OK for bill ${sample.billnumber}`);
  }

  if (full.length) {
    const sample = full[0];
    for (const [key, value] of Object.entries(shownValues(sample))) {
      if (!value) continue;
      let found = false;
      let page = 1;
      while (!found) {
        const r = (await gql<any>(PAGE, { filter, page, pageSize: 200, search: "", columnFilters: [{ key, value }] }))
          .getSalesInvoicesPage;
        found = r.items.some((i: any) => String(i.id) === String(sample.id));
        if (found || page * 200 >= r.total) break;
        page++;
      }
      if (found) console.log(`column filter OK: ${key} = "${value}"`);
      else failures.push(`column filter ${key} = "${value}" did not find bill ${sample.billnumber}`);
    }
  }

  if (failures.length) {
    console.log("FAILED:\n- " + failures.join("\n- "));
    process.exitCode = 1;
  } else {
    console.log("PASSED: totals, full id set, no duplicates, search, column filters.");
  }
}

main().catch((e) => {
  console.error("Verification error:", e.message || e);
  process.exitCode = 1;
});
