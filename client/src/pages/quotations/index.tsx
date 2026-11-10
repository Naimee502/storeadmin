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
import { QUOTATION_STATUS, quotationNo, useQuotationMutations, useQuotationsPageQuery } from "../../graphql/hooks/quotation";
import { formatDateDMY, gstSplit } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";
import { useCompany } from "../deliverychallan";

const SERVER_FILTER_KEYS = ["billnumber", "partyacc", "billdate", "subject", "validtill", "quotationStatus", "totalamount"];

const esc = (v: any) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
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

/** Quotation as printed; layout and blocks come from Business Settings → Quotation Format. */
export function printQuotation(q: any, company: any, settings: any, products: any[] = []) {
  const s = settings || {};
  const on = (k: string, dflt: boolean) => (s[k] === undefined || s[k] === null ? dflt : !!s[k]);
  const showImg = on("quoteShowImages", false), showHsn = on("quoteShowHsn", true), showDisc = on("quoteShowDiscount", true);
  const showGst = on("quoteShowGst", true), showSplit = on("quoteShowTaxSplit", true), showSign = on("quoteShowSignature", true);
  const accent = /^#[0-9a-f]{3,8}$/i.test(s.quoteAccent || "") ? s.quoteAccent : "#4f46e5";
  const c = customerOf(q);
  const seller = {
    name: s.legalName || company?.companyName || company?.name || "",
    address: [s.gstAddress || company?.address, s.gstCity, s.gstPincode].filter(Boolean).join(", "),
    mobile: company?.mobile || "",
    gstin: s.gstin || company?.gstin || "",
  };
  const productOf = (id?: string) => products.find((p: any) => p.id === id);
  const variantOf = (l: any) => productOf(l.productserviceid?.id)?.productvariants?.find((v: any) => v.id === l.variantid?.id);
  const lines = q.productservice || [];
  const main = lines.filter((l: any) => !l.optional);
  const optional = lines.filter((l: any) => l.optional);
  const head = `<tr><th>#</th>${showImg ? "<th></th>" : ""}<th>Description</th>${showHsn ? "<th>HSN/SAC</th>" : ""}<th class="r">Qty</th><th>Unit</th><th class="r">Rate</th>${showDisc ? '<th class="r">Disc.</th>' : ""}${showGst ? '<th class="r">GST%</th>' : ""}<th class="r">Amount</th></tr>`;
  const printDefs = (s.customFieldDefs || []).filter((d: any) => d.entity === "product" && d.print);
  const specsOf = (prod: any) =>
    printDefs
      .map((d: any) => [d.label, (prod?.customfields || []).find((c: any) => c.key === d.key)?.value])
      .filter(([, v]: any) => v)
      .map(([k, v]: any) => `${esc(k)}: ${esc(v)}`)
      .join(" · ");
  const row = (l: any, i: number) => {
    const prod = productOf(l.productserviceid?.id);
    const specs = specsOf(prod);
    const v = variantOf(l);
    const img = prod?.imageurl || prod?.imageurls?.[0] || "";
    return `<tr><td>${i + 1}</td>${showImg ? `<td>${img ? `<img src="${esc(img)}" style="width:42px;height:42px;object-fit:cover"/>` : ""}</td>` : ""}
      <td><b>${esc(l.productserviceid?.name || "")}${l.variantid?.name ? ` - ${esc(l.variantid.name)}` : ""}</b>${specs ? `<div class="desc">${specs}</div>` : ""}${l.description ? `<div class="desc">${nl(l.description)}</div>` : ""}</td>
      ${showHsn ? `<td>${esc(v?.hsncode || "")}</td>` : ""}<td class="r">${esc(l.qty)}</td><td>${esc(l.unitqty && l.unitqty !== 1 ? `${l.unitqty} ` : "")}${esc(l.salesunitid?.unitname || "")}</td>
      <td class="r">${money(l.rate)}</td>${showDisc ? `<td class="r">${l.discount ? money(l.discount) : ""}</td>` : ""}${showGst ? `<td class="r">${esc(l.gst || 0)}</td>` : ""}<td class="r">${money(l.amount)}</td></tr>`;
  };
  const split = gstSplit(s.companyState, c.state, Number(q.totalgst || 0));
  const totals = [
    ["Sub Total", money(q.subtotal)],
    ...(showDisc && Number(q.totaldiscount) ? [["Discount", money(q.totaldiscount)]] : []),
    ...(showGst ? (showSplit ? (split.inter ? [["IGST", money(split.igst)]] : [["CGST", money(split.cgst)], ["SGST", money(split.sgst)]]) : [["GST", money(q.totalgst)]]) : []),
    ["Grand Total", money(q.totalamount)],
  ];
  const html = `<!doctype html><html><head><title>${esc(quotationNo(q))}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}.page{padding:12mm}
    .top{display:flex;justify-content:space-between;border-bottom:3px solid ${accent};padding-bottom:8px}
    .co{font-size:18px;font-weight:bold;color:${accent}}.muted{color:#555}.title{font-size:20px;font-weight:bold;letter-spacing:1px;text-align:right}
    table{width:100%;border-collapse:collapse}.meta{margin:10px 0}.meta td{vertical-align:top;padding:4px 0;width:50%}
    .items{margin-top:8px}.items th{background:${accent};color:#fff;text-align:left;padding:5px;font-size:11px}.items td{border-bottom:1px solid #ddd;padding:5px;vertical-align:top}
    .r{text-align:right}.desc{color:#444;font-size:11px;margin-top:2px}.tot{width:45%;margin-left:auto;margin-top:6px}.tot td{padding:3px 5px}
    .tot tr:last-child td{border-top:2px solid ${accent};font-weight:bold;font-size:13px}.box{margin-top:12px}.box h4{margin:0 0 4px;color:${accent}}
    .sign{margin-top:36px;text-align:right}.foot{margin-top:18px;border-top:1px solid #ddd;padding-top:6px;color:#666;font-size:10px;text-align:center}
  </style></head><body><div class="page">
    <div class="top"><div><div class="co">${esc(seller.name)}</div><div class="muted">${esc(seller.address)}${seller.mobile ? `<br/>${esc(seller.mobile)}` : ""}${seller.gstin ? `<br/>GSTIN ${esc(seller.gstin)}` : ""}</div></div>
      <div><div class="title">${esc(s.quoteTitle || "QUOTATION")}</div><div class="r muted">No. <b>${esc(quotationNo(q))}</b><br/>Date ${esc(formatDateDMY(q.billdate))}${q.validtill ? `<br/>Valid till ${esc(formatDateDMY(q.validtill))}` : ""}</div></div></div>
    <table class="meta"><tr><td><b>To</b><br/>${esc(c.name)}${c.address ? `<br/>${esc(c.address)}` : ""}${c.mobile ? `<br/>${esc(c.mobile)}` : ""}${c.gstin ? `<br/>GSTIN ${esc(c.gstin)}` : ""}${q.contactperson ? `<br/>Kind Attn: ${esc(q.contactperson)}` : ""}</td>
      <td>${q.subject ? `<b>Subject:</b> ${esc(q.subject)}` : ""}</td></tr></table>
    ${q.intro || s.quoteIntro ? `<p>${nl(q.intro || s.quoteIntro)}</p>` : ""}
    <table class="items"><thead>${head}</thead><tbody>${main.map(row).join("")}</tbody></table>
    <table class="tot">${totals.map(([k, v]) => `<tr><td>${k}</td><td class="r">₹ ${v}</td></tr>`).join("")}</table>
    ${optional.length ? `<div class="box"><h4>Optional Items (not in the total)</h4><table class="items"><thead>${head}</thead><tbody>${optional.map(row).join("")}</tbody></table></div>` : ""}
    ${q.terms ? `<div class="box"><h4>Terms &amp; Conditions</h4>${nl(q.terms)}</div>` : ""}
    ${showSign ? `<div class="sign">For ${esc(seller.name)}<br/><br/><br/>Authorised Signatory</div>` : ""}
    ${s.quoteFooter ? `<div class="foot">${nl(s.quoteFooter)}</div>` : ""}
  </div></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 400);
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
          onPrint={(row) => printQuotation(row.raw, company, settings, productData?.getProductServices || [])}
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
