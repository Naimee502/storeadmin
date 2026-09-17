import { useEffect, useRef, useState } from "react";
import { useMutation } from "@apollo/client";
import { CheckCircle2, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { REQUEST_ACCOUNT_DELETION } from "../../graphql/mutations/accountdeletion";

/**
 * Account deletion — the public page Google Play asks every app that lets
 * people sign up to publish.
 *
 * Deliberately store-neutral: no storeslug, no TenantProvider, no brand
 * colour. That is the whole point of it. Each flavour ships a different
 * applicationId and a different name, but they all run on this one
 * platform, so one address here can be pasted into every Play Console
 * listing and every in-app "Delete my account" link, and it keeps working
 * when the next flavour is added.
 *
 * The copy below is the compliance half of the page and matters as much as
 * the form. Play's requirement is not "offer a button" — it is to say
 * plainly what goes and what stays. What stays, here, is the accounting
 * trail, because Indian tax rules require it to; saying "your data is
 * deleted" while invoices sit in the database is the one answer that would
 * fail a review.
 */

// Shown at the bottom of the page. Change to the address that is actually
// monitored — Play reviewers do write to it.
const SUPPORT_EMAIL = "support@digisysindiatech.com";

export default function AccountDeletionPage() {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submit, { loading }] = useMutation(REQUEST_ACCOUNT_DELETION);

  // Clear on unmount so a pending dismissal can't fire into a dead component.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showToast = (kind: "ok" | "err", text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ kind, text });
    timer.current = setTimeout(() => setToast(null), 6000);
  };

  const digits = mobile.replace(/\D/g, "");
  const canSubmit = digits.length >= 10 && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const res = await submit({ variables: { mobile, name: name.trim(), reason: reason.trim() } });
      const out = res.data?.requestAccountDeletion;
      if (out?.ok) {
        showToast("ok", out.message);
        setMobile("");
        setName("");
        setReason("");
      } else {
        showToast("err", out?.message || "Something went wrong. Please try again.");
      }
    } catch {
      showToast("err", "We couldn't reach the server. Please check your connection and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
            <Trash2 className="h-7 w-7 text-slate-500" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Delete your account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter the mobile number you sign in with. We'll deactivate every login linked to it.
          </p>
        </div>

        {/* ---------------- form ---------------- */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <label className="block text-sm font-medium text-ink-900" htmlFor="mobile">
            Mobile number <span className="text-red-500">*</span>
          </label>
          <input
            id="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="10-digit mobile number"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />

          <label className="mt-5 block text-sm font-medium text-ink-900" htmlFor="name">
            Your name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Helps us match your request faster"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />

          <label className="mt-5 block text-sm font-medium text-ink-900" htmlFor="reason">
            Reason <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you're leaving — it helps us improve."
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />

          <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-amber-50 p-3.5 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              This cannot be undone by you. Once submitted, you will be signed out and will not be
              able to log in with this number again.
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Submitting…" : "Delete my account"}
          </button>
        </form>

        {/* ---------------- what happens ---------------- */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-semibold text-ink-900">What happens to your data</h2>
          </div>

          <h3 className="text-sm font-semibold text-ink-900">Deleted immediately</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Your login access — the account is deactivated and you are signed out everywhere</li>
            <li>Any pending one-time password (OTP) for this number</li>
            <li>The device token used to send you app notifications</li>
          </ul>

          <h3 className="mt-5 text-sm font-semibold text-ink-900">Retained, and why</h3>
          <p className="mt-2 text-sm text-slate-600">
            Invoices, payment receipts and ledger entries already issued to you are kept by the
            business you bought from. Indian tax law requires them to hold these records for up to
            six years, so they cannot be removed on request. The contact and billing details printed
            on those documents stay with them for the same reason. They are no longer linked to an
            active login and are not used to contact you.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-ink-900">Timeline</h3>
          <p className="mt-2 text-sm text-slate-600">
            Deactivation is immediate. Backup copies are cycled out within 30 days.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-ink-900">Changed your mind?</h3>
          <p className="mt-2 text-sm text-slate-600">
            Contact the business you shop with, or write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-600 underline">
              {SUPPORT_EMAIL}
            </a>
            . A deactivated account can be restored by the store for a limited time.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          This page applies to every mobile app published on this platform.
        </p>
      </div>

      {/* ---------------- toast ---------------- */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md sm:inset-x-auto sm:right-6"
        >
          <div
            className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg ${
              toast.kind === "ok" ? "bg-ink-900 text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.kind === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
