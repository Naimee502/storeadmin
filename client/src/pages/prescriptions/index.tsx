import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { customerLabel, usePrescriptionsPageQuery, useServiceMutations } from "../../graphql/hooks/service";
import { useCompany } from "../deliverychallan";
import { billBody, billHtml, companyOf, esc, printHtml, printOptions } from "../../utils/billprint";
import { formatDateDMY, todayYMD } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";

export const TIMING: Record<string, string> = { before: "Before food", after: "After food", empty: "Empty stomach", bedtime: "At bedtime" };
export const rxNo = (r: any) => `RX-${r?.rxnumber || ""}`;
const drName = (r: any) => {
  const d = [r.doctorname, r.doctorqualification].filter(Boolean).join(", ").replace(/^Dr\.?\s*/i, "");
  return d ? `Dr. ${d}` : "";
};

/** Prescription in the common bill layout (same frame as the patient's copy from the server). */
export function printPrescription(r: any, company: any, settings: any) {
  const opts = printOptions(settings || {});
  const seller = companyOf(company, settings || {});
  const patient = r.partyacc ? partyLabel(r.partyacc) : [r.customername, r.customermobile].filter(Boolean).join(" - ");
  const v = r.vitals || {};
  const vitals = [["BP", v.bp], ["Pulse", v.pulse], ["Temp", v.temperature], ["Weight", v.weight], ["SpO2", v.spo2], ["Sugar", v.sugar]]
    .filter(([, x]) => x).map(([l, x]) => `${l}: ${esc(x)}`).join(" &nbsp; ");
  const extra = [
    r.tests ? `<strong>Tests:</strong> ${esc(r.tests)}` : "",
    r.advice ? `<strong>Advice:</strong> ${esc(r.advice)}` : "",
    r.nextvisit ? `<strong>Next Visit:</strong> ${esc(formatDateDMY(r.nextvisit))}` : "",
  ].filter(Boolean).join("<br/>");
  const body = billBody({
    title: "PRESCRIPTION", memo: drName(r), company: seller, showHeader: opts.showHeader,
    cells: [
      ["Patient", esc(patient || "---")], ["Rx No.", esc(rxNo(r))], ["Date", esc(formatDateDMY(r.billdate))],
      ["Complaints", esc(r.complaints || "---")], ["Diagnosis", esc(r.diagnosis || "---")], ["Vitals", vitals || "---"],
    ],
    columns: [{ label: "Sr", align: "c", width: "6%" }, { label: "Medicine", align: "l" }, { label: "Dose", align: "c", width: "12%" },
      { label: "When", align: "c", width: "12%" }, { label: "Food", align: "c", width: "15%" }, { label: "Days", align: "c", width: "9%" }],
    rows: (r.medicines || []).map((m: any, i: number) => [String(i + 1), `${esc(m.name)}${m.notes ? `<div class="desc">${esc(m.notes)}</div>` : ""}`,
      esc(m.dose || "-"), esc(m.frequency || "-"), esc(TIMING[m.timing] || m.timing || "-"), esc(m.days ?? "-")]),
    extra,
    signLeft: r.doctorregno ? `Reg. No. ${r.doctorregno}` : undefined,
    signCompany: null,
    signLabel: drName(r) || "Doctor's Signature",
  });
  printHtml(billHtml(rxNo(r), [body]));
}

const SERVER_FILTER_KEYS = ["rxnumber", "partyacc", "billdate", "doctor", "diagnosis", "nextvisit"];

const Prescriptions = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "prescriptions"));
  const settings = useAppSelector((s: any) => s.adminsettings.settings);
  const company = useCompany();
  const table = useServerTable("prescriptions", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = usePrescriptionsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const { deletePrescription } = useServiceMutations();
  const today = todayYMD();

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Rx No", key: "rxnumber" },
    { label: "Date", key: "billdate" },
    { label: "Patient", key: "partyacc" },
    { label: "Doctor", key: "doctor" },
    { label: "Diagnosis", key: "diagnosis" },
    { label: "Medicines", key: "medicines" },
    { label: "Next Visit", key: "nextvisit" },
  ];
  const rows = items.map((r: any, i: number) => ({
    id: r.id,
    seqNo: table.offset + i + 1,
    rxnumber: rxNo(r),
    billdate: formatDateDMY(r.billdate),
    partyacc: customerLabel(r),
    doctor: r.doctorname || "—",
    diagnosis: r.diagnosis || r.complaints || "—",
    medicines: (r.medicines || []).length || "—",
    nextvisit: r.nextvisit ? <span className={r.nextvisit < today ? "text-slate-400" : "font-medium text-indigo-700"}>{formatDateDMY(r.nextvisit)}</span> : "—",
    raw: r,
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Prescriptions"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showAdd={actions.showAdd}
          showEdit={actions.showEdit}
          showDelete={actions.showDelete}
          showDeleted={actions.showDelete || actions.canReset}
          showPrint={actions.showPrint}
          showView={false}
          showImport={false}
          showExport={false}
          onAdd={() => navigate("/prescriptions/addedit")}
          onEdit={(row) => navigate(`/prescriptions/addedit/${row.id}`)}
          onPrint={(row) => printPrescription(row.raw, company, settings)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete ${row.rxnumber}?`)) return;
            try {
              await deletePrescription({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Prescription deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/prescriptions/deletedentries")}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default Prescriptions;
