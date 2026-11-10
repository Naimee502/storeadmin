import { useMemo, useState } from "react";
import HomeLayout from "../../layouts/home";
import ReportTable from "../../components/reporttable";
import { unitFactor, variantOf } from "../../components/mfglines";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { mfgNo, useBomsQuery, useMfgBranch, useWorkOrdersQuery } from "../../graphql/hooks/manufacturing";
import { useOfflineStock } from "../../offline/billing";
import { materialNeeds } from "../workorders/addedit";

const idOf = (v: any) => (v && typeof v === "object" ? v.id : v) || null;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Raw material the open work orders still need, against branch stock (worked out on the device). */
const MaterialPlanning = () => {
  const branchId = useMfgBranch();
  const { data: woData, loading } = useWorkOrdersQuery();
  const { data: bomsData } = useBomsQuery();
  const { data: productData } = useProductServicesQuery();
  const products = useOfflineStock(productData?.getProductServices ?? [], branchId);
  const boms = bomsData?.getBoms || [];
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [applied, setApplied] = useState<Record<string, any>>({});

  const open = (woData?.getWorkOrders || []).filter((w: any) => ["planned", "inprogress"].includes(w.workStatus || "planned"));
  const rows = useMemo(() => {
    const total = new Map<string, any>();
    for (const w of open) {
      if (applied.workorderid && w.id !== applied.workorderid) continue;
      const pid = idOf(w.productserviceid);
      const vid = idOf(w.variantid);
      const pending = Math.max(Number(w.qty) - Number(w.qtyproduced || 0), 0) * unitFactor(variantOf(products, pid, vid), idOf(w.salesunitid));
      if (!pending) continue;
      const bom = boms.find((b: any) => b.id === w.bomid);
      const list = bom ? [{ ...bom, isdefault: true }, ...boms.filter((b: any) => idOf(b.productserviceid) !== pid)] : boms;
      for (const n of materialNeeds(list, products, pid, vid, pending)) {
        const t = total.get(n.key) || { ...n, need: 0, orders: new Set<string>() };
        t.need += n.need;
        t.orders.add(mfgNo(w, "WO-"));
        total.set(n.key, t);
      }
    }
    return [...total.values()]
      .map((t) => {
        const short = Math.max(t.need - t.stock, 0);
        return {
          item: t.name, unit: t.unit, need: r3(t.need), stock: r3(t.stock), short: r3(short), rate: t.rate,
          value: Math.round(short * t.rate * 100) / 100, orders: [...t.orders].join(", "), status: short > 0 ? "Short" : "OK",
        };
      })
      .filter((r) => !applied.onlyShort || r.short > 0)
      .sort((a, b) => b.short - a.short);
  }, [open, boms, products, applied]);

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <ReportTable
          moduleId="materialplanning"
          title="Material Planning — Open Work Orders"
          columns={[
            { label: "Raw Material", key: "item" },
            { label: "Unit", key: "unit" },
            { label: "Needed", key: "need", numeric: true },
            { label: "In Stock", key: "stock", numeric: true },
            { label: "To Buy", key: "short", numeric: true },
            { label: "Purchase Rate", key: "rate", numeric: true },
            { label: "Buy Value (₹)", key: "value", numeric: true },
            { label: "For Work Orders", key: "orders" },
            { label: "Status", key: "status" },
          ]}
          data={rows}
          filterFields={[
            { name: "workorderid", label: "Work Order", type: "select", searchable: true, options: open.map((w: any) => ({ value: w.id, label: mfgNo(w, "WO-") })) },
            { name: "onlyShort", label: "Show", type: "select", options: [{ value: "1", label: "Only Short Items" }] },
          ]}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={applied}
          setAppliedFilters={setApplied}
          isLoading={loading}
          showExport
          showCsv
          showPdf
          exportFileName="MaterialPlanning"
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default MaterialPlanning;
