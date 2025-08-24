import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import LoginLayout from "../../layouts/login";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import registerImage from "../../assets/images/login.jpg";
import { useCreateAdminMutation } from "../../graphql/hooks/admin";

const AdminRegister = () => {
  const navigate = useNavigate();
  const [createAdmin] = useCreateAdminMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [subscription, setSubscription] = useState("monthly");
  const [businesstype, setBusinesstype] = useState("retail");
  const [isMultibranch, setIsMultibranch] = useState(false);
  const [isChannelCustomers, setIsChannelCustomers] = useState(false); // ✅ NEW
  const [allowedmodules, setAllowedmodules] = useState<string[]>([
    "sales",
    "purchase",
    "accounting",
  ]);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
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
            subscriptionType: subscription,
            businesstype,
            isMultibranch,
            isChannelCustomers, // ✅ NEW
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
      <div className="flex flex-col md:flex-row w-full">
        {/* Left: Form */}
        <div className="flex flex-1 flex-col justify-center px-6">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-6 text-center">
            Admin Register
          </h1>

          <form onSubmit={handleRegister} className="w-full max-w-md mx-auto space-y-6">
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

            <div>
              <label className="block text-sm font-medium text-gray-700">Business Type</label>
              <select
                className="w-full mt-1 border px-3 py-2 rounded"
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

            <div className="flex items-center space-x-2">
              <input
                id="isMultibranch"
                type="checkbox"
                checked={isMultibranch}
                onChange={(e) => setIsMultibranch(e.target.checked)}
              />
              <label htmlFor="isMultibranch" className="text-sm text-gray-700">
                Enable Multi-Branch
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="isChannelCustomers"
                type="checkbox"
                checked={isChannelCustomers}
                onChange={(e) => setIsChannelCustomers(e.target.checked)}
              />
              <label htmlFor="isChannelCustomers" className="text-sm text-gray-700">
                Is Channel Customers
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Modules</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "sales",
                  "purchase",
                  "inventory",
                  "accounting",
                  "pos",
                  "manufacturing",
                  "service",
                  "reports",
                ].map((module) => (
                  <label key={module} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowedmodules.includes(module)}
                      onChange={() => handleModuleToggle(module)}
                    />
                    <span>{module}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" variant="outline" className="w-full mt-10">
              Register Admin
            </Button>

            {submitError && (
              <p className="text-sm text-red-600 text-center">{submitError}</p>
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
