import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/auth";
import LoginLayout from "../../layouts/login";
import { useState } from "react";
import loginImage from "../../assets/images/login.jpg";
import { useAppDispatch } from "../../redux/hooks";
import { saveAuthData } from "../../redux/slices/auth";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { setBranchId } from "../../redux/slices/branch";

const Login = () => {
  const dispatch = useAppDispatch();
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data, refetch } = useBranchesQuery();
  const branchList = data?.getBranches || [];


  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [invalidCredentialError, setInvalidCredentialError] = useState("");
  const [loginType, setLoginType] = useState<"branch" | "admin">("branch"); // 👈 default selected

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    let isValid = true;

    if (!email.trim()) {
      setEmailError("Email is required");
      isValid = false;
    } else {
      setEmailError("");
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      isValid = false;
    } else {
      setPasswordError("");
    }

    if (!isValid) {
      setInvalidCredentialError("");
      return;
    }

    if (loginType === "admin") {
      // Static admin login
      if (email === "admin@gmail.com" && password === "admin") {
        dispatch(saveAuthData({ type: "admin", name: "Tejas" }));
        login();
        navigate("/home");
        setInvalidCredentialError("");
      } else {
        setInvalidCredentialError("Invalid credential");
      }
    } else if (loginType === "branch") {
      // Match with branch list
      await refetch(); // Optional: Refresh data
      const matchedBranch = branchList.find(
        (branch: any) =>
          branch.email === email && branch.password === password
      );

      if (matchedBranch) {
        // ✅ Store branchid in localStorage
        localStorage.setItem('branchid', matchedBranch.id);
        dispatch(setBranchId(matchedBranch.id));
        // 1. Save branch info in Redux (you already do this)
        dispatch(saveAuthData({ type: "branch", branch: matchedBranch }));

        // 3. Proceed to navigate & login
        login();
        navigate("/home");
        setInvalidCredentialError("");
      } else {
        setInvalidCredentialError("Invalid credential");
      }
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
              className={`px-4 py-2 text-sm md:text-base font-medium border-b-2 ${loginType === "branch"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
                }`}
              onClick={() => setLoginType("branch")}
            >
              Branch Login
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm md:text-base font-medium border-b-2 ml-4 ${loginType === "admin"
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
            {/* Email */}
            <FormField
              label="Email"
              type="email"
              id="email"
              name="email"
              placeholder="Email"
              maxLength={35}
              value={email}
              onChange={(e: any) => {
                setEmailError("");
                setEmail(e.target.value);
              }}
              error={emailError}
            />

            {/* Password */}
            <FormField
              label="Password"
              type="password"
              id="password"
              name="password"
              placeholder="Password"
              maxLength={8}
              value={password}
              onChange={(e: any) => {
                setPasswordError("");
                setPassword(e.target.value);
              }}
              error={passwordError}
            />

            {/* Forgot password */}
            <div className="flex justify-end">
              <p
                className="text-xs sm:text-sm md:text-base text-blue-600 hover:underline font-medium cursor-pointer"
                onClick={() => navigate("/forgotpassword")}
              >
                Forgot Password?
              </p>
            </div>

            {/* Submit */}
            <Button variant="outline" onClick={handleLogin} className="w-full">
              {loginType === "admin" ? "Admin Login" : "Branch Login"}
            </Button>

            {/* Error Message */}
            {invalidCredentialError && (
              <p className="text-xs sm:text-xs md:text-sm text-red-600 text-center">
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
