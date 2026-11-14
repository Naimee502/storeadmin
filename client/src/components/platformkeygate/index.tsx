import { useEffect, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client";
import { CHECK_PLATFORM_KEY } from "../../graphql/queries/admin";
import { KeyRound } from "lucide-react";
import Button from "../button";
import FormField from "../formfiled";
import LoginLayout from "../../layouts/login";
import { getPlatformKey, setPlatformKey } from "../../graphql/platformkey";

// Platform-owner pages need the server's PLATFORM_KEY; it is kept for this tab only.
// The key is checked with the server first: a wrong one would silently act as the signed-in business.
const PlatformKeyGate = ({ children }: { children: ReactNode }) => {
  const client = useApolloClient();
  const [key, setKey] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(!!getPlatformKey());

  const verify = async (value: string) => {
    setPlatformKey(value);
    setChecking(true);
    try {
      await client.query({ query: CHECK_PLATFORM_KEY, fetchPolicy: "network-only" });
      setKey(value);
      setError("");
    } catch {
      setPlatformKey("");
      setError("This platform key is not correct.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const saved = getPlatformKey();
    if (saved) void verify(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (key) return <>{children}</>;
  return (
    <LoginLayout>
      <form
        className="max-w-sm mx-auto p-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || checking) return;
          void verify(draft.trim());
        }}
      >
        <h1 className="text-[15px] font-semibold text-slate-800">Platform Owner Access</h1>
        <FormField label="Platform Key" name="platformkey" type="password" value={draft} noAutofill
          onChange={(e: any) => setDraft(e.target.value)} placeholder="Enter platform key" error={error} />
        <Button type="submit" icon={<KeyRound size={14} />} disabled={checking}>{checking ? "Checking..." : "Continue"}</Button>
      </form>
    </LoginLayout>
  );
};

export default PlatformKeyGate;
