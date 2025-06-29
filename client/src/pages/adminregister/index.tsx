import { useState } from "react";
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

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitError, setSubmitError] = useState("");

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

            <div className="mb-10">
              <label className="block text-sm font-medium mb-1">Subscription Type</label>
              <select
                className="w-full border rounded p-2"
                value={subscription}
                onChange={(e) => setSubscription(e.target.value)}
              >
                <option value="monthly">Monthly (₹1499)</option>
                <option value="yearly">Yearly (₹999)</option>
              </select>
            </div>

            <Button type="submit" variant="outline" className="w-full">
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
