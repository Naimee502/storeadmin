import { useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import FormField from "../../components/formfiled";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { showMessage } from "../../redux/slices/message";
import { useDeliveryChallanMutations, useDeliveryChallansPageQuery } from "../../graphql/hooks/deliverychallan";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { formatDateDMY } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";
import { useOfflineList } from "../../offline/listing";
import GstPanel from "../../components/gstpanel";
import { type Column, amountInWords, billBody, billHtml, companyOf, esc, f2, printHtml, printOptions } from "../../utils/billprint";

export const CHALLAN_REASONS = [
  { value: "sale", label: "Sale" },
  { value: "jobwork", label: "Job Work" },
  { value: "approval", label: "On Approval" },
  { value: "repair", label: "Repair" },
  { value: "branchtransfer", label: "Branch Transfer" },
  { value: "other", label: "Other" },
];
export const reasonLabel = (v?: string) => CHALLAN_REASONS.find((r) => r.value === v)?.label || "Sale";
export const challanNo = (c: any) => `DC-${c?.billnumber || c?.offlineNumber || ""}`.replace(/^DC-DC-/, "DC-");

const SERVER_FILTER_KEYS = ["billnumber", "partyacc", "billdate", "reason", "challanStatus", "vehiclenumber", "totalamount"];


// Rule 55: three copies (consignee, transporter, consigner); rates are optional on a challan.
export function printChallan(c: any, company: any, opts: { copies: number; showRate: boolean }, settings?: any) {
  const labels = ["Original for Consignee", "Duplicate for Transporter", "Triplicate for Consigner"].slice(0, opts.copies);
  const po = printOptions(settings);
  const lines = c.productservice || [];
  const totalQty = lines.reduce((s: number, l: any) => s + Number(l.qty || 0), 0);
  const p = c.partyacc || {};
  const seller = companyOf(company, settings);
  const cells: [string, string][] = [
    ["Consignee", esc(p.name || p.accountname || "---")],
    ["Challan No.", esc(challanNo(c))],
    ["Date", esc(formatDateDMY(c.billdate))],
    ["Address", esc([p.address, p.city, p.state].filter(Boolean).join(", ") || "---")],
    ["Mobile", esc(p.mobile || "---")],
    ["GSTIN No.", esc(p.gstnumber || "---")],
    ["Transport / Vehicle No", `${esc(c.transportname || "---")} / ${esc(c.vehiclenumber || "---")}`],
    ["E-Way Bill / Distance", `${esc(c.ewaybillno || "---")} / ${c.distance ? `${esc(c.distance)} km` : "---"}`],
    ["Order / Invoice", esc([c.sourceOrderNumber && `SO-${c.sourceOrderNumber}`, c.sourceInvoiceNumber].filter(Boolean).join(" / ") || "---")],
  ];
  const columns: Column[] = [
    { label: "Sr", align: "c", width: "6%" }, { label: "Product Name", align: "l" }, { label: "Qty", align: "c", width: "9%" }, { label: "Unit", align: "c", width: "10%" },
    ...(opts.showRate ? [{ label: "Rate", align: "r" as const, width: "12%" }, { label: "Amount", align: "r" as const, width: "14%" }] : []),
  ];
  const rows = lines.map((l: any, i: number) => [
    String(i + 1), `${esc(l.productserviceid?.name || "")}${l.variantid?.name ? ` - ${esc(l.variantid.name)}` : ""}`, esc(l.qty), esc(l.salesunitid?.unitname || ""),
    ...(opts.showRate ? [f2(l.rate), f2(l.amount)] : []),
  ]);
  const pages = labels.map((copy) => billBody({
    title: "DELIVERY CHALLAN", copy, memo: `Reason: ${reasonLabel(c.reason)}`,
    company: seller, showHeader: po.showHeader, cells, columns, rows,
    totals: [["Total Qty", esc(totalQty)]],
    grand: opts.showRate ? ["Total Amount", f2(c.totalamount)] : undefined,
    words: opts.showRate ? amountInWords(c.totalamount) : "",
    extra: c.notes ? `<strong>Notes:</strong> ${esc(c.notes)}` : "",
    signLeft: "Receiver's Signature",
    signCompany: po.signCompany ? seller.name : null,
  }));
  printHtml(billHtml(challanNo(c), pages), 200);
}

/** Company shown on the challan header, whoever is logged in. */
export const useCompany = () =>
  useAppSelector((s: any) => (s.auth.type === "admin" ? s.auth.admin : s.auth.type === "branch" ? s.auth.branch?.admin : s.auth.staff?.admin));

const DeliveryChallans = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "deliverychallan"));
  const invoiceOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "salesinvoice"));
  const company = useCompany();
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const table = useServerTable("deliverychallan", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useDeliveryChallansPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("deliverychallan", table.page);
  const { deleteDeliveryChallanMutation, markDeliveredMutation, markReturnedMutation } = useDeliveryChallanMutations();
  const [printing, setPrinting] = useState<any>(null);
  const [gstChallan, setGstChallan] = useState<any>(null);
  const gstOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "ewaybill"));
  const [copies, setCopies] = useState(3);
  const [showRate, setShowRate] = useState(false);

  const optionsFor = (c: any) => {
    if (c.isOffline || c.challanStatus === "returned" || !actions.showEdit) return [];
    const opts: { label: string; value: string }[] = [];
    if (c.challanStatus !== "delivered") opts.push({ label: "Delivered", value: "delivered" });
    if (!c.invoiceid) opts.push({ label: "Returned", value: "returned" });
    if (invoiceOn && !c.invoiceid && !c.sourceinvoiceid && c.reason === "sale" && actions.showConvert) {
      opts.push({ label: "Convert to Invoice", value: "convert" });
    }
    return opts;
  };

  const onStatus = async (c: any, v: string) => {
    try {
      if (v === "convert") {
        navigate(c.sourceorderid ? `/salesinvoice/addedit?orderId=${c.sourceorderid}` : `/salesinvoice/addedit?challanId=${c.id}`);
        return;
      }
      if (v === "returned" && !window.confirm(`Mark ${challanNo(c)} as returned? Its stock goes back.`)) return;
      const vars = { variables: { id: c.id, expectedUpdatedAt: c.updatedAt } };
      if (v === "delivered") await markDeliveredMutation(vars);
      else await markReturnedMutation(vars);
      dispatch(showMessage({ message: v === "delivered" ? "Marked delivered." : "Marked returned; stock restored.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
    }
  };

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Challan No", key: "billnumber" },
    { label: "Date", key: "billdate" },
    { label: "Party", key: "partyacc" },
    { label: "Against", key: "against" },
    { label: "Reason", key: "reason" },
    { label: "Items", key: "totalitem" },
    { label: "Qty", key: "totalqty" },
    { label: "Vehicle", key: "vehiclenumber" },
    { label: "Value", key: "totalamount" },
    ...(gstOn ? [{ label: "E-Way Bill", key: "ewbCell" }] : []),
    { label: "Status", key: "challanStatus" },
  ];

  const buildRow = (c: any, i: number) => ({
    ...c,
    seqNo: table.offset + i + 1,
    billnumber: challanNo(c),
    billdate: formatDateDMY(c.billdate),
    partyacc: partyLabel(c.partyacc) || "N/A",
    against: c.sourceInvoiceNumber ? `INV ${c.sourceInvoiceNumber}` : c.sourceOrderNumber ? `SO-${c.sourceOrderNumber}` : c.invoicenumber ? `→ INV ${c.invoicenumber}` : "—",
    reason: reasonLabel(c.reason),
    totalitem: c.productservice?.length || 0,
    totalqty: c.productservice?.reduce((s: number, l: any) => s + Number(l.qty || 0), 0) || 0,
    vehiclenumber: c.vehiclenumber || "—",
    ewbCell: c.isOffline ? "—" : (
      <button
        type="button"
        onClick={() => setGstChallan(c)}
        title="e-Way Bill"
        className={`inline-flex h-6 items-center rounded px-2 text-[11px] font-semibold ring-1 ${c.ewaybillno ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-white text-indigo-600 ring-indigo-200 hover:bg-indigo-50"}`}
      >
        {c.ewaybillno ? c.ewaybillno : "e-Way Bill"}
      </button>
    ),
    challanStatus: (
      <StatusDropdown current={c.challanStatus || "open"} options={optionsFor(c)} onSelect={(v) => onStatus(c, v)} />
    ),
    raw: c,
  });
  const serverRows = items.map((c: any, i: number) => offline.decorate(buildRow(c, i), "seqNo"));
  const rows = offline.rows.length
    ? [...offline.rows.map((c: any) => offline.decorate(buildRow(c, -1), "seqNo")), ...serverRows]
    : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          requireBranchForAdd={true}
          {...actions}
          title="Delivery Challans"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showPrint={actions.showPrint}
          // Convert to Invoice lives in the status menu, only for challans not made from an invoice.
          showConvert={false}
          onAdd={() => navigate("/deliverychallan/addedit")}
          onEdit={(row) => {
            if (row.raw?.invoiceid || row.raw?.challanStatus === "returned") {
              dispatch(showMessage({ message: "An invoiced or returned challan cannot be edited.", type: "error" }));
              return;
            }
            navigate(`/deliverychallan/addedit/${row.id}`);
          }}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${row.billnumber}? Its stock goes back.`)) return;
            try {
              await deleteDeliveryChallanMutation({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Challan deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onPrint={(row) => setPrinting(row.raw)}
          onShowDeleted={() => navigate("/deliverychallan/deletedentries")}
          isLoading={loading}
        />
      </div>

      {gstChallan && <GstPanel kind="challan" doc={gstChallan} einvoice={false} ewaybill onClose={() => setGstChallan(null)} />}
      {printing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40" onClick={() => setPrinting(null)}>
          <div className="w-80 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 font-semibold text-slate-800">Print {challanNo(printing)}</div>
            <label className="mb-2 flex items-center justify-between">
              Copies
              <div className="w-72">
                <FormField label="" name="copies" type="select" value={copies}
                  options={[{ value: "3", label: "3 (Original, Duplicate, Triplicate)" }, { value: "1", label: "1 (Original only)" }]}
                  onChange={(e: any) => e.target.value && setCopies(Number(e.target.value))} />
              </div>
            </label>
            <label className="mb-4 flex items-center gap-2">
              <input type="checkbox" checked={showRate} onChange={(e) => setShowRate(e.target.checked)} />
              Show rate and amount
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={() => setPrinting(null)}>Cancel</button>
              <button
                type="button"
                className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700"
                onClick={() => { printChallan(printing, company, { copies, showRate }, settings); setPrinting(null); }}
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </HomeLayout>
  );
};

export default DeliveryChallans;
