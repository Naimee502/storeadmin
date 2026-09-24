import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "@apollo/client";
import { Phone, ShieldCheck, ArrowLeft, CheckCircle2, AlertCircle, User, Mail } from "lucide-react";
import { siteConfig } from "../../config/site";
import { useTenant } from "../../contexts/tenant";
import { useAuth } from "../../contexts/auth";
import { SEND_OTP, VERIFY_OTP, REGISTER_ACCOUNT, LOGIN_PARTY } from "../../graphql/queries/accounts";

type Step = "mobile" | "register" | "otp" | "success";

// Party login — same flow as the mobile app:
//   - Login: mobile number only, no OTP (loginParty).
//   - New number: inline registration form (Name + Email, both required),
//     then an OTP sent to that EMAIL (never returned by the server), verified
//     with verifyOTP.
export default function LoginPage() {
  const { companyName, adminid, brandLogo } = useTenant();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  // Checkout (and anywhere else that requires login) links here with
  // ?redirect=/checkout so a customer lands back where they left off
  // instead of always bouncing to Home/Account after logging in.
  const redirectTo = searchParams.get("redirect");
  const brandName = companyName || siteConfig.name;
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(4).fill(""));
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const [sendOtpMutation] = useMutation(SEND_OTP);
  const [loginMutation, { loading: sending }] = useMutation(LOGIN_PARTY);
  const [info, setInfo] = useState<string | null>(null);
  const [verifyOtpMutation, { loading: verifying }] = useMutation(VERIFY_OTP);
  const [registerMutation, { loading: registering }] = useMutation(REGISTER_ACCOUNT);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const codeOf = (err: any) =>
    err?.graphQLErrors?.map((e: any) => e?.extensions?.code).find(Boolean) || err?.extensions?.code;

  // (Re)send the registration OTP to the account's email.
  const requestOtp = async () => {
    if (!adminid) return;
    setError(null);
    try {
      const { data } = await sendOtpMutation({ variables: { adminId: adminid, mobile } });
      if (!data?.sendOTP?.success) {
        setError(data?.sendOTP?.message || "Couldn't send the OTP. Please try again.");
        return;
      }
      setInfo(data.sendOTP.message || "OTP sent to your email.");
      setOtp(Array(4).fill(""));
      setStep("otp");
      setResendIn(30);
    } catch (err: any) {
      setError(err?.message || "Couldn't send the OTP. Please try again.");
    }
  };

  // Login: mobile number only, no OTP.
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminid) {
      setError("Store is still loading — please try again in a moment.");
      return;
    }
    setError(null);
    try {
      const { data } = await loginMutation({ variables: { adminId: adminid, mobile } });
      const result = data?.loginParty;
      setSession(result.accessToken, {
        id: result.account.id,
        name: result.account.name,
        mobile: result.account.mobile,
        email: result.account.email,
      });
      setStep("success");
    } catch (err: any) {
      const msg: string = err?.message || "";
      if (msg.includes("not registered")) {
        // No Account for this number yet — inline registration form.
        setStep("register");
        return;
      }
      if (codeOf(err) === "REGISTRATION_INCOMPLETE") {
        // Registered earlier but never entered the email OTP — send a new one.
        await requestOtp();
        return;
      }
      setError(msg || "Couldn't sign in. Please try again.");
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminid) return;
    setError(null);
    try {
      const { data } = await registerMutation({
        variables: { adminId: adminid, name: name.trim(), mobile, email: email.trim() },
      });
      if (!data?.registerAccount?.success) {
        setError(data?.registerAccount?.message || "Couldn't create your account. Please try again.");
        return;
      }
      setInfo(data.registerAccount.message || "OTP sent to your email.");
      setOtp(Array(4).fill(""));
      setStep("otp");
      setResendIn(30);
    } catch (err: any) {
      setError(err?.message || "Couldn't create your account. Please try again.");
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminid) return;
    setError(null);
    try {
      const { data } = await verifyOtpMutation({
        variables: { adminId: adminid, mobile, otp: otp.join("") },
      });
      const result = data?.verifyOTP;
      if (!result?.accessToken || !result?.account) {
        setError("Invalid or expired code. Please try again.");
        return;
      }
      setSession(result.accessToken, {
        id: result.account.id,
        name: result.account.name,
        mobile: result.account.mobile,
        email: result.account.email,
      });
      setStep("success");
    } catch (err: any) {
      // Same reason as above: verifyOTP re-checks the account type, so this
      // can fail for a reason that has nothing to do with the code typed in.
      setError(err?.message || "Invalid or expired code. Please try again.");
      // Pending approval means the code WAS right — the store just hasn't let
      // this customer in yet. Keeping them on the OTP step would invite them to
      // retype a code that can never work, so send them back to the start.
      // Matched on the server's error code rather than its wording.
      // Both shapes: ApolloError carries graphQLErrors, but a bare GraphQL
      // error surfaces its extensions directly.
      const pending = codeOf(err) === "ACCOUNT_PENDING_APPROVAL";
      if (pending) {
        setOtp(Array(4).fill(""));
        setStep("mobile");
      }
    }
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
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brandName}
              className="mx-auto mb-3 h-16 w-auto max-w-[240px] rounded-xl bg-white object-contain p-1 ring-1 ring-black/10"
            />
          ) : (
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 text-xl font-bold text-white">
              {brandName[0]?.toUpperCase() ?? "R"}
            </span>
          )}
          <h1 className="text-xl font-bold text-ink-900">Welcome to {brandName}</h1>
          <p className="mt-1 text-sm text-slate-500">{siteConfig.tagline}</p>
        </div>

        <div className="rounded-2xl border border-slate-100 p-6 shadow-sm">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {step === "mobile" && (
            <form onSubmit={login} className="space-y-4">
              <p className="text-sm text-slate-500">Enter your mobile number to sign in.</p>
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
                disabled={mobile.length !== 10 || sending || !adminid}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Signing in…" : "Continue"}
              </button>
              <p className="text-center text-xs text-slate-400">
                New here? Just enter your number — we'll set your account up in a moment.
              </p>
              <p className="text-center text-xs text-slate-400">
                By continuing you agree to {brandName}'s Terms of Service &amp; Privacy Policy.
              </p>
            </form>
          )}

          {step === "register" && (
            <form onSubmit={submitRegister} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setStep("mobile");
                  setError(null);
                }}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
              </button>
              <p className="text-sm text-slate-500">
                +91 {mobile} isn't registered yet — tell us a bit about yourself to get set up.
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">Full Name</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
                  <User className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">Email</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">We'll email you an OTP to verify your account.</p>
              </div>
              <button
                type="submit"
                disabled={!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || registering || !adminid}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {registering ? "Creating account…" : "Create Account & Send OTP"}
              </button>
              <p className="text-center text-xs text-slate-400">
                By continuing you agree to {brandName}'s Terms of Service &amp; Privacy Policy.
              </p>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("mobile")}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
              </button>
              <p className="text-sm text-slate-500">
                {info || "Enter the 4-digit code sent to your email."}
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
                disabled={otp.some((d) => !d) || verifying}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying ? "Verifying…" : "Verify & Continue"}
              </button>
              <p className="text-center text-xs text-slate-500">
                {resendIn > 0 ? (
                  `Resend OTP in ${resendIn}s`
                ) : (
                  <button type="button" onClick={requestOtp} className="font-semibold text-brand-700">
                    Resend OTP
                  </button>
                )}
              </p>
            </form>
          )}

          {step === "success" && <SuccessState redirectTo={redirectTo} />}
        </div>
      </div>
    </div>
  );
}

function SuccessState({ redirectTo }: { redirectTo: string | null }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <CheckCircle2 className="h-12 w-12 text-brand-600" />
      <h2 className="mt-3 text-base font-bold text-ink-900">Logged in successfully!</h2>
      <p className="mt-1 text-sm text-slate-500">Welcome back — start shopping or check your recent orders.</p>
      <div className="mt-5 flex gap-3">
        {redirectTo ? (
          <Link to={redirectTo} className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Continue
          </Link>
        ) : (
          <>
            <Link to="/" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
              Go to Home
            </Link>
            <Link to="/account" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-50">
              My Account
            </Link>
          </>
        )}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Your details are secure and never shared.
      </p>
    </div>
  );
}
