import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { Copy, RefreshCw, Send, Link2, Inbox, Plug } from "lucide-react";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import { useAppDispatch } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { useStaffListQuery } from "../../graphql/hooks/staffaccounts";
import { GET_LEAD_INBOX, GET_LEAD_SOURCES } from "../../graphql/queries/lead";
import { PULL_LEAD_SOURCE_NOW, REGENERATE_LEAD_SOURCE_LINK, RETRY_LEAD_INBOX, SAVE_LEAD_SOURCE, TEST_LEAD_SOURCE } from "../../graphql/mutations/lead";
import { formatDateTimeDMY } from "../../utils/helper";

type Info = {
  title: string;
  about: string;
  steps: string[];
  link?: boolean;
  verify?: boolean;
  pull?: boolean;
  keys?: { k: "key1" | "key2" | "key3"; label: string }[];
};

// What each source needs, in the order the business sets it up.
const INFO: Record<string, Info> = {
  indiamart: {
    title: "IndiaMART",
    about: "Buy leads and enquiries arrive the moment the buyer sends them (Push API). Needs a paid IndiaMART seller account.",
    steps: [
      "Log in at seller.indiamart.com → Lead Manager → ⋮ → Import/Export Leads → Push API.",
      "Choose “Other”, platform name “Rudra”, and paste the link below. Confirm with the OTP.",
      "Optional backup: generate the Pull API key there and paste it below; we fetch every 15 minutes.",
    ],
    link: true,
    pull: true,
    keys: [{ k: "key1", label: "CRM Pull API Key (optional)" }],
  },
  tradeindia: {
    title: "TradeIndia",
    about: "Enquiries are fetched every 15 minutes with your Inquiry API details. Needs a paid TradeIndia seller account.",
    steps: ["TradeIndia seller panel → My Profile → Inquiries & Contacts → My Inquiry API.", "Copy the User ID, Profile ID and Key into the boxes below and save."],
    pull: true,
    keys: [{ k: "key1", label: "User ID" }, { k: "key2", label: "Profile ID" }, { k: "key3", label: "Key" }],
  },
  justdial: {
    title: "JustDial",
    about: "JustDial sets the link up on their side; you send it to your JustDial account manager.",
    steps: ["Copy the ready message below and send it to your JustDial account manager.", "Once they confirm, every JustDial lead lands here as a new lead."],
    link: true,
  },
  meta: {
    title: "Facebook / Instagram Lead Ads",
    about: "Instant Form leads from your Facebook and Instagram ads, the moment they are submitted.",
    steps: [
      "In your Meta app (developers.facebook.com) → Webhooks → Page → subscribe to “leadgen” with the link and verify token below.",
      "Make a Page access token with leads_retrieval and pages_manage_ads, and paste it below.",
      "Test it with Meta’s Lead Ads Testing Tool.",
    ],
    link: true,
    verify: true,
    keys: [{ k: "key1", label: "Page Access Token" }],
  },
  whatsapp: {
    title: "WhatsApp (Cloud API)",
    about: "Every new chat on your WhatsApp Business number becomes a lead; Click-to-WhatsApp ad details are kept as the campaign.",
    steps: ["Meta app → WhatsApp → Configuration → Webhook: paste the link and verify token below.", "Subscribe to the “messages” field."],
    link: true,
    verify: true,
  },
  website: {
    title: "Website Form",
    about: "Any website (yours, WordPress, Wix) can send its enquiry form here. Paste the code below into the page.",
    steps: ["Copy the form code below into your website’s HTML.", "Fields used: name, mobile, email, city, product, message."],
    link: true,
  },
  webhook: {
    title: "Other Portal (Webhook)",
    about: "For Exporters India, Google Ads lead forms, Zapier, Pabbly or any app that can send a webhook.",
    steps: ["Send a POST (JSON or form) to the link below with fields name, mobile, email, city, product, message."],
    link: true,
  },
};

const copy = async (text: string, dispatch: any) => {
  try {
    await navigator.clipboard.writeText(text);
    dispatch(showMessage({ message: "Copied.", type: "success" }));
  } catch {
    dispatch(showMessage({ message: "Could not copy; select and copy it yourself.", type: "error" }));
  }
};
const btn = "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primary = "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const RESULT_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700", duplicate: "bg-amber-50 text-amber-700", failed: "bg-rose-50 text-rose-700", ignored: "bg-slate-100 text-slate-500",
};

