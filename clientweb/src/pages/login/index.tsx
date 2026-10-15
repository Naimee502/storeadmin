import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "@apollo/client";
import { Phone, ShieldCheck, ArrowLeft, CheckCircle2, AlertCircle, User, Mail, Hash } from "lucide-react";
import { siteConfig } from "../../config/site";
import { useTenant } from "../../contexts/tenant";
import { useAuth } from "../../contexts/auth";
import { SEND_OTP, VERIFY_OTP, REGISTER_ACCOUNT, LOGIN_PARTY } from "../../graphql/queries/accounts";

type Step = "mobile" | "register" | "addEmail" | "otp" | "success";

// Party login — same flow as the mobile app:
//   - Login: mobile number (loginParty). If the business has "Party login needs
//     an email OTP" on, the server mails an OTP and answers LOGIN_OTP_REQUIRED;
//     the OTP step then repeats loginParty with the code (otpPurpose "login").
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
  // Which OTP the OTP step is for: finishing a registration (verifyOTP) or the
  // optional login OTP (loginParty with otp). Both are 4 digits.
  const [otpPurpose, setOtpPurpose] = useState<"register" | "login">("register");
  // A registered party with no email on file (login OTP on): they add one
  // here, the OTP goes to it, and the server saves it once the OTP is right.
  const [loginEmail, setLoginEmail] = useState("");
  // Account Code (Party Accounts, e.g. #ACC0001) — proves it's the party
  // before an email can be attached. Checked by the server on every call.
  const [accountCode, setAccountCode] = useState("");
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
      setOtpPurpose("register");
      setStep("otp");
      setResendIn(30);
    } catch (err: any) {
      setError(err?.message || "Couldn't send the OTP. Please try again.");
    }
  };

  // Sent with every loginParty call once the customer has typed an email on
  // the "add email" step; ignored by the server if one is already on file.
  const loginVars = (extra: Record<string, any> = {}) => ({
    adminId: adminid,
    mobile,
    ...(loginEmail.trim() ? { email: loginEmail.trim(), accountCode: accountCode.trim() } : {}),
    ...extra,
  });

  const startSession = (result: any) => {
    setSession(result.accessToken, {
      id: result.account.id,
      name: result.account.name,
      mobile: result.account.mobile,
      email: result.account.email,
    });
    setStep("success");
  };

  // The server mailed a login OTP — move to the OTP step. Also what "Resend
  // OTP" lands on in login mode: loginParty without an otp mails a new one.
  const showLoginOtpStep = (err: any) => {
    const ext =
      err?.graphQLErrors?.find((e: any) => e?.extensions?.code === "LOGIN_OTP_REQUIRED")?.extensions ||
      err?.extensions ||
      {};
    setInfo(err?.message || "Enter the 4-digit OTP sent to your email.");
    setOtp(Array(4).fill(""));
    setOtpPurpose("login");
    setStep("otp");
    setResendIn(Number(ext.resendIn) > 0 ? Number(ext.resendIn) : 60);
    setTimeout(() => inputsRef.current[0]?.focus(), 50);
  };

  // Resend in login mode: ask loginParty again without an otp.
  const resendLoginOtp = async () => {
    if (!adminid) return;
    setError(null);
    try {
      const { data } = await loginMutation({ variables: loginVars() });
      // The setting was switched off meanwhile — just log in.
      startSession(data?.loginParty);
    } catch (err: any) {
      if (codeOf(err) === "LOGIN_OTP_REQUIRED") showLoginOtpStep(err);
      else setError(err?.message || "Couldn't send the OTP. Please try again.");
    }
  };

  // Login: mobile number; may be followed by the login OTP step.
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminid) {
      setError("Store is still loading — please try again in a moment.");
      return;
    }
    setError(null);
    setLoginEmail("");
    setAccountCode("");
    try {
      const { data } = await loginMutation({ variables: { adminId: adminid, mobile } });
      startSession(data?.loginParty);
    } catch (err: any) {
      const msg: string = err?.message || "";
      if (codeOf(err) === "LOGIN_OTP_REQUIRED") {
        showLoginOtpStep(err);
        return;
      }
      if (codeOf(err) === "LOGIN_OTP_NO_EMAIL") {
        // Registered, but no email to send the login OTP to — ask for one.
        setStep("addEmail");
        return;
      }
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

  // "Add email" step: send the OTP to the address they typed.
  const submitAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminid) return;
    setError(null);
    try {
      const { data } = await loginMutation({ variables: loginVars() });
      startSession(data?.loginParty); // setting switched off meanwhile
    } catch (err: any) {
      if (codeOf(err) === "LOGIN_OTP_REQUIRED") showLoginOtpStep(err);
      else setError(err?.message || "Couldn't send the OTP. Please try again.");
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
      setOtpPurpose("register");
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
    if (otpPurpose === "login") {
      try {
        const { data } = await loginMutation({ variables: loginVars({ otp: otp.join("") }) });
        startSession(data?.loginParty);
      } catch (err: any) {
        setError(err?.message || "Invalid or expired code. Please try again.");
        setOtp(Array(4).fill(""));
        inputsRef.current[0]?.focus();
      }
      return;
    }
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

          {step === "addEmail" && (
            <form onSubmit={submitAddEmail} className="space-y-4">
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
                No email is saved for +91 {mobile} yet. Enter your Account Code and an email — we'll send a one-time
                code there and save it on your account once verified.
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">Account Code</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand-500">
                  <Hash className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value.toUpperCase())}
                    placeholder="ACC0001"
                    autoComplete="off"
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
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!accountCode.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim()) || sending || !adminid}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending OTP…" : "Send OTP"}
              </button>
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
                onClick={() => {
                  setStep("mobile");
                  setError(null);
                }}
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
                disabled={otp.some((d) => !d) || verifying || sending}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying || sending ? "Verifying…" : "Verify & Continue"}
              </button>
              <p className="text-center text-xs text-slate-500">
                {resendIn > 0 ? (
                  `Resend OTP in ${resendIn}s`
                ) : (
                  <button
                    type="button"
                    onClick={otpPurpose === "login" ? resendLoginOtp : requestOtp}
                    className="font-semibold text-brand-700"
                  >
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
