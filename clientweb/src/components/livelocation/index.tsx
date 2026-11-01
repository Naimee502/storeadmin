import { useCallback, useEffect, useState } from "react";
import { useLazyQuery } from "@apollo/client";
import { Crosshair, RefreshCw } from "lucide-react";
import { REVERSE_GEOCODE } from "../../graphql/queries/accounts";

type Fix = { lat: number; lng: number; acc?: number };
type Status = "fetching" | "live" | "off";

/**
 * Browser's LIVE location (navigator.geolocation → address), shown on the
 * Profile under the saved address when Business Settings → "Live location on
 * Party Profile" is on. Fetched on open; Refresh takes a new fix; the
 * coordinates open Google Maps.
 */
export default function LiveLocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("fetching");
  const [error, setError] = useState<string | null>(null);
  const [reverseGeocode] = useLazyQuery(REVERSE_GEOCODE, { fetchPolicy: "network-only" });

  const load = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("off");
      setError("Location is not supported by this browser.");
      return;
    }
    setStatus("fetching");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const f: Fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        setFix(f);
        setStatus("live");
        try {
          const res: any = await reverseGeocode({ variables: { latitude: f.lat, longitude: f.lng } });
          const g = res?.data?.reverseGeocode;
          const label = g ? [g.address, g.city, g.state, g.pincode].filter(Boolean).join(", ") : "";
          setPlace(label || null);
        } catch {
          setPlace(null);
        }
      },
      (err) => {
        setStatus("off");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location for this site and refresh."
            : "Could not get your location. Please try again."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  useEffect(() => {
    load();
  }, [load]);

  const coords = fix ? `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}` : "";

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Location</p>
        <button
          type="button"
          onClick={load}
          disabled={status === "fetching"}
          className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${status === "fetching" ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <div className="flex items-start gap-1.5 text-sm text-slate-600">
        <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0">
          {status === "fetching" && !fix && <p>Fetching your location…</p>}
          {status === "off" && <p className="text-slate-500">{error}</p>}
          {fix && status !== "off" && (
            <>
              {place && <p>{place}</p>}
              <a
                href={`https://www.google.com/maps?q=${fix.lat},${fix.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className={place ? "text-xs text-slate-400 hover:text-brand-700" : "hover:text-brand-700"}
              >
                {coords}
                {fix.acc ? ` · ±${Math.round(fix.acc)} m` : ""}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
