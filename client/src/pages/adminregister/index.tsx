import { useState } from "react";
import { useNavigate } from "react-router";
import LoginLayout from "../../layouts/login";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import registerImage from "../../assets/images/login.jpg";
import { useCreateAdminMutation } from "../../graphql/hooks/admin";
import { ADMIN_REGISTER_MODULES } from "../../config/modules";

const AdminRegister = () => {
  const navigate = useNavigate();
  const [createAdmin] = useCreateAdminMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [noOfBranches, setNoOfBranches] = useState<number>(1);
  const [subscription, setSubscription] = useState("monthly");
  const [businesstype, setBusinesstype] = useState("retail");

  // All modules are enabled on registration; managed later in Business Settings.
  const allModules = ADMIN_REGISTER_MODULES.map((m) => m.id);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [companyNameError, setCompanyNameError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    let isValid = true;
    setSubmitError("");

    if (!companyName.trim()) {
      setCompanyNameError("Company name is required");
      isValid = false;
    } else {
      setCompanyNameError("");
    }

    if (!mobile.trim()) {
      setMobileError("Mobile number is required");
      isValid = false;
    } else {
      setMobileError("");
    }

    if (!name.trim()) {
      setNameError("Name is required");
      isValid = false;
    } else {
      setNameError("");
    }

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

    if (!isValid) return;

    try {
      await createAdmin({
        variables: {
          input: {
            name,
            email,
            password,
            companyName,
            mobile,
            address,
            ...(gstin ? { gstin } : {}),
            noOfBranches: Number(noOfBranches),
            subscriptionType: subscription,
            businesstype,
            // All modules enabled by default — restricted later via Business Settings
            allowedmodules: allModules,
          },
        },
      });

      navigate("/login");
    } catch (err: any) {
      const errorMessage = err?.message || "Registration failed. Try again.";
      setSubmitError(errorMessage);
    }
  };

  return (
    <LoginLayout>
      <div className="flex w-full max-w-4xl flex-col md:w-[52rem] md:flex-row">
        {/* Left: Form */}
        <div className="flex flex-1 flex-col justify-center md:pr-6">
          <h1 className="mb-4 text-center text-2xl font-bold tracking-tight text-slate-900">
            Admin Register
          </h1>

          <form onSubmit={handleRegister} className="w-full space-y-3">

            {/* Row 1: Company Name & Name */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <FormField
                  label="Company Name"
                  type="text"
                  name="companyName"
                  placeholder="Company Name"
                  value={companyName}
                  onChange={(e: any) => {
                    setCompanyNameError("");
                    setCompanyName(e.target.value);
                  }}
                  error={companyNameError}
                />
              </div>
              <div className="flex-1">
                <FormField
                  label="Name"
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e: any) => {
                    setNameError("");
                    setName(e.target.value);
                  }}
                  error={nameError}
                />
              </div>
            </div>

            {/* Row 2: Mobile Number & Email */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <FormField
                  label="Mobile Number"
                  type="text"
                  name="mobile"
                  placeholder="Mobile Number"
                  value={mobile}
                  onChange={(e: any) => {
                    setMobileError("");
                    setMobile(e.target.value);
                  }}
                  error={mobileError}
                />
              </div>
              <div className="flex-1">
                <FormField
                  label="Email"
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e: any) => {
                    setEmailError("");
                    setEmail(e.target.value);
                  }}
                  error={emailError}
                />
              </div>
            </div>

            {/* GSTIN (optional) — for e-Invoice / e-Way Bill; the full GST profile is in Business Settings */}
            <FormField
              label="GSTIN (optional)"
              type="text"
              name="gstin"
              placeholder="e.g. 24ABCDE1234F1Z5"
              value={gstin}
              onChange={(e: any) => setGstin(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 15))}
            />

            {/* Row 3: Address — used on Sales Invoice print header */}
            <FormField
              label="Address"
              type="text"
              name="address"
              placeholder="Company Address"
              value={address}
              onChange={(e: any) => setAddress(e.target.value)}
              multiline
            />

            {/* Row 4: Password */}
            <FormField
              label="Password"
              type="password"
              name="password"
              placeholder="Password"
              value={password}
              onChange={(e: any) => {
                setPasswordError("");
                setPassword(e.target.value);
              }}
              error={passwordError}
            />

            {/* Split row for Branches and Business Type */}
            <div className="flex flex-row gap-3">
              <div className="flex-1">
                <FormField
                  label="No. of Branches"
                  type="number"
                  name="noOfBranches"
                  placeholder="1"
                  value={noOfBranches}
                  onChange={(e: any) => setNoOfBranches(e.target.value)}
                  error={""}
                />
              </div>

              <div className="flex-1">
                <label className="mb-1 block text-[12px] font-medium text-slate-600">Business Type</label>
                <select
                  className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={businesstype}
                  onChange={(e) => setBusinesstype(e.target.value)}
                >
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="service">Service</option>
                  <option value="trader">Trader</option>
                  <option value="exporter">Exporter</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full h-9 font-semibold !mt-5">
              Register Admin
            </Button>

            {submitError && (
              <p className="text-[12px] text-red-600 text-center">{submitError}</p>
            )}
          </form>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px self-stretch bg-slate-200" />

        {/* Right: Image */}
        <div className="hidden md:flex md:flex-1 md:items-center md:justify-center md:pl-6">
          <img
            src={registerImage}
            alt="Register Visual"
            className="h-72 w-full max-w-xs object-contain"
          />
        </div>
      </div>
    </LoginLayout>
  );
};

export default AdminRegister;
