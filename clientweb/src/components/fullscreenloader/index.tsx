import { Loader2 } from "lucide-react";

export default function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}
