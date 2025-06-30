import { useState } from "react";
import { usePendingSubscriptionsQuery, useApproveSubscriptionMutation, useRejectSubscriptionMutation } from "../../graphql/hooks/admin";
import Button from "../../components/button";
import LoginLayout from "../../layouts/login";

const SubscriptionReview = () => {
  const { data, loading, error, refetch } = usePendingSubscriptionsQuery();
  const [approveSubscription] = useApproveSubscriptionMutation();
  const [rejectSubscription] = useRejectSubscriptionMutation();

  const pending = data?.getPendingSubscriptions || [];

  const [selectedEmail, setSelectedEmail] = useState("");
  const selectedAdmin = pending.find((a: any) => a.email === selectedEmail);

  const handleAction = async (type: "approve" | "reject") => {
    if (!selectedEmail) return alert("Please select a pending admin.");
    try {
      if (type === "approve") {
        await approveSubscription({ variables: { email: selectedEmail } });
      } else {
        await rejectSubscription({ variables: { email: selectedEmail } });
      }
      setSelectedEmail(""); // reset selection
      await refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <LoginLayout>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Review Pending Subscriptions</h1>

        {loading ? (
          <p className="text-center text-gray-500">Loading...</p>
        ) : error ? (
          <p className="text-center text-red-600">Error: {error.message}</p>
        ) : pending.length === 0 ? (
          <p className="text-center text-gray-600">No pending subscriptions</p>
        ) : (
          <>
            {/* Dropdown */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Select Pending Admin</label>
              <select
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
                className="w-full border rounded px-4 py-2"
              >
                <option value="">-- Select --</option>
                {pending.map((admin: any) => (
                  <option key={admin.id} value={admin.email}>
                    {admin.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Details */}
            {selectedAdmin && (
              <div className="border p-4 rounded shadow-sm bg-white mb-4">
                <p><strong>Email:</strong> {selectedAdmin.email}</p>
                <p><strong>Transaction ID:</strong> {selectedAdmin.transactionId}</p>
                <p><strong>Subscription Type:</strong> {selectedAdmin.subscriptionType}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-4 justify-center">
              <Button
                variant="outline"
                disabled={!selectedEmail}
                onClick={() => handleAction("approve")}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                disabled={!selectedEmail}
                onClick={() => handleAction("reject")}
              >
                Reject
              </Button>
            </div>
          </>
        )}
      </div>
    </LoginLayout>
  );
};

export default SubscriptionReview;
