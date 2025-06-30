import { useState } from "react";
import { useNavigate } from "react-router";
import LoginLayout from "../../layouts/login";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import loginImage from "../../assets/images/login.jpg";
import { useAppDispatch } from "../../redux/hooks";
import { saveAuthData } from "../../redux/slices/auth";
import { setBranchId } from "../../redux/slices/branch";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { useLoginAdminMutation } from "../../graphql/hooks/admin";
import { useAuth } from "../../contexts/auth";

const Login = () => {
  const dispatch = useAppDispatch();
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data, refetch } = useBranchesQuery();
  const branchList = data?.getBranches || [];
  const [loginAdmin] = useLoginAdminMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState<"branch" | "admin">("branch");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [invalidCredentialError, setInvalidCredentialError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

    try {
      if (loginType === "admin") {
        const res = await loginAdmin({ variables: { email, password } });
        const admin = res.data?.loginAdmin;

        console.log("Admin login response:", JSON.stringify(res.data, null, 2));

        if (!admin) throw new Error("Invalid credentials");

        if (!admin.subscribed) {
          if (admin.needsReview) {
            throw new Error("Your subscription is under review.");
          } else if (admin.rejected) {
            throw new Error("Your subscription was rejected. Please resubmit.");
          } else {
            return navigate("/subscription");
          }
        }

        dispatch(
          saveAuthData({
            type: "admin",
            admin: {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              subscriptionType: admin.subscriptionType,
              subscribed: admin.subscribed,
              subscribedAt: admin.subscribedAt,
              subscriptionEnd: admin.subscriptionEnd,
              transactionId: admin.transactionId,
            },
          })
        );
        login();
        navigate("/home");
      } else {
        await refetch(); // Refresh latest branches
        const matchedBranch = branchList.find(
          (b: any) => b.email === email && b.password === password
        );

        if (!matchedBranch) throw new Error("Invalid credentials");

        const admin = matchedBranch.admin;
        if (!admin || !admin.subscribed) {
          if (admin.needsReview) {
            throw new Error("Admin subscription is under review.");
          } else if (admin.rejected) {
            throw new Error("Admin subscription was rejected. Please resubmit.");
          } else {
            return navigate("/subscription");
          }
        }

        localStorage.setItem("branchid", matchedBranch.id);
        dispatch(setBranchId(matchedBranch.id));
        dispatch(saveAuthData({ type: "branch", branch: matchedBranch }));
        login();
        navigate("/home");
      }
    } catch (err: any) {
      setInvalidCredentialError(err?.message || "Login failed. Try again.");
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
              onClick={() => setLoginType("branch")}
            >
              Branch Login
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm md:text-base font-medium border-b-2 ml-4 ${
                loginType === "admin"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
              }`}
              onClick={() => setLoginType("admin")}
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
              id="email"
              name="email"
              placeholder="Email"
              maxLength={35}
              value={email}
              onChange={(e: any) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              error={emailError}
            />

            <FormField
              label="Password"
              type="password"
              id="password"
              name="password"
              placeholder="Password"
              maxLength={16}
              value={password}
              onChange={(e: any) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
              error={passwordError}
            />

            {/* Subscribe Link */}
            <div className="flex justify-end">
              <p
                className="text-xs sm:text-sm md:text-base text-blue-600 hover:underline font-medium cursor-pointer"
                onClick={() => navigate("/subscription")}
              >
                {loginType === "admin"
                  ? "Don't have an active subscription?"
                  : "Admin subscription required"}
              </p>
            </div>

            <Button type="submit" variant="outline" className="w-full">
              {loginType === "admin" ? "Admin Login" : "Branch Login"}
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
