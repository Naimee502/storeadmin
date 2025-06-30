import { useState } from "react";
import { useNavigate } from "react-router";
import LoginLayout from "../../layouts/login";
import Button from "../../components/button";
import FormField from "../../components/formfiled";
import qrImage from "../../assets/images/qr.jpeg";
import { useConfirmSubscriptionMutation } from "../../graphql/hooks/admin";

const Subscription = () => {
  const navigate = useNavigate();
  const [confirmSubscription] = useConfirmSubscriptionMutation();

  const [email, setEmail] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [subscriptionType, setSubscriptionType] = useState("monthly");

  const [emailError, setEmailError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    let isValid = true;
    setEmailError("");
    setTransactionError("");
    setSubmitError("");

    if (!email.trim()) {
      setEmailError("Email is required");
      isValid = false;
    }

    if (!transactionId.trim()) {
      setTransactionError("Transaction ID is required");
      isValid = false;
    }

    if (!isValid) return;

    try {
      await confirmSubscription({
        variables: {
          email,
          transactionId,
          subscriptionType,
        },
      });

      alert("Subscription request submitted! We'll review and approve it shortly.");
      navigate("/login");
    } catch (err: any) {
      setSubmitError(err.message || "Subscription failed. Try again.");
    }
  };

  return (
    <LoginLayout>
      <div className="flex flex-col md:flex-row w-full">
        {/* Left: Form */}
        <div className="flex flex-1 flex-col justify-center px-6">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-6 text-center">
            Confirm Subscription
          </h1>

          <form onSubmit={handleSubscribe} className="w-full max-w-md mx-auto space-y-6">
            <FormField
              label="Admin Email"
              type="email"
              name="email"
              placeholder="Enter your admin email"
              value={email}
              onChange={(e: any) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              error={emailError}
            />

            <FormField
              label="Transaction ID"
              type="text"
              name="transactionId"
              placeholder="Enter UPI transaction ID"
              value={transactionId}
              onChange={(e: any) => {
                setTransactionId(e.target.value);
                setTransactionError("");
              }}
              error={transactionError}
            />

            <div className="mb-10">
              <label className="block text-sm font-medium mb-1">Subscription Type</label>
              <select
                className="w-full border rounded p-2"
                value={subscriptionType}
                onChange={(e) => setSubscriptionType(e.target.value)}
              >
                <option value="monthly">Monthly (₹1499)</option>
                <option value="yearly">Yearly (₹999)</option>
              </select>
            </div>

            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={!email.trim() || !transactionId.trim()}
            >
              Confirm & Activate
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

        {/* Right: QR Image */}
        <div className="flex flex-col md:flex-1 md:justify-center md:items-center px-6">
          <img
            src={qrImage}
            alt="UPI QR Code"
            className="w-full max-w-md h-auto object-contain"
          />
          <p className="text-center text-gray-600 text-sm mt-2">
            Scan & Pay using any UPI app
          </p>
        </div>
      </div>
    </LoginLayout>
  );
};

export default Subscription;