function SourceCard({ cfg, staffOptions }: { cfg: any; staffOptions: { value: string; label: string }[] }) {
  const dispatch = useAppDispatch();
  const info = INFO[cfg.source];
  const refetchQueries = ["GetLeadSources", "GetLeadInbox", "GetLeadsPage", "GetLeads", "GetFollowups"];
  const [save, { loading: saving }] = useMutation(SAVE_LEAD_SOURCE, { refetchQueries });
  const [regen] = useMutation(REGENERATE_LEAD_SOURCE_LINK, { refetchQueries });
  const [pull, { loading: pulling }] = useMutation(PULL_LEAD_SOURCE_NOW, { refetchQueries });
  const [test, { loading: testing }] = useMutation(TEST_LEAD_SOURCE, { refetchQueries });
  const [keys, setKeys] = useState({ key1: "", key2: "", key3: "" });
  const [owners, setOwners] = useState<string[]>(cfg.ownerids || []);
  useEffect(() => setOwners(cfg.ownerids || []), [cfg.ownerids]);
  if (!info) return null;

  const run = async (fn: () => Promise<any>, ok: (r: any) => string) => {
    try {
      const r = await fn();
      dispatch(showMessage({ message: ok(r), type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Failed.", type: "error" }));
    }
  };
  const saveAll = (extra: any = {}) =>
    run(
      () => save({ variables: { input: { source: cfg.source, ownerids: owners, ...keys, ...extra } } }).then((r) => { setKeys({ key1: "", key2: "", key3: "" }); return r; }),
      () => "Saved."
    );

  const jdMessage = `Hello, please send my JustDial leads to my CRM by webhook.\nWebhook URL (GET or POST): ${cfg.webhookUrl}\nFields: leadid, name, mobile, email, city, area, category, company, pincode.\nThank you.`;
  const formCode = `<form onsubmit="event.preventDefault();fetch('${cfg.webhookUrl}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(this)))}).then(()=>{this.reset();alert('Thank you, we will call you shortly.')})">
  <input name="name" placeholder="Name" required>
  <input name="mobile" placeholder="Mobile" required>
  <input name="email" placeholder="Email">
  <input name="city" placeholder="City">
  <input name="product" placeholder="Product / Service">
  <textarea name="message" placeholder="Your requirement"></textarea>
  <button type="submit">Send Enquiry</button>
</form>`;

  return (
    <div className={`space-y-3 rounded-lg border bg-white p-4 text-[13px] ${cfg.enabled ? "border-emerald-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold text-slate-800">{info.title}</div>
          <div className="text-[12px] text-slate-500">{info.about}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate-500">Today: <b>{cfg.leadsToday}</b></span>
          {/* Same switch as Business Settings. */}
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px]">
            <button
              type="button"
              role="switch"
              aria-checked={!!cfg.enabled}
              aria-label={`${info.title} on or off`}
              onClick={() => saveAll({ enabled: !cfg.enabled })}
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${cfg.enabled ? "bg-green-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${cfg.enabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </button>
            <span className={cfg.enabled ? "font-medium text-green-700" : "text-slate-500"}>{cfg.enabled ? "On" : "Off"}</span>
          </label>
        </div>
      </div>
      <ol className="list-decimal space-y-0.5 pl-5 text-[12px] text-slate-600">
        {info.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      {info.link && (
        <div className="flex gap-2">
          <input readOnly className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 text-[12px]" value={cfg.webhookUrl} />
          <button type="button" className={btn} onClick={() => copy(cfg.webhookUrl, dispatch)}><Copy size={13} /> Copy Link</button>
          <button type="button" className={btn} title="Make a new secret link; the old one stops working"
            onClick={() => window.confirm("Make a new link? The old link stops working and must be replaced in the portal.") && run(() => regen({ variables: { source: cfg.source } }), () => "New link made.")}>
            <Link2 size={13} /> New Link
          </button>
        </div>
      )}
      {info.verify && (
        <div className="flex gap-2">
          <input readOnly className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 text-[12px]" value={cfg.verifyToken} />
          <button type="button" className={btn} onClick={() => copy(cfg.verifyToken, dispatch)}><Copy size={13} /> Copy Verify Token</button>
        </div>
      )}
      {cfg.source === "justdial" && <button type="button" className={btn} onClick={() => copy(jdMessage, dispatch)}><Copy size={13} /> Copy Message for JustDial</button>}
      {cfg.source === "website" && (
        <div className="space-y-1">
          <textarea readOnly className="h-28 w-full rounded-md border border-slate-300 bg-slate-50 p-2 font-mono text-[11px]" value={formCode} />
          <button type="button" className={btn} onClick={() => copy(formCode, dispatch)}><Copy size={13} /> Copy Form Code</button>
        </div>
      )}
      {(info.keys || []).length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {info.keys!.map(({ k, label }) => (
            <label key={k} className="text-[12px] text-slate-600">
              {label} {cfg[`has${k[0].toUpperCase()}${k.slice(1)}`] && <span className="text-emerald-600">(saved)</span>}
              <input type="password" autoComplete="off" className="mt-1 h-8 w-full rounded-md border border-slate-300 px-2 text-[13px]"
                placeholder={cfg[`has${k[0].toUpperCase()}${k.slice(1)}`] ? "Leave blank to keep" : ""} value={keys[k]} onChange={(e) => setKeys((x) => ({ ...x, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <div className="text-[12px] font-medium text-slate-600">
          Give new leads to <span className="font-normal text-slate-400">— in turn (round robin); none picked = admin</span>
        </div>
        {/* Same searchable multi-select as the other screens (chips, type to find). */}
        <FormField label="" name={`own-${cfg.source}`} type="multiselect" searchable options={staffOptions} placeholder="Select staff"
          value={owners} onChange={(e: any) => setOwners(Array.isArray(e.target.value) ? e.target.value : [])} />
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-[12px] text-slate-600">
          <input type="checkbox" checked={cfg.autoFollowup !== false} onChange={(e) => saveAll({ autoFollowup: e.target.checked })} />
          Book a call follow up 15 minutes after a lead arrives
        </label>
      </div>
      {cfg.lastError && <div className="rounded-md bg-rose-50 px-3 py-1.5 text-[12px] text-rose-700">Last problem: {cfg.lastError}</div>}
      {info.pull && cfg.lastPulledAt && <div className="text-[11px] text-slate-400">Last fetched {formatDateTimeDMY(cfg.lastPulledAt)}</div>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={btn} disabled={testing} onClick={() => run(() => test({ variables: { source: cfg.source } }), () => "Test lead made — see Leads.")}>
          <Send size={13} /> Send Test Lead
        </button>
        {info.pull && (
          <button type="button" className={btn} disabled={pulling} onClick={() => run(() => pull({ variables: { source: cfg.source } }), (r) => `${r?.data?.pullLeadSourceNow ?? 0} new lead(s).`)}>
            <RefreshCw size={13} /> Fetch Now
          </button>
        )}
        <button type="button" className={primary} disabled={saving} onClick={() => saveAll()}>Save</button>
      </div>
    </div>
  );
}

const LeadSources = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<"sources" | "inbox">("sources");
  const [result, setResult] = useState("");
  const { data, loading, error } = useQuery(GET_LEAD_SOURCES, { fetchPolicy: "network-only" });
  const { data: inbox } = useQuery(GET_LEAD_INBOX, { variables: { result: result || undefined, limit: 200 }, skip: tab !== "inbox", fetchPolicy: "network-only" });
  const [retry] = useMutation(RETRY_LEAD_INBOX, { refetchQueries: ["GetLeadInbox", "GetLeadsPage"] });
  const { data: staffData } = useStaffListQuery();
  const staffOptions = useMemo(() => (staffData?.getStaffAccounts || []).map((s: any) => ({ value: s.id, label: s.name })), [staffData]);

  return (
    <HomeLayout>
      <div className="w-full px-2 pb-6 pt-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[15px] font-semibold text-slate-800">Lead Sources</h1>
          <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
            {(["sources", "inbox"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`inline-flex items-center gap-1 px-3 ${tab === t ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
                {t === "sources" ? <Plug size={14} /> : <Inbox size={14} />}
                {t === "sources" ? "Sources" : "Received"}
              </button>
            ))}
          </div>
        </div>
        {tab === "sources" ? (
          <>
            <p className="mb-3 text-[12px] text-slate-500">
              Leads from these sources land in Leads with their source, are given to your staff in turn, and get a first call booked. Needs the internet; the device sees them at the next sync.
            </p>
            {loading && <div className="text-[13px] text-slate-500">Loading…</div>}
            {error && <div className="text-[13px] text-rose-600">{error.message}</div>}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {(data?.getLeadSources || []).map((cfg: any) => <SourceCard key={cfg.source} cfg={cfg} staffOptions={staffOptions} />)}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              {["", "created", "duplicate", "failed", "ignored"].map((r) => (
                <button key={r || "all"} type="button" onClick={() => setResult(r)}
                  className={`h-8 rounded-md border px-3 text-[13px] ${result === r ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                  {r ? r[0].toUpperCase() + r.slice(1) : "All"}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                  <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">From</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Note</th><th className="px-3 py-2"></th></tr>
                </thead>
                <tbody>
                  {(inbox?.getLeadInbox || []).map((r: any) => {
                    const p = r.payload?.lead || r.payload?.RESPONSE || r.payload || {};
                    const who = [p.SENDER_NAME || p.sender_name || p.name, p.SENDER_MOBILE || p.sender_mobile || p.mobile || p.from].filter(Boolean).join(" · ");
                    return (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600">{formatDateTimeDMY(r.createdAt)}</td>
                        <td className="px-3 py-2">{INFO[r.source]?.title || r.source}</td>
                        <td className="px-3 py-2 text-slate-600">{who || "—"}</td>
                        <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${RESULT_STYLE[r.result] || ""}`}>{r.result || "received"}</span></td>
                        <td className="px-3 py-2 text-[12px] text-slate-500">{r.error || ""}</td>
                        <td className="px-3 py-2 text-right">
                          {r.leadid && <button type="button" className="text-indigo-600 hover:underline" onClick={() => navigate(`/leads/addedit/${r.leadid}`)}>Open lead</button>}
                          {r.result === "failed" && (
                            <button type="button" className="ml-3 text-indigo-600 hover:underline"
                              onClick={async () => {
                                try {
                                  const ok = (await retry({ variables: { id: r.id } }))?.data?.retryLeadInbox;
                                  dispatch(showMessage({ message: ok ? "Lead made." : "Still failing; see the note.", type: ok ? "success" : "error" }));
                                } catch (e: any) {
                                  dispatch(showMessage({ message: e?.message || "Retry failed.", type: "error" }));
                                }
                              }}>
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!(inbox?.getLeadInbox || []).length && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nothing received yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </HomeLayout>
  );
};

export default LeadSources;
