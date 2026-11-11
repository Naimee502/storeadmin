import { useState } from "react";
import { Copy, MessageCircle, Sparkles, X } from "lucide-react";
import FormField from "../formfiled";
import { useAiStatusQuery, useCrmMutations, waLink } from "../../graphql/hooks/crm";
import { useAppDispatch } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";

const btn = "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-indigo-200 bg-white px-2.5 text-[12.5px] font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50";
const sheet = "w-full max-w-lg space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl";

/** Paste an enquiry (any language) and let AI fill the lead form. */
export const AiReadInquiry = ({ onFill }: { onFill: (fields: any) => void }) => {
  const dispatch = useAppDispatch();
  const { data } = useAiStatusQuery();
  const { aiReadInquiry } = useCrmMutations();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data?.getAiStatus?.on) return null;

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await aiReadInquiry({ variables: { text } });
      const res = r?.data?.aiReadInquiry;
      if (!res?.ok || !res.fields) {
        dispatch(showMessage({ message: res?.reason || "Could not read that text.", type: "error" }));
        return;
      }
      onFill(res.fields);
      setOpen(false);
      setText("");
      dispatch(showMessage({ message: "Filled from the enquiry. Check it before saving.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not read that text.", type: "error" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={btn} onClick={() => setOpen(true)}>
        <Sparkles size={13} /> Read Enquiry
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className={sheet} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Read An Enquiry</span>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <p className="text-[12px] text-slate-500">
              Paste what the customer sent — WhatsApp, email or a portal message, in Gujarati, Hindi or English. Nothing is saved until you press Save on the form.
            </p>
            <FormField label="" name="inquiry" type="text" multiline value={text} placeholder="Paste the enquiry here"
              onChange={(e: any) => setText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" disabled={busy || !text.trim()} onClick={run}
                className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? "Reading…" : "Fill The Form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** Writes a follow-up message for one lead. The staff reads it, then sends it. */
export const AiDraftMessage = ({ leadid, mobile }: { leadid: string; mobile?: string | null }) => {
  const dispatch = useAppDispatch();
  const { data } = useAiStatusQuery();
  const { aiDraftMessage } = useCrmMutations();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("whatsapp");
  const [instruction, setInstruction] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data?.getAiStatus?.on) return null;

  const run = async () => {
    setBusy(true);
    try {
      const r = await aiDraftMessage({ variables: { leadid, channel, instruction: instruction || undefined } });
      const res = r?.data?.aiDraftMessage;
      if (!res?.ok) {
        dispatch(showMessage({ message: res?.reason || "Could not write a draft.", type: "error" }));
        return;
      }
      setText(res.text);
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not write a draft.", type: "error" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={btn} onClick={() => { setOpen(true); setText(""); }}>
        <Sparkles size={13} /> Draft Message
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className={sheet} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Draft A Message</span>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FormField label="Send On" name="channel" type="select" value={channel}
                options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "call", label: "Call Script" }]}
                onChange={(e: any) => e.target.value && setChannel(e.target.value)} />
              <div className="md:col-span-2">
                <FormField label="Anything To Add (Optional)" name="instruction" type="text" value={instruction}
                  placeholder="e.g. offer 5% discount, ask for a site visit" onChange={(e: any) => setInstruction(e.target.value)} />
              </div>
            </div>
            {text && (
              <textarea className="h-32 w-full rounded-md border border-slate-300 p-2 text-[13px]" value={text} onChange={(e) => setText(e.target.value)} />
            )}
            <p className="text-[11.5px] text-slate-500">Read it before sending. Nothing goes to the customer until you tap WhatsApp.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={run}
                className="h-8 rounded-md border border-indigo-200 px-3 font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                {busy ? "Writing…" : text ? "Write Again" : "Write"}
              </button>
              {text && (
                <button type="button" onClick={() => { navigator.clipboard?.writeText(text); dispatch(showMessage({ message: "Copied.", type: "success" })); }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-3 font-medium text-slate-700 hover:bg-slate-50">
                  <Copy size={13} /> Copy
                </button>
              )}
              {text && mobile && channel === "whatsapp" && (
                <a href={waLink(mobile, text)} target="_blank" rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 font-semibold text-white hover:bg-emerald-700">
                  <MessageCircle size={13} /> Open WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
