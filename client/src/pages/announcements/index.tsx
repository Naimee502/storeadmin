import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";

import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import Modal from "../../components/modal";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions } from "../../redux/slices/permissions";
import { useImageUpload } from "../../graphql/hooks/uploads";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { formatDateDMY } from "../../utils/helper";
import {
  GET_ANNOUNCEMENTS,
  GET_ANNOUNCEMENT_TARGETS,
  ADD_ANNOUNCEMENT,
  EDIT_ANNOUNCEMENT,
  DELETE_ANNOUNCEMENT,
} from "../../graphql/queries/announcement";

/**
 * Announcements — admin / branch send a notice to a chosen audience; it shows
 * in the app (staff + parties) and on the website (parties). Salesmen and
 * channel parties can also send from the app / website to their own parties.
 */

const ROLE_OPTIONS = [
  { value: "salesman", label: "Salesmen" },
  { value: "deliveryboy", label: "Delivery Boys" },
  { value: "staff", label: "Office Staff" },
];

const SENDER_LABEL: Record<string, string> = { admin: "Admin", branch: "Branch", staff: "Salesman", party: "Party" };

const ymd = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");

type Form = {
  title: string;
  message: string;
  imageurl: string;
  link: string;
  priority: string;
  startAt: string;
  expireAt: string;
  branchid: string;
  everyone: boolean;
  staffAll: boolean;
  staffRoles: string[];
  staffIds: string[];
  partyAll: boolean;
  partyChannels: string[];
  partyIds: string[];
};

const emptyForm = (): Form => ({
  title: "",
  message: "",
  imageurl: "",
  link: "",
  priority: "normal",
  startAt: new Date().toISOString().slice(0, 10),
  expireAt: "",
  branchid: "",
  everyone: false,
  staffAll: false,
  staffRoles: [],
  staffIds: [],
  partyAll: false,
  partyChannels: [],
  partyIds: [],
});

