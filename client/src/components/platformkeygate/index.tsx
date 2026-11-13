import { useState, type ReactNode } from "react";
import { KeyRound } from "lucide-react";
import Button from "../button";
import FormField from "../formfiled";
import LoginLayout from "../../layouts/login";
import { getPlatformKey, setPlatformKey } from "../../graphql/platformkey";

// Platform-owner pages need the server's PLATFORM_KEY; it is kept for this tab only.
const PlatformKeyGate = ({ children }: { children: ReactNode }) => {
  const [key, setKey] = useState(getPlatformKey());
  const [draft, setDraft] = useState("");

  if (key) return <>{children}</>;
  return (
    <LoginLayout>
      <form
        className="max-w-sm mx-auto p-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          setPlatformKey(draft.trim());
          setKey(draft.trim());
        }}
      >
        <h1 className="text-[15px] font-semibold text-slate-800">Platform Owner Access</h1>
        <FormField label="Platform Key" name="platformkey" type="password" value={draft} noAutofill
          onChange={(e: any) => setDraft(e.target.value)} placeholder="Enter platform key" />
        <Button type="submit" icon={<KeyRound size={14} />}>Continue</Button>
      </form>
    </LoginLayout>
  );
};

export default PlatformKeyGate;
