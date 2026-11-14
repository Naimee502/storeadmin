import { useState } from "react";
import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useCategoriesQuery } from "../../graphql/hooks/categories";
import { QUOTATION_STATUS, quotationNo, useQuotationMutations, useQuotationsPageQuery } from "../../graphql/hooks/quotation";
import { formatDateDMY, gstSplit } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";
import { useCompany } from "../deliverychallan";
import { type Column, amountInWords, billBody, billHtml, companyOf, esc, f2, printHtml, printOptions } from "../../utils/billprint";

const SERVER_FILTER_KEYS = ["billnumber", "partyacc", "billdate", "subject", "validtill", "quotationStatus", "totalamount"];

const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nl = (t?: string) => esc(t || "").replace(/\n/g, "<br/>");

/** Customer block of a quotation: the party, else the lead's details typed on it. */
export const customerOf = (q: any) => {
  const p = q?.partyacc;
  return {
    name: p?.name || p?.accountname || q?.customername || q?.leadid?.name || "",
    mobile: p?.mobile || q?.customermobile || "",
    address: [p?.address || q?.customeraddress, p?.city || q?.customercity, p?.state || q?.customerstate].filter(Boolean).join(", "),
    gstin: p?.gstnumber || q?.customergstin || "",
    state: p?.state || q?.customerstate || "",
  };
};