const Announcements = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "announcements"));
  const authType = useAppSelector((s) => s.auth.type);
  const myId = useAppSelector((s: any) =>
    s.auth.type === "admin" ? s.auth.admin?.id : s.auth.type === "branch" ? s.auth.branch?.id : s.auth.staff?.id
  );
  const { data: branchesData } = useBranchesQuery();
  const branches: any[] = (branchesData?.getBranches || []).filter((b: any) => b.status !== false);
  const notify = (message: string, type: "success" | "error" = "success") => dispatch(showMessage({ message, type }));

  const { data, loading } = useQuery(GET_ANNOUNCEMENTS, { fetchPolicy: "cache-and-network" });
  const [open, setOpen] = useState(false);
  const { data: targetsData } = useQuery(GET_ANNOUNCEMENT_TARGETS, { skip: !open, fetchPolicy: "cache-and-network" });
  const [addMut] = useMutation(ADD_ANNOUNCEMENT, { refetchQueries: ["GetAnnouncements"] });
  const [editMut] = useMutation(EDIT_ANNOUNCEMENT, { refetchQueries: ["GetAnnouncements"] });
  const [deleteMut] = useMutation(DELETE_ANNOUNCEMENT, { refetchQueries: ["GetAnnouncements", "GetDeletedAnnouncements"] });
  const { uploadImageMutation } = useImageUpload();

  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Announcement whose picture is open in the preview modal.
  const [preview, setPreview] = useState<any>(null);

  const targets = targetsData?.getAnnouncementTargets || { staff: [], parties: [], channels: [] };
  const staffOptions = useMemo(
    () => targets.staff.map((s: any) => ({ value: s.id, label: `${s.name}${s.sub ? ` (${s.sub === "deliveryboy" ? "delivery" : s.sub})` : ""}` })),
    [targets.staff]
  );
  const partyOptions = useMemo(
    () => targets.parties.map((p: any) => ({ value: p.id, label: `${p.name}${p.sub ? ` — ${p.sub}` : ""}` })),
    [targets.parties]
  );
  const channelOptions = useMemo(() => targets.channels.map((c: any) => ({ value: c.id, label: c.name })), [targets.channels]);

  const set = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const onChange = (e: any) => set(e.target.name, e.target.type === "checkbox" ? e.target.checked : e.target.value);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };
  const openEdit = (row: any) => {
    const a = row.audience || {};
    setEditing(row);
    setForm({
      title: row.title,
      message: row.message || "",
      imageurl: row.imageurl || "",
      link: row.link || "",
      priority: row.priority || "normal",
      startAt: ymd(row.startAt),
      expireAt: ymd(row.expireAt),
      branchid: row.branchid || "",
      everyone: !!a.everyone,
      staffAll: !!a.staffAll,
      staffRoles: a.staffRoles || [],
      staffIds: a.staffIds || [],
      partyAll: !!a.partyAll,
      partyChannels: a.partyChannels || [],
      partyIds: a.partyIds || [],
    });
    setOpen(true);
  };

  const onImage = async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: up } = await uploadImageMutation({ variables: { file } }, "banner");
      set("imageurl", up?.uploadImage?.url || "");
    } catch (err: any) {
      notify(err?.message || "Image upload failed.", "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) return notify("Title is required.", "error");
    const audience = {
      everyone: form.everyone,
      staffAll: !form.everyone && form.staffAll,
      staffRoles: form.everyone || form.staffAll ? [] : form.staffRoles,
      staffIds: form.everyone || form.staffAll ? [] : form.staffIds,
      partyAll: !form.everyone && form.partyAll,
      partyChannels: form.everyone || form.partyAll ? [] : form.partyChannels,
      partyIds: form.everyone || form.partyAll ? [] : form.partyIds,
    };
    const input = {
      title: form.title.trim(),
      message: form.message,
      imageurl: form.imageurl,
      link: form.link.trim(),
      priority: form.priority,
      startAt: form.startAt || null,
      expireAt: form.expireAt ? `${form.expireAt}T23:59:59` : null,
      branchid: authType === "admin" ? form.branchid || null : null,
      audience,
    };
    setSaving(true);
    try {
      if (editing) {
        await editMut({ variables: { id: editing.id, input } });
        notify("Announcement updated.");
      } else {
        const { data: res } = await addMut({ variables: { input } });
        notify(`Announcement sent to ${res?.addAnnouncement?.recipientcount ?? 0} people.`);
      }
      setOpen(false);
    } catch (err: any) {
      notify(err?.message || "Could not save the announcement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const now = Date.now();
  const rows = (data?.getAnnouncements || []).map((a: any, i: number) => {
    const started = !a.startAt || new Date(a.startAt).getTime() <= now;
    const expired = a.expireAt && new Date(a.expireAt).getTime() <= now;
    const state = expired ? "Expired" : started ? "Live" : "Scheduled";
    const stateCls = expired ? "bg-gray-100 text-gray-600" : started ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
    return {
      ...a,
      seqNo: i + 1,
      titleCell: (
        <span className="inline-flex items-center gap-2 max-w-[260px]" title={a.message}>
          {a.priority === "important" && <span className="px-1.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">IMPORTANT</span>}
          <span className="truncate font-medium">{a.title}</span>
        </span>
      ),
      // Picture gets its own column — the Title cell stays text only.
      imageCell: a.imageurl ? (
        <button type="button" onClick={() => setPreview(a)} title="View picture" className="block">
          <img src={a.imageurl} alt="" className="h-10 w-[72px] rounded object-cover border hover:opacity-80" />
        </button>
      ) : (
        <span className="text-gray-400">-</span>
      ),
      audienceCell: <span className="max-w-[220px] inline-block truncate align-middle" title={a.audienceLabel}>{a.audienceLabel}</span>,
      senderCell: `${a.sendername || "-"} (${SENDER_LABEL[a.sendertype] || a.sendertype})`,
      dates: `${a.startAt ? formatDateDMY(new Date(a.startAt)) : "-"}${a.expireAt ? ` → ${formatDateDMY(new Date(a.expireAt))}` : ""}`,
      seen: `${a.readcount} / ${a.recipientcount}`,
      stateCell: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stateCls}`}>{state}</span>,
    };
  });

  const checkbox = (label: string, name: keyof Form, disabled = false) => (
    <label className={`inline-flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" checked={!!form[name]} disabled={disabled} onChange={(e) => set(name, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Announcements"
          columns={[
            { label: "#", key: "seqNo" },
            { label: "Image", key: "imageCell" },
            { label: "Title", key: "titleCell" },
            { label: "Audience", key: "audienceCell" },
            { label: "Sent By", key: "senderCell" },
            { label: "Dates", key: "dates" },
            { label: "Seen", key: "seen" },
            { label: "Status", key: "stateCell" },
          ]}
          data={rows}
          {...actions}
          showView={false}
          showReset={false}
          showImport={false}
          showExport={false}
          // Only the sender edits a message; an admin can still delete anyone's.
          showEdit={(row: any) => actions.showEdit && row.senderid === myId}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={async (row: any) => {
            if (!window.confirm(`Delete announcement "${row.title}"? It disappears from everyone's feed.`)) return;
            try {
              await deleteMut({ variables: { id: row.id } });
              notify("Announcement deleted.");
            } catch (err: any) {
              notify(err?.message || "Could not delete.", "error");
            }
          }}
          onShowDeleted={() => navigate("/announcements/deletedentries")}
          entriesOptions={[10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={loading && rows.length === 0}
        />

        <Modal isOpen={!!preview} onClose={() => setPreview(null)} type="custom" title={preview?.title || "Picture"} size="md">
          {preview && (
            // Kept well under the screen height so the modal never runs up
            // behind the top header, whatever the picture's shape.
            <div className="space-y-3">
              <img src={preview.imageurl} alt="" className="w-full max-h-[50vh] object-contain rounded bg-gray-50" />
              {preview.message && <p className="text-sm text-gray-700 whitespace-pre-line max-h-24 overflow-y-auto">{preview.message}</p>}
            </div>
          )}
        </Modal>

        <Modal isOpen={open} onClose={() => setOpen(false)} type="custom" title={editing ? "Edit Announcement" : "New Announcement"} size="lg">
          <div className="space-y-3">
            <FormField label="Title" name="title" value={form.title} onChange={onChange} required />
            <FormField label="Message" name="message" value={form.message} onChange={onChange} multiline />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                label="Priority"
                name="priority"
                type="select"
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "important", label: "Important (pop-up in app)" },
                ]}
                value={form.priority}
                onChange={onChange}
              />
              <FormField label="Show From" name="startAt" type="date" value={form.startAt} onChange={onChange} />
              <FormField label="Show Until (optional)" name="expireAt" type="date" value={form.expireAt} onChange={onChange} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <FormField label="Link (optional)" name="link" value={form.link} onChange={onChange} placeholder="https://…" />
              <div>
                <label className="text-sm font-medium text-gray-700">Offer banner / Image (optional, wide 16:9 looks best)</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="file" accept="image/*" onChange={onImage} disabled={uploading} className="text-sm" />
                  {uploading && <span className="text-xs text-gray-500">Uploading…</span>}
                </div>
                {form.imageurl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.imageurl} alt="" className="h-14 rounded border" />
                    <button className="text-xs text-red-600" onClick={() => set("imageurl", "")}>Remove</button>
                  </div>
                )}
              </div>
            </div>

            {authType === "admin" && branches.length > 0 && (
              <FormField
                label="Branch"
                name="branchid"
                type="select"
                options={[{ value: "", label: "All branches" }, ...branches.map((b: any) => ({ value: b.id, label: b.branchname }))]}
                value={form.branchid}
                onChange={onChange}
              />
            )}

            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="font-semibold text-sm">Send To</div>
              {checkbox("Everyone (all staff and all parties)", "everyone")}

              <div className={`space-y-2 ${form.everyone ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="text-xs font-semibold text-gray-500 uppercase">Staff</div>
                {checkbox("All staff", "staffAll")}
                {!form.staffAll && (
                  <>
                    <div className="flex flex-wrap gap-4">
                      {ROLE_OPTIONS.map((r) => (
                        <label key={r.value} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.staffRoles.includes(r.value)}
                            onChange={(e) =>
                              set("staffRoles", e.target.checked ? [...form.staffRoles, r.value] : form.staffRoles.filter((x) => x !== r.value))
                            }
                          />
                          All {r.label}
                        </label>
                      ))}
                    </div>
                    <FormField label="Particular staff" name="staffIds" type="multiselect" searchable options={staffOptions} value={form.staffIds} onChange={onChange} />
                  </>
                )}

                <div className="text-xs font-semibold text-gray-500 uppercase pt-2">Parties</div>
                {checkbox("All parties", "partyAll")}
                {!form.partyAll && (
                  <>
                    {channelOptions.length > 0 && (
                      <FormField label="Channel-wise" name="partyChannels" type="multiselect" searchable options={channelOptions} value={form.partyChannels} onChange={onChange} />
                    )}
                    <FormField label="Particular parties" name="partyIds" type="multiselect" searchable options={partyOptions} value={form.partyIds} onChange={onChange} />
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Shows in the app for staff and parties, and on the website for parties. People who match get a phone notification
              when it goes live today; one scheduled for a later date just appears in their feed on that date.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || uploading}>{saving ? "Saving…" : editing ? "Save" : "Send"}</Button>
            </div>
          </div>
        </Modal>
      </div>
    </HomeLayout>
  );
};

export default Announcements;
