import { useEffect, useMemo, useState } from "react";
import { useApolloClient } from "@apollo/client";
import Modal from "../modal";
import FormField from "../formfiled";
import Button from "../button";
import { useAppDispatch } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { useProductServiceMutations } from "../../graphql/hooks/products";
import { useCategoriesQuery } from "../../graphql/hooks/categories";
import { useUnitsQuery } from "../../graphql/hooks/units";
import { useAccountLedgersQuery } from "../../graphql/hooks/accountledgers";
import { ITEM_QUERIES } from "../../hooks/useaddnew";

type Kind = "service" | "goods" | "all";
const BLANK = { isservice: false, name: "", categoryid: "", unitid: "", purchaserate: "", salesrate: "", gst: "", code: "", openingstock: "" };
const num = (v: any) => Number(v) || 0;

// Ledger picked by name, same rule as the full product form.
const ledgerBy = (ledgers: any[], exact: RegExp, loose: RegExp, not: RegExp) =>
  ledgers.find((l: any) => exact.test(String(l.ledgername || "").trim()))?.id ||
  ledgers.find((l: any) => loose.test(l.ledgername || "") && !not.test(l.ledgername || ""))?.id || undefined;

/** Quick add of a product or service from a dropdown; returns "productId|variantId". */
export default function QuickItemModal({ open, kind = "all", onClose, onCreated }: {
  open: boolean;
  kind?: Kind;
  onClose: () => void;
  onCreated: (value: string) => void;
}) {
  const dispatch = useAppDispatch();
  const client = useApolloClient();
  const { addProductServiceMutation } = useProductServiceMutations();
  const { data: catData } = useCategoriesQuery();
  const { data: unitData } = useUnitsQuery();
  const { data: ledgerData } = useAccountLedgersQuery();
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setF({ ...BLANK, isservice: kind === "service" }); }, [open, kind]);

  const categories = useMemo(() => (catData?.getCategories || []).map((c: any) => ({ value: c.id, label: c.categoryname })), [catData]);
  const units = useMemo(() => (unitData?.getUnits || []).map((u: any) => ({ value: u.id, label: u.unitname })), [unitData]);
  const ledgers = ledgerData?.getAccountLedgers || [];
  const set = (k: string) => (e: any) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    const svc = f.isservice;
    const miss = !f.name.trim() ? "Name" : !f.categoryid ? "Category" : !svc && !f.unitid ? "Unit" : !num(f.salesrate) ? (svc ? "Rate" : "Sales Rate") : !svc && !num(f.purchaserate) ? "Purchase Rate" : "";
    if (miss) return dispatch(showMessage({ message: `${miss} is required.`, type: "error" }));
    const sales = ledgerBy(ledgers, /^sales\s*(account)?$/i, /\bsales\b/i, /purchase|expense|return/i);
    const purchase = ledgerBy(ledgers, /^purchase\s*(account)?$/i, /\bpurchase\b/i, /sales|return/i);
    const service = ledgerBy(ledgers, /^service\s*(sales|account|income)?$/i, /\bservice\b/i, /purchase|expense/i);
    const opening = num(f.openingstock);
    const input: any = {
      name: f.name.trim(), categoryid: f.categoryid, isservice: svc, status: true,
      salesaccountid: sales, purchaseaccountid: purchase, ...(svc ? { serviceaccountid: service } : {}),
      productvariants: svc ? [] : [{
        name: "Standard", baseunitid: f.unitid, purchaseunitid: f.unitid, purchaserate: num(f.purchaserate), gst: num(f.gst), hsncode: f.code.trim(),
        openingstock: opening, openingstockamount: opening * num(f.purchaserate), currentstock: opening,
        unitconversions: [{ unitid: f.unitid, factor: 1 }],
        unitprices: [{ quantity: 1, unitid: f.unitid, mrp: num(f.salesrate), salesrate: num(f.salesrate), discount: 0, discounttype: "fixed", offerprice: 0 }],
      }],
      servicevariants: svc ? [{ name: "Standard", servicerate: num(f.salesrate), gst: num(f.gst), saccode: f.code.trim(), duration: { amount: 1, unit: "hours" } }] : [],
    };
    setSaving(true);
    try {
      const { data } = await addProductServiceMutation({ variables: { input } });
      const p = data?.addProductService;
      const vid = (svc ? p?.servicevariants : p?.productvariants)?.[0]?.id || "";
      await client.refetchQueries({ include: ITEM_QUERIES });
      dispatch(showMessage({ message: `${f.name.trim()} added.`, type: "success" }));
      onCreated(`${p?.id}|${vid}`);
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not add.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const svc = f.isservice;
  return (
    <Modal isOpen={open} onClose={onClose} title={svc ? "Add Service" : "Add Product"} size="lg">
      <div className="space-y-3">
        {kind === "all" && (
          <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
            {([["Product", false], ["Service", true]] as const).map(([label, v]) => (
              <button key={label} type="button" onClick={() => setF((p) => ({ ...p, isservice: v }))}
                className={`px-3 ${svc === v ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Name" name="qname" type="text" value={f.name} onChange={set("name")} />
          <FormField label="Category" name="qcategory" type="select" searchable options={categories} value={f.categoryid} onChange={set("categoryid")} />
          {!svc && <FormField label="Unit" name="qunit" type="select" searchable options={units} value={f.unitid} onChange={set("unitid")} />}
          {!svc && <FormField label="Purchase Rate" name="qpurchase" type="number" value={f.purchaserate} onChange={set("purchaserate")} />}
          <FormField label={svc ? "Rate" : "Sales Rate"} name="qsales" type="number" value={f.salesrate} onChange={set("salesrate")} />
          <FormField label="GST %" name="qgst" type="number" value={f.gst} onChange={set("gst")} />
          <FormField label={svc ? "SAC Code" : "HSN Code"} name="qcode" type="text" value={f.code} onChange={set("code")} />
          {!svc && <FormField label="Opening Stock" name="qopening" type="number" value={f.openingstock} onChange={set("openingstock")} />}
        </div>
        <p className="text-[12px] text-slate-500">Images, more variants and barcodes can be added later from {svc ? "Services" : "Products"}.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
