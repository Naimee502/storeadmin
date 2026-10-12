import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import { ArrowLeft, Megaphone, Send, X, ExternalLink, Trash2, AlertTriangle, ImagePlus } from "lucide-react";
import { uploadImage } from "../../utils/uploadimage";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";
import { useAnnouncementsEnabled } from "../../hooks/useModuleEnabled";
import {
  GET_MY_ANNOUNCEMENTS,
  GET_SENT_ANNOUNCEMENTS,
  GET_ANNOUNCEMENT_TARGETS,
  ADD_ANNOUNCEMENT,
  DELETE_ANNOUNCEMENT,
  MARK_ANNOUNCEMENT_READ,
} from "../../graphql/queries/announcements";

const SENDER: Record<string, string> = { admin: "Admin", branch: "Branch", staff: "Salesman", party: "Distributor" };
const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

/**
 * Announcements for a logged-in party. A channel party with sub-parties (and
 * the business's "party manages downline" setting on) can also send its own
 * announcements — the server only ever delivers those to its sub-parties.
 */
export default function AnnouncementsPage() {
  const { isLoggedIn } = useAuth();
  const enabled = useAnnouncementsEnabled();
  const navigate = useNavigate();

  const inbox = useQuery(GET_MY_ANNOUNCEMENTS, { skip: !isLoggedIn || !enabled, fetchPolicy: "cache-and-network" });
  const targets = useQuery(GET_ANNOUNCEMENT_TARGETS, { skip: !isLoggedIn || !enabled, fetchPolicy: "cache-and-network" });
  const subParties: any[] = targets.data?.getAnnouncementTargets?.parties ?? [];
  const canSend = subParties.length > 0;
  const sent = useQuery(GET_SENT_ANNOUNCEMENTS, { skip: !isLoggedIn || !enabled || !canSend, fetchPolicy: "cache-and-network" });

  const [markRead] = useMutation(MARK_ANNOUNCEMENT_READ, { refetchQueries: ["GetMyAnnouncements"] });
  const [addAnn] = useMutation(ADD_ANNOUNCEMENT, { refetchQueries: ["GetSentAnnouncements"] });
  const [deleteAnn] = useMutation(DELETE_ANNOUNCEMENT, { refetchQueries: ["GetSentAnnouncements"] });

  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [toAll, setToAll] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageurl, setImageurl] = useState("");
  const [uploading, setUploading] = useState(false);

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      setImageurl(await uploadImage(file));
    } catch (err: any) {
      setError(err?.message || "Could not upload the picture.");
    } finally {
      setUploading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? subParties.filter((p) => `${p.name} ${p.sub || ""}`.toLowerCase().includes(q)) : subParties;
  }, [subParties, search]);

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!enabled) return <Navigate to="/account" replace />;

  const items: any[] = tab === "inbox" ? inbox.data?.getMyAnnouncements ?? [] : sent.data?.getSentAnnouncements ?? [];

  const toggle = (a: any) => {
    setOpenId((cur) => (cur === a.id ? null : a.id));
    if (tab === "inbox" && !a.read) markRead({ variables: { id: a.id } }).catch(() => {});
  };

  const send = async () => {
    setError("");
    if (!title.trim()) return setError("Enter a title.");
    if (!toAll && picked.length === 0) return setError("Pick at least one sub-party.");
    setBusy(true);
    try {
      await addAnn({
        variables: {
          input: { title: title.trim(), message: message.trim(), imageurl, audience: { mySubParties: toAll, partyIds: toAll ? [] : picked } },
        },
      });
      setComposing(false);
      setTitle("");
      setMessage("");
      setImageurl("");
      setPicked([]);
      setToAll(true);
      setTab("sent");
    } catch (e: any) {
      setError(e?.message || "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Announcements" }]} />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/account")}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Account
        </button>

        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-ink-900">Announcements</h1>
          {canSend && (
            <button
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Send className="h-4 w-4" /> Send to sub-parties
            </button>
          )}
        </div>

        {canSend && (
          <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
            {(["inbox", "sent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-white text-brand-700 shadow" : "text-slate-500"}`}
              >
                {t === "inbox" ? "Inbox" : "Sent"}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 py-16 text-center">
            <Megaphone className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">{tab === "inbox" ? "No announcements yet." : "You have not sent any announcements."}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((a) => {
              const open = openId === a.id;
              const unread = tab === "inbox" && !a.read;
              return (
                <div key={a.id} className={`overflow-hidden rounded-xl border bg-white ${unread ? "border-brand-300" : "border-slate-100"}`}>
                  {/* Offer / festival banner leads the card, like a shopping-app deal. */}
                  {a.imageurl && (
                    <button onClick={() => toggle(a)} className="block w-full">
                      <img src={a.imageurl} alt="" className="aspect-video w-full object-cover" />
                    </button>
                  )}
                  <div className="p-4">
                  <button onClick={() => toggle(a)} className="flex w-full items-start gap-3 text-left">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${a.priority === "important" ? "bg-rose-500" : "bg-brand-500"}`}>
                      {a.priority === "important" ? <AlertTriangle className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-ink-900">{a.title}</span>
                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                      </span>
                      {!open && a.message && <span className="block truncate text-sm text-slate-500">{a.message}</span>}
                      <span className="mt-1 block text-xs text-slate-400">
                        {tab === "inbox"
                          ? `${a.sendername || SENDER[a.sendertype] || ""} · ${fmt(a.startAt)}`
                          : `${a.audienceLabel} · seen ${a.readcount}/${a.recipientcount} · ${fmt(a.startAt)}`}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-3 pl-12">
                      {a.message && <p className="whitespace-pre-line text-sm text-ink-900">{a.message}</p>}
                      {a.link && (
                        <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                          <ExternalLink className="h-4 w-4" /> Open link
                        </a>
                      )}
                      {tab === "sent" && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${a.title}"? It disappears for everyone.`)) {
                              deleteAnn({ variables: { id: a.id } }).catch(() => {});
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {composing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">New Announcement</h2>
              <button onClick={() => setComposing(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-1 block text-sm font-semibold text-ink-900">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <label className="mb-1 block text-sm font-semibold text-ink-900">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <label className="mb-1 block text-sm font-semibold text-ink-900">Picture (optional)</label>
            {imageurl ? (
              <div className="relative mb-3 overflow-hidden rounded-lg">
                <img src={imageurl} alt="" className="aspect-video w-full object-cover" />
                <button onClick={() => setImageurl("")} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="mb-3 flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-brand-300">
                <ImagePlus className="h-6 w-6" />
                {uploading ? "Uploading…" : "Add offer banner / picture"}
                <input type="file" accept="image/*" className="hidden" onChange={onPickImage} disabled={uploading} />
              </label>
            )}
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <input type="checkbox" checked={toAll} onChange={(e) => setToAll(e.target.checked)} />
              All my sub-parties ({subParties.length})
            </label>
            {!toAll && (
              <div className="mb-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sub-party…"
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2">
                  {filtered.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={picked.includes(p.id)}
                        onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))}
                      />
                      <span className="font-medium text-ink-900">{p.name}</span>
                      {p.sub && <span className="text-xs text-slate-400">{p.sub}</span>}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">{picked.length} selected</p>
              </div>
            )}
            {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
            <button
              onClick={send}
              disabled={busy || uploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
