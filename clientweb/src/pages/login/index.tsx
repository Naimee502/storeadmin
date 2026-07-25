import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Phone, ShieldCheck, ArrowLeft, CheckCircle2, User, Mail } from "lucide-react";
import { siteConfig } from "../../config/site";
import { useTenant } from "../../contexts/tenant";
import { useAuth } from "../../contexts/auth";

type Step = "mobile" | "otp" | "success";

export default function LoginPage() {
  const { companyName } = useTenant();
  const { login } = useAuth();
  const brandName = companyName || siteConfig.name;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(4).fill(""));
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  // WebOTP API — the browser-level equivalent of the app's SMS auto-read.
  // It only fires when: (1) the page is served over HTTPS on a real
  // domain (not http://localhost), and (2) an actual SMS arrives on that
  // device containing the OTP followed by "@<domain> #<code>" on its own
  // line. Since this demo sends no real SMS, nothing will visibly happen
  // here or on localhost — this is wired up for when a real SMS gateway
  // is connected in production, where it'll auto-fill without the user
  // touching anything, same as the app.
  useEffect(() => {
    if (mode !== "login" || step !== "otp") return;
    if (!("OTPCredential" in window)) return;
    const controller = new AbortController();
    (navigator.credentials as any)
      .get({ otp: { transport: ["sms"] }, signal: controller.signal })
      .then((otpCred: any) => {
        const code: string | undefined = otpCred?.code;
        if (code) handleOtpChange(0, code);
      })
      .catch(() => {
        // Aborted (user left the step) or unsupported — ignore.
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, step]);

  const sendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
      setResendIn(30);
    }, 700);
  };

  const verifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("success");
      login({ name: "Customer", mobile });
    }, 700);
  };

  const handleOtpChange = (idx: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "");
    if (!digits) {
      const next = [...otp];
      next[idx] = "";
      setOtp(next);
      return;
    }
    // Supports both a single keystroke and the browser/OS auto-filling the
    // whole SMS code (some browsers drop the full code into one box), same
    // as the app's OTP screen auto-filling all digits at once.
    const next = [...otp];
    let cursor = idx;
    for (const d of digits) {
      if (cursor > otp.length - 1) break;
      next[cursor] = d;
      cursor++;
    }
    setOtp(next);
    const focusIdx = Math.min(cursor, otp.length - 1);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 text-xl font-bold text-white">
            {brandName[0]?.toUpperCase() ?? "R"}
          </span>
          <h1 className="text-xl font-bold text-ink-900">Welcome to {brandName}</h1>
          <p className="mt-1 text-sm text-slate-500">{siteConfig.tagline}</p>
        </div>

        <div className="rounded-2xl border border-slate-100 p-6 shadow-sm">
          {/* Tabs */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setStep("mobile");
                }}
                className={`rounded-md py-2 text-sm font-semibold transition ${
                  mode === m ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                }`}
              >
                {m === "login" ? "Login" : "Create Account"}
              </button>
            ))}
          </div>

          {mode === "login" && step === "mobile" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <p className="text-sm text-slate-500">Enter your registered mobile number to receive a one-time password.</p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">Mobile Number</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                    placeholder="98765 43210"
                    className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={mobile.length !== 10 || loading}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending OTP…" : "Send OTP"}
              </button>
              <p className="text-center text-xs text-slate-400">
                By continuing you agree to {brandName}'s Terms of Service &amp; Privacy Policy.
              </p>
            </form>
          )}

          {mode === "login" && step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("mobile")}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
              </button>
              <p className="text-sm text-slate-500">
                Enter the 4-digit code sent to <span className="font-semibold text-ink-900">+91 {mobile}</span>
              </p>
              <div className="flex justify-center gap-2.5">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    maxLength={i === 0 ? 4 : 1}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="h-11 w-11 rounded-lg border border-slate-200 text-center text-base font-semibold outline-none focus:border-brand-500"
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={otp.some((d) => !d) || loading}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify & Continue"}
              </button>
              <p className="text-center text-xs text-slate-500">
                {resendIn > 0 ? (
                  `Resend OTP in ${resendIn}s`
                ) : (
                  <button type="button" onClick={() => setResendIn(30)} className="font-semibold text-brand-700">
                    Resend OTP
                  </button>
                )}
              </p>
            </form>
          )}

          {mode === "login" && step === "success" && <SuccessState />}

          {mode === "register" && step !== "success" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep("success");
                login({ name: regName.trim() || "Customer", mobile: regMobile });
              }}
              className="space-y-4"
            >
              <Field
                icon={User}
                label="Full Name"
                placeholder="Your name"
                required
                value={regName}
                onChange={(v) => setRegName(v)}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">Mobile Number</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">+91</span>
                  <input
                    required
                    maxLength={10}
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ""))}
                    placeholder="98765 43210"
                    className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
              <Field
                icon={Mail}
                label="Email (optional)"
                placeholder="you@example.com"
                type="email"
                value={regEmail}
                onChange={(v) => setRegEmail(v)}
              />
              <button type="submit" className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
                Create Account
              </button>
            </form>
          )}

          {mode === "register" && step === "success" && <SuccessState registered />}
        </div>
      </div>
    </div>
  );
}

function SuccessState({ registered }: { registered?: boolean }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <CheckCircle2 className="h-12 w-12 text-brand-600" />
      <h2 className="mt-3 text-base font-bold text-ink-900">
        {registered ? "Account created!" : "Logged in successfully!"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {registered
          ? "Your account is ready — start shopping right away."
          : "Welcome back — start shopping or check your recent orders."}
      </p>
      <div className="mt-5 flex gap-3">
        <Link to="/" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Go to Home
        </Link>
        <Link to="/account" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-50">
          My Account
        </Link>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Your details are secure and never shared.
      </p>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  placeholder,
  type = "text",
  required,
  value,
  onChange,
}: {
  icon: typeof User;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-900">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
        <Icon className="h-4 w-4 text-slate-400" />
        <input
          type={type}
          required={required}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}
