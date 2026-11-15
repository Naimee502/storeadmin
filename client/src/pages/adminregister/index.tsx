import { useState } from "react";
import { useNavigate } from "react-router";
import LoginLayout from "../../layouts/login";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import registerImage from "../../assets/images/login.jpg";
import { useCreateAdminMutation } from "../../graphql/hooks/admin";
import { ADMIN_REGISTER_MODULES, isOptIn } from "../../config/modules";
import { BUSINESS_TYPE_OPTIONS, kindOptions, profileForType, profileModules, starterMasters, withKind } from "../../config/profiles";

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
  const [businesskind, setBusinesskind] = useState("");
  const [addStarter, setAddStarter] = useState(true);

  // Type + kind decide the starting modules, form fields and starter masters (Other starts with the core ones).
  const allModules = ADMIN_REGISTER_MODULES.map((m) => m.id).filter((id) => !isOptIn(id));
  const preset = withKind(profileForType(businesstype), businesskind);
  const starter = starterMasters(preset);

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
            ...(businesskind ? { businesskind } : {}),
            allowedmodules: preset ? profileModules(preset) : allModules,
            ...(preset?.fields ? { formfields: preset.fields } : {}),
            ...(addStarter && (starter.units.length || starter.categories.length) ? { starter } : {}),
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
                <FormField label="Business Type" name="businesstype" type="select" value={businesstype} searchable
                  options={BUSINESS_TYPE_OPTIONS}
                  onChange={(e: any) => { setBusinesstype(e.target.value || "retail"); setBusinesskind(""); }} />
              </div>
            </div>

            {kindOptions(businesstype).length > 0 && (
              <FormField label="Business Kind" name="businesskind" type="select" value={businesskind} searchable
                options={kindOptions(businesstype)} placeholder="Pick what the business sells or does"
                onChange={(e: any) => setBusinesskind(e.target.value || "")} />
            )}
            {preset && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] text-slate-600 space-y-1">
                <div>{preset.note}</div>
                {(starter.units.length > 0 || starter.categories.length > 0) && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 h-3.5 w-3.5" checked={addStarter} onChange={(e) => setAddStarter(e.target.checked)} />
                    <span>Add starter masters: {[starter.units.length && `units ${starter.units.map((u) => u.name).join(", ")}`,
                      starter.categories.length && `categories ${starter.categories.join(", ")}`].filter(Boolean).join("; ")}</span>
                  </label>
                )}
              </div>
            )}

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
