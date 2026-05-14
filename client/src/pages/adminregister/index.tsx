import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import LoginLayout from "../../layouts/login";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import registerImage from "../../assets/images/login.jpg";
import { useCreateAdminMutation } from "../../graphql/hooks/admin";
import { ADMIN_REGISTER_MODULES, SECTION_LABELS, findModule } from "../../config/modules";

const AdminRegister = () => {
  const navigate = useNavigate();
  const [createAdmin] = useCreateAdminMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [noOfBranches, setNoOfBranches] = useState<number>(1);
  const [subscription, setSubscription] = useState("monthly");
  const [businesstype, setBusinesstype] = useState("retail");

  // Module list comes from the shared catalog (`config/modules.ts`) so
  // adding a new module anywhere in the app automatically wires it into
  // this checklist. Only modules flagged `inAdminRegister: true` show up.
  // System modules like Settings/Permissions are always available — they
  // aren't checkboxes here.
  const allModules = ADMIN_REGISTER_MODULES.map((m) => m.id);

  const [allowedmodules, setAllowedmodules] = useState<string[]>(allModules);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [companyNameError, setCompanyNameError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleModuleToggle = (module: string) => {
    setAllowedmodules((prev) =>
      prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module]
    );
  };

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
            noOfBranches: Number(noOfBranches),
            subscriptionType: subscription,
            businesstype,
            allowedmodules,
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
      <div className="flex flex-col lg:flex-row w-full max-w-6xl mx-auto">
        {/* Left: Form */}
        <div className="flex flex-col lg:w-1/2 justify-center px-4 sm:px-8 py-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-center text-gray-800">
            Admin Register
          </h1>

          <form onSubmit={handleRegister} className="w-full max-w-md mx-auto space-y-4">

            {/* Row 1: Company Name & Name */}
            <div className="flex flex-col sm:flex-row gap-4">
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
            <div className="flex flex-col sm:flex-row gap-4">
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

            {/* Row 3: Password */}
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
            <div className="flex flex-row space-x-4">
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
                <label className="block text-sm font-medium text-gray-700">Business Type</label>
                <select
                  className="w-full mt-1 border px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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

            {/* Allowed Modules — grouped by business section so an admin
                taking the system for "orders only" can quickly tick the
                whole Sales pipeline and skip the rest. */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Allowed Modules</label>
                <div className="flex gap-3 text-[11px]">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setAllowedmodules(allModules)}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setAllowedmodules([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="border p-3 rounded bg-gray-50 max-h-72 overflow-y-auto shadow-inner space-y-3">
                {Object.entries(
                  ADMIN_REGISTER_MODULES.reduce<Record<string, typeof ADMIN_REGISTER_MODULES>>(
                    (acc, m) => {
                      (acc[m.section] ||= [] as any).push(m);
                      return acc;
                    },
                    {}
                  )
                ).map(([section, items]) => (
                  <div key={section}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {items.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center space-x-2 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={allowedmodules.includes(m.id)}
                            onChange={() => handleModuleToggle(m.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span
                            className="truncate select-none"
                            title={`${m.label} (${m.id})`}
                          >
                            {findModule(m.id)?.label || m.id}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" variant="outline" className="w-full mt-6 bg-black text-black hover:bg-gray-800 p-3">
              Register Admin
            </Button>

            {submitError && (
              <p className="text-sm text-red-600 text-center">{submitError}</p>
            )}
          </form>
        </div>

        {/* Divider */}
        <div className="hidden lg:flex flex-col items-center justify-center py-8">
          <div className="bg-gray-200 w-px h-full min-h-[300px]" />
        </div>

        {/* Right: Image */}
        <div className="hidden lg:flex flex-col lg:w-1/2 justify-center items-center px-6">
          <img
            src={registerImage}
            alt="Register Visual"
            className="w-full max-w-md h-auto object-contain"
          />
        </div>
      </div>
    </LoginLayout>
  );
};

export default AdminRegister;