/** Quotation as printed: the common bill layout; blocks come from Business Settings → Quotation Format. */
export function printQuotation(q: any, company: any, settings: any, products: any[] = [], categories: any[] = []) {
  const s = settings || {};
  const on = (k: string, dflt: boolean) => (s[k] === undefined || s[k] === null ? dflt : !!s[k]);
  const showImg = on("quoteShowImages", false), showHsn = on("quoteShowHsn", true), showDisc = on("quoteShowDiscount", true);
  const showGst = on("quoteShowGst", true), showSplit = on("quoteShowTaxSplit", true), showSign = on("quoteShowSignature", true);
  const accent = /^#[0-9a-f]{3,8}$/i.test(s.quoteAccent || "") ? s.quoteAccent : undefined;
  const opts = printOptions(s);
  const c = customerOf(q);
  const seller = companyOf(company, s);
  if (s.legalName) seller.name = s.legalName;
  const productOf = (id?: string) => products.find((p: any) => p.id === id);
  const variantOf = (l: any) => productOf(l.productserviceid?.id)?.productvariants?.find((v: any) => v.id === l.variantid?.id);
  const lines = q.productservice || [];
  const main = lines.filter((l: any) => !l.optional);
  const optional = lines.filter((l: any) => l.optional);
  const columns: Column[] = [
    { label: "Sr", align: "c", width: "5%" }, ...(showImg ? [{ label: "", align: "c" as const, width: "7%" }] : []),
    { label: "Product Name", align: "l" }, ...(showHsn ? [{ label: "HSN", align: "c" as const, width: "9%" }] : []),
    { label: "Qty", align: "c", width: "8%" }, { label: "Rate", align: "r", width: "11%" },
    ...(showDisc ? [{ label: "Disc", align: "r" as const, width: "9%" }] : []), ...(showGst ? [{ label: "GST%", align: "c" as const, width: "7%" }] : []),
    { label: "Amount", align: "r", width: "13%" },
  ];
  const printDefs = (s.customFieldDefs || []).filter((d: any) => d.entity === "product" && d.print);
  // Business-wide fields sit on the product; a category's spec fields sit on the variant.
  const specsOf = (prod: any, variant?: any) => {
    const catDefs = (categories.find((c: any) => c.id === (prod?.categoryid?.id || prod?.categoryid))?.specdefs || []).filter((d: any) => d.print);
    const pick = (defs: any[], holder: any) =>
      defs.map((d: any) => [d.label, (holder?.customfields || []).find((c: any) => c.key === d.key)?.value]);
    return [...pick(printDefs, prod), ...pick(catDefs, variant)]
      .filter(([, v]: any) => v)
      .map(([k, v]: any) => `${esc(k)}: ${esc(v)}`)
      .join(" · ");
  };
  const row = (l: any, i: number) => {
    const prod = productOf(l.productserviceid?.id);
    const v = variantOf(l);
    const specs = specsOf(prod, v);
    const img = prod?.imageurl || prod?.imageurls?.[0] || "";
    const unit = `${l.unitqty && l.unitqty !== 1 ? `${l.unitqty} ` : ""}${l.salesunitid?.unitname || ""}`;
    return [
      String(i + 1),
      ...(showImg ? [img ? `<img src="${esc(img)}" style="width:42px;height:42px;object-fit:cover"/>` : ""] : []),
      `${esc(l.productserviceid?.name || "")}${l.variantid?.name ? ` - ${esc(l.variantid.name)}` : ""}${unit ? ` (${esc(unit)})` : ""}${specs ? `<div class="desc">${specs}</div>` : ""}${l.description ? `<div class="desc">${nl(l.description)}</div>` : ""}`,
      ...(showHsn ? [esc(v?.hsncode || "-")] : []),
      esc(l.qty), f2(l.rate), ...(showDisc ? [f2(l.discount)] : []), ...(showGst ? [esc(l.gst || 0)] : []), f2(l.amount),
    ];
  };
  const split = gstSplit(s.companyState, c.state, Number(q.totalgst || 0));
  const totals: [string, string][] = [
    ["Sub Total", f2(q.subtotal)],
    ...(showDisc ? [["Total Discount", f2(q.totaldiscount)] as [string, string]] : []),
    ...(showGst ? (showSplit ? (split.inter ? [["IGST", f2(split.igst)]] : [["CGST", f2(split.cgst)], ["SGST", f2(split.sgst)]]) : []) as [string, string][] : []),
    ...(showGst ? [["Total GST", f2(q.totalgst)] as [string, string]] : []),
  ];
  const optionalHtml = optional.length
    ? `<div class="inv-sub">Optional Items (not in the total)</div><table class="inv-table"><tbody>${optional.map((l: any, i: number) => `<tr>${row(l, i).map((cell, k) => `<td class="${columns[k]?.align === "r" ? "ar" : columns[k]?.align === "c" ? "ac" : "al"}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : "";
  const intro = q.intro || s.quoteIntro;
  const body = billBody({
    title: s.quoteTitle || "QUOTATION",
    memo: q.subject ? `Subject: ${q.subject}` : "",
    company: seller, accent, showHeader: opts.showHeader,
    cells: [
      ["M/S.", esc(c.name || "---")],
      ["Quotation No.", esc(quotationNo(q))],
      ["Date", esc(formatDateDMY(q.billdate))],
      ["Address", esc(c.address || "---")],
      ["Mobile", esc(c.mobile || "---")],
      ["Valid Till", esc(q.validtill ? formatDateDMY(q.validtill) : "---")],
      ["GSTIN No.", esc(c.gstin || "---")],
      ["Kind Attn.", esc(q.contactperson || "---")],
      ["Place of Supply", esc(c.state ? c.state.replace(/_/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase()) : "---")],
    ],
    columns, rows: main.map(row), afterItems: optionalHtml,
    totals, grand: ["Grand Total", f2(q.totalamount)], words: amountInWords(q.totalamount),
    extra: intro ? nl(intro) : "",
    terms: q.terms ? String(q.terms).split("\n").map((l: string) => esc(l.trim())).filter(Boolean) : [],
    signCompany: showSign ? seller.name : null, signLabel: showSign ? "Authorised Signatory" : " ",
    footer: s.quoteFooter ? nl(s.quoteFooter) : "",
  });
  printHtml(billHtml(quotationNo(q), [body]));
}

/** WhatsApp text for the customer (opens their chat). */
export const quotationWhatsApp = (q: any, company: any) => {
  const c = customerOf(q);
  const d = String(c.mobile || "").replace(/\D/g, "");
  const text = [
    `Dear ${c.name},`,
    `Please find our quotation ${quotationNo(q)}${q.subject ? ` for ${q.subject}` : ""}.`,
    `Amount: ₹${money(q.totalamount)}${q.validtill ? `, valid till ${formatDateDMY(q.validtill)}` : ""}.`,
    `${company?.companyName || ""}`,
  ].join("\n");
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(text)}`;
};

const Quotations = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "quotations"));
  const orderOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "salesorder"));
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const company = useCompany();
  const table = useServerTable("quotations", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useQuotationsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("quotation", table.page);
  const { data: productData } = useProductServicesQuery();
  const { data: categoryData } = useCategoriesQuery();
  const { deleteQuotation, setQuotationStatus, reviseQuotation } = useQuotationMutations();
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState("");

  const optionsFor = (q: any) => {
    if (q.isOffline || !actions.showEdit || ["revised", "converted"].includes(q.quotationStatus)) return [];
    const o: { label: string; value: string }[] = [];
    if (q.quotationStatus !== "sent") o.push({ label: "Sent", value: "sent" });
    if (q.quotationStatus !== "accepted") o.push({ label: "Accepted", value: "accepted" });
    if (q.quotationStatus !== "rejected") o.push({ label: "Rejected", value: "rejected" });
    if (actions.showAdd) o.push({ label: "New Revision", value: "revise" });
    if (orderOn && actions.showConvert && q.partyacc?.id && q.quotationStatus !== "rejected") o.push({ label: "Convert to Sales Order", value: "convert" });
    return o;
  };

  const onStatus = async (q: any, v: string) => {
    try {
      if (v === "convert") return navigate("/salesorder/addedit", { state: { fromQuotation: q } });
      if (v === "rejected") {
        setReason("");
        return setRejecting(q);
      }
      if (v === "revise") {
        const r = await reviseQuotation({ variables: { id: q.id } });
        dispatch(showMessage({ message: "New revision made.", type: "success" }));
        const id = r?.data?.reviseQuotation?.id;
        if (id) navigate(`/quotations/addedit/${id}`);
        return;
      }
      await setQuotationStatus({ variables: { id: q.id, quotationStatus: v, expectedUpdatedAt: q.updatedAt } });
      dispatch(showMessage({ message: `Marked ${QUOTATION_STATUS[v]}.`, type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
    }
  };

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Quotation No", key: "billnumber" },
    { label: "Date", key: "billdate" },
    { label: "Customer", key: "partyacc" },
    { label: "Subject", key: "subject" },
    { label: "Valid Till", key: "validtill" },
    { label: "Amount", key: "totalamount" },
    { label: "Status", key: "quotationStatus" },
  ];

  const buildRow = (q: any, i: number) => {
    const expired = q.validtill && q.validtill < new Date().toISOString().slice(0, 10) && ["draft", "sent"].includes(q.quotationStatus || "draft");
    return {
      id: q.id,
      seqNo: i >= 0 ? table.offset + i + 1 : "",
      billnumber: quotationNo(q),
      billdate: formatDateDMY(q.billdate),
      partyacc: q.partyacc ? partyLabel(q.partyacc) : partyLabel({ name: customerOf(q).name, mobile: customerOf(q).mobile, city: q.customercity || q.leadid?.city }) || "—",
      subject: q.subject || "—",
      validtill: q.validtill ? <span className={expired ? "font-semibold text-rose-600" : ""}>{formatDateDMY(q.validtill)}{expired ? " (expired)" : ""}</span> : "—",
      totalamount: `₹${money(q.totalamount)}`,
      quotationStatus: <StatusDropdown current={q.quotationStatus || "draft"} options={optionsFor(q)} onSelect={(v) => onStatus(q, v)} />,
      raw: q,
    };
  };
  const serverRows = items.map((q: any, i: number) => offline.decorate(buildRow(q, i), "seqNo"));
  const rows = offline.rows.length ? [...offline.rows.map((q: any) => offline.decorate(buildRow(q, -1), "seqNo")), ...serverRows] : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Quotations"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showAdd={actions.showAdd}
          showEdit={(row: any) => actions.showEdit && !["revised", "converted"].includes(row.raw?.quotationStatus)}
          showDelete={actions.showDelete}
          showDeleted={actions.showDelete || actions.canReset}
          showPrint={actions.showPrint}
          showWhatsApp={(row: any) => actions.showWhatsApp && !!customerOf(row.raw).mobile}
          showView={false}
          showImport={false}
          showExport={false}
          onAdd={() => navigate("/quotations/addedit")}
          onEdit={(row) => navigate(`/quotations/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${row.billnumber}?`)) return;
            try {
              await deleteQuotation({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Quotation deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onPrint={(row) => printQuotation(row.raw, company, settings, productData?.getProductServices || [], categoryData?.getCategories || [])}
          onWhatsApp={(row) => window.open(quotationWhatsApp(row.raw, company), "_blank")}
          onShowDeleted={() => navigate("/quotations/deletedentries")}
          isLoading={loading}
        />
      </div>
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setRejecting(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-slate-800">Why was {quotationNo(rejecting)} rejected?</div>
            <input className="h-8 w-full rounded-md border border-slate-300 px-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" autoFocus />
            <div className="flex justify-end gap-2">
              <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={() => setRejecting(null)}>Cancel</button>
              <button
                type="button"
                className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700"
                onClick={async () => {
                  try {
                    await setQuotationStatus({ variables: { id: rejecting.id, quotationStatus: "rejected", statusreason: reason.trim() || "Not given", expectedUpdatedAt: rejecting.updatedAt } });
                    dispatch(showMessage({ message: "Marked Rejected.", type: "success" }));
                    setRejecting(null);
                  } catch (e: any) {
                    dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </HomeLayout>
  );
};

export default Quotations;
