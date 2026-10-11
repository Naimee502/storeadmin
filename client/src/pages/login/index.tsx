import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import LoginLayout from "../../layouts/login";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import loginImage from "../../assets/images/login.jpg";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { saveAuthData } from "../../redux/slices/auth";
import { setBranchId } from "../../redux/slices/branch";
import { useBranchesQuery, useLoginBranchMutation } from "../../graphql/hooks/branches";
import { useLoginAdminMutation } from "../../graphql/hooks/admin";
import { useLoginStaffMutation } from "../../graphql/hooks/staffaccounts";
import { useAuth } from "../../contexts/auth";

const Login = () => {
  const dispatch = useAppDispatch();
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data, refetch } = useBranchesQuery();
  const branchList = data?.getBranches || [];
  const [loginAdmin] = useLoginAdminMutation();
  const [loginBranch] = useLoginBranchMutation();
  const [loginStaff] = useLoginStaffMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState<"branch" | "admin" | "staff">("branch");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [invalidCredentialError, setInvalidCredentialError] = useState("");
  const isExpiringSoon = useAppSelector(state => state.auth.admin?.isExpiringSoon);

  // Email-OTP step (Business Settings -> "Billing panel login needs an email
  // OTP"). The server answers the first login with LOGIN_OTP_REQUIRED after
  // mailing the OTP; the same login is then repeated with the OTP attached.
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const resetOtpStep = () => {
    setOtpStep(false);
    setOtp("");
    setOtpInfo("");
    setResendIn(0);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpStep && !/^\d{6}$/.test(otp.trim())) {
      setInvalidCredentialError("Enter the 6-digit OTP sent to your email.");
      return;
    }
    doLogin(otpStep ? otp.trim() : undefined);
  };

  const doLogin = async (otpValue?: string) => {
    if (busy) return;
    setEmailError("");
    setPasswordError("");
    setInvalidCredentialError("");

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }

    setBusy(true);
    try {
      if (loginType === "staff") {
        const res = await loginStaff({ variables: { email, password, otp: otpValue } });
        const loginData = res.data?.loginStaff;
        const staff = loginData?.staff;
        const accessToken = loginData?.accessToken;

        if (!staff || !accessToken) throw new Error("Invalid credentials");

        const admin = staff.admin;
        if (!admin || !admin.subscribed) {
          throw new Error("Admin subscription required.");
        }

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("branchid", staff.branchid?.id || "");
        localStorage.setItem("adminid", admin.id || "");
        dispatch(setBranchId(staff.branchid?.id || ""));
        dispatch(saveAuthData({ type: "staff", staff: staff }));
        login();
        navigate("/home");
        return;
      } else if (loginType === "admin") {
        const res = await loginAdmin({ variables: { email, password, otp: otpValue } });
        const loginData = res.data?.loginAdmin;
        const admin = loginData?.admin;
        const accessToken = loginData?.accessToken;

        if (!admin || !accessToken) throw new Error("Invalid credentials");

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("adminid", admin.id || "");

        if (!admin.subscribed) {
          if (admin.needsReview) {
            throw new Error("Your subscription is under review.");
          } else if (admin.rejected) {
            throw new Error("Your subscription was rejected. Please resubmit.");
          } else {
            return navigate("/subscription");
          }
        }

        const subscriptionEndDate = new Date(admin.subscriptionEnd);
        const today = new Date();
        const diffInTime = subscriptionEndDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffInTime / (1000 * 3600 * 24));
        const isExpiring = daysRemaining <= 3;

        const authData = {
          type: "admin" as const,
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            companyName: admin.companyName,
            mobile: admin.mobile,
            address: admin.address,
            noOfBranches: admin.noOfBranches,
            subscriptionType: admin.subscriptionType,
            subscribed: admin.subscribed,
            subscribedAt: admin.subscribedAt,
            subscriptionEnd: admin.subscriptionEnd,
            transactionId: admin.transactionId,
            businesstype: admin.businesstype,
            isMultibranch: admin.isMultibranch,
            isChannelCustomers: admin.isChannelCustomers,
            allowedmodules: admin.allowedmodules,
            needsReview: admin.needsReview,
            rejected: admin.rejected,
            isExpiringSoon: isExpiring,
          },
        };

        dispatch(saveAuthData(authData));
        
        login();
        navigate("/home");
      } else {
        const res = await loginBranch({ variables: { email, password, otp: otpValue } });
        const loginData = res.data?.loginBranch;
        const branch = loginData?.branch;
        const accessToken = loginData?.accessToken;

        if (!branch || !accessToken) throw new Error("Invalid credentials");

        const admin = branch.admin;
        if (!admin || !admin.subscribed) {
          if (admin.needsReview) {
            throw new Error("Admin subscription is under review.");
          } else if (admin.rejected) {
            throw new Error("Admin subscription was rejected. Please resubmit.");
          } else {
            return navigate("/subscription");
          }
        }

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("branchid", branch.id);
        localStorage.setItem("adminid", admin.id || "");
        dispatch(setBranchId(branch.id));
        dispatch(saveAuthData({ type: "branch", branch: branch }));
        login();
        navigate("/home");
      }
    } catch (err: any) {
      // The server rejects an unsubscribed admin before returning any data, so
      // the in-flow `navigate("/subscription")` above never runs. Route on the
      // error code the resolver attaches instead.
      const gqlError = err?.graphQLErrors?.[0];
      const code = gqlError?.extensions?.code || err?.extensions?.code || "";
      const message = (gqlError?.message || err?.message || "").toLowerCase();

      // Email OTP step: OTP mailed -> show the OTP box.
      if (code === "LOGIN_OTP_REQUIRED") {
        setOtpStep(true);
        setOtpInfo(gqlError?.message || "OTP sent to your email.");
        setResendIn(Number(gqlError?.extensions?.resendIn) || 60);
        return;
      }
      if (code === "LOGIN_OTP_INVALID") {
        setInvalidCredentialError(gqlError?.message || "Incorrect OTP.");
        return;
      }

      // Message fallback: older server builds throw a plain Error with no
      // extensions.code, so match on the text too.
      const underReview =
        code === "SUBSCRIPTION_UNDER_REVIEW" || message.includes("under review");
      const rejected =
        code === "SUBSCRIPTION_REJECTED" || message.includes("was rejected");
      const needsSubscription =
        code === "SUBSCRIPTION_REQUIRED" || message.includes("subscription required");

      if (!underReview && (needsSubscription || rejected)) {
        return navigate("/subscription", {
          state: {
            email: gqlError?.extensions?.email || email,
            rejected,
          },
        });
      }

      setInvalidCredentialError(err?.message || "Login failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginLayout>
      <div className="flex flex-col md:flex-row w-full">
        {/* Left: Form */}
        <div className="flex flex-1 flex-col justify-center px-6">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-6 text-center">
            Login
          </h1>

          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <button
              type="button"
              className={`px-4 py-2 text-sm md:text-base font-medium border-b-2 ${
                loginType === "branch"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
              }`}
              onClick={() => { setLoginType("branch"); resetOtpStep(); }}
            >
              Branch Login
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm md:text-base font-medium border-b-2 ml-2 sm:ml-4 ${
                loginType === "staff"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
              }`}
              onClick={() => { setLoginType("staff"); resetOtpStep(); }}
            >
              Staff Login
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm md:text-base font-medium border-b-2 ml-2 sm:ml-4 ${
                loginType === "admin"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
              }`}
              onClick={() => { setLoginType("admin"); resetOtpStep(); }}
            >
              Admin Login
            </button>
          </div>

          <form
            onSubmit={handleLogin}
            className="w-full max-w-md mx-auto md:mx-0 space-y-6"
          >
            <FormField
              label="Email"
              type="email"
              name="email"
              placeholder="Email"
              maxLength={35}
              value={email}
              onChange={(e: any) => {
                setEmail(e.target.value);
                setEmailError("");
                if (otpStep) resetOtpStep();
              }}
              error={emailError}
            />

            <FormField
              label="Password"
              type="password"
              name="password"
              placeholder="Password"
              maxLength={16}
              value={password}
              onChange={(e: any) => {
                setPassword(e.target.value);
                setPasswordError("");
                if (otpStep) resetOtpStep();
              }}
              error={passwordError}
            />

            {/* OTP field sits right under Password with the same gap as
                Email -> Password; the sent-to note and Resend sit tight under it. */}
            {otpStep && (
              <div className="space-y-1">
                <FormField
                  label="Email OTP"
                  type="text"
                  name="otp"
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e: any) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setInvalidCredentialError("");
                  }}
                />
                <div className="flex justify-between items-start gap-3 text-xs">
                  <span className="text-green-700">{otpInfo}</span>
                  <button
                    type="button"
                    disabled={resendIn > 0 || busy}
                    className={`shrink-0 ${resendIn > 0 || busy ? "text-gray-400" : "text-blue-600 hover:underline"}`}
                    onClick={() => { setOtp(""); doLogin(undefined); }}
                  >
                    {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}

            {/* Subscription warning for admin — rendered only when there is
                something to say, so an empty row doesn't add a gap. */}
            {isExpiringSoon && email && password && invalidCredentialError === "" && (
              <div className="flex justify-end items-center">
                <span className="text-xs text-red-600 font-medium">
                  ⚠️ Your subscription may expire soon!
                </span>
              </div>
            )}

            <Button type="submit" variant="outline" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : otpStep
                  ? "Verify OTP & Login"
                  : loginType === "admin" ? "Admin Login" : loginType === "branch" ? "Branch Login" : "Staff Login"}
            </Button>

            {invalidCredentialError && (
              <p className="text-xs sm:text-sm text-red-600 text-center">
                {invalidCredentialError}
              </p>
            )}
          </form>
        </div>

        {/* Divider */}
        <div className="flex md:flex-col items-center justify-center px-4 my-6 md:my-0">
          <div className="bg-gray-300 w-full md:w-px h-px md:h-40" />
        </div>

        {/* Right: Image */}
        <div className="flex flex-col md:flex-1 md:justify-center md:items-center px-6">
          <img
            src={loginImage}
            alt="Login Visual"
            className="w-full max-w-md h-auto object-contain"
          />
        </div>
      </div>
    </LoginLayout>
  );
};

export default Login;
