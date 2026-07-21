import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface TrackPoint {
  latitude: number;
  longitude: number;
  pingedAt?: string | number | null;
  accuracy?: number | null;
  staffid?: { id?: string; name?: string } | null;
}

interface Props {
  /** Latest known location per salesman — rendered as pins. */
  latest: TrackPoint[];
  /** Ordered trail (punch-in → punch-out) for a selected salesman. */
  trail?: TrackPoint[];
  height?: number;
}

// GraphQL serialises Mongo Date fields as epoch-ms strings ("1751713200000"),
// which `new Date(str)` can't parse — route numeric values through Number().
const fmtTime = (v: TrackPoint["pingedAt"]): string => {
  if (v == null) return "—";
  const s = String(v).trim();
  const d = /^\d+$/.test(s) ? new Date(Number(s)) : new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN");
};

// Inject the pulse keyframes once (for the "current location" marker).
const PULSE_CSS_ID = "lt-pulse-css";
function ensurePulseCss() {
  if (typeof document === "undefined" || document.getElementById(PULSE_CSS_ID)) return;
  const s = document.createElement("style");
  s.id = PULSE_CSS_ID;
  s.textContent = `
    @keyframes ltPulse { 0%{transform:scale(.5);opacity:.85} 70%{transform:scale(2.4);opacity:0} 100%{opacity:0} }
    .lt-pulse-ring{position:absolute;inset:0;border-radius:50%;background:#2563eb;animation:ltPulse 1.8s ease-out infinite}
  `;
  document.head.appendChild(s);
}

// Map-pin (teardrop, pointed at the exact spot — the "arrow") with a white
// person silhouette in the head, as an inline divIcon (no image assets
// needed). The tip of the teardrop (bottom point) IS the exact GPS
// coordinate — `iconAnchor` below matches that tip, not the head. `pulse`
// adds a small animated dot exactly at that tip (not up in the head) so the
// "live" highlight never drifts away from the point the pin is pointing at.
const personPinIcon = (color: string, pulse = false) =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:34px;height:42px;">
      <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 25 17 25s17-13 17-25C34 7.6 26.4 0 17 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
      </svg>
      <div style="position:absolute;top:4px;left:0;width:34px;height:24px;display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/>
        </svg>
      </div>
      ${pulse ? `<div style="position:absolute;top:40px;left:17px;width:10px;height:10px;transform:translate(-50%,-50%);">
        <div style="position:relative;width:100%;height:100%;">
          <div class="lt-pulse-ring" style="background:${color};"></div>
          <div style="position:absolute;inset:1.5px;border-radius:50%;background:${color};border:1.5px solid #fff;"></div>
        </div>
      </div>` : ""}
    </div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    tooltipAnchor: [0, -38],
  });

const START_ICON = personPinIcon("#16a34a"); // green — punch-in (trail start)

// Reverse-geocoded place names for pin tooltips, cached per rounded lat/long
// across the whole session so the same spot isn't looked up twice.
const geocodeCache: Record<string, string> = {};
const coordKey = (p: TrackPoint) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;

function useLocationNames(points: TrackPoint[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const keys: string[] = Array.from(
      new Set<string>(points.map(coordKey))
    ).filter((k: string) => !(k in geocodeCache));

    if (keys.length === 0) return;
    let cancelled = false;

    const resolveNext = (i: number) => {
      if (cancelled || i >= keys.length) return;
      const key = keys[i];
      const [lat, lon] = key.split(",");
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=0`,
        { headers: { Accept: "application/json" } }
      )
        .then((res) => res.json())
        .then((json) => {
          geocodeCache[key] = json?.display_name || `${lat}, ${lon}`;
        })
        .catch(() => {
          geocodeCache[key] = `${lat}, ${lon}`;
        })
        .finally(() => {
          if (!cancelled) {
            setNames((prev) => ({ ...prev, [key]: geocodeCache[key] }));
            // Throttle to ~1 request/sec per Nominatim's usage policy.
            setTimeout(() => resolveNext(i + 1), 1100);
          }
        });
    };
    resolveNext(0);

    return () => { cancelled = true; };
  }, [points]);
  return names;
}

const locationNameOf = (p: TrackPoint, names: Record<string, string>) => {
  const key = coordKey(p);
  return geocodeCache[key] || names[key] || "Resolving…";
};

// Recentre the map to fit whatever points are currently shown.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export default function LiveTrackingMap({ latest, trail = [], height = 420 }: Props) {
  ensurePulseCss();
  const valid = (p: TrackPoint) =>
    typeof p.latitude === "number" && typeof p.longitude === "number";

  const trailCoords = useMemo(
    () => trail.filter(valid).map((p) => [p.latitude, p.longitude] as [number, number]),
    [trail]
  );
  const latestCoords = useMemo(
    () => latest.filter(valid).map((p) => [p.latitude, p.longitude] as [number, number]),
    [latest]
  );

  const allPoints = trailCoords.length ? trailCoords : latestCoords;
  const center: [number, number] = allPoints[0] ?? [22.9734, 78.6569]; // India fallback

  const validLatest = useMemo(() => latest.filter(valid), [latest]);
  const locationNames = useLocationNames(validLatest);

  return (
    <div style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
      <MapContainer center={center} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={allPoints} />

        {/* Route trail: punch-in → punch-out */}
        {trailCoords.length > 1 && (
          <Polyline positions={trailCoords} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.75 }} />
        )}

        {/* Trail start (punch-in) + end (latest) markers */}
        {trailCoords.length > 0 && (
          <>
            <Marker position={trailCoords[0]} icon={START_ICON}>
              <Tooltip permanent direction="top" offset={[0, -2]}>
                <b>Punch-in / start</b>
                <br />
                {fmtTime(trail[0]?.pingedAt)}
              </Tooltip>
            </Marker>
            <Marker position={trailCoords[trailCoords.length - 1]} icon={personPinIcon("#2563eb", true)}>
              <Tooltip permanent direction="top" offset={[0, -2]}>
                <b>Current location (here now)</b>
                <br />
                {fmtTime(trail[trail.length - 1]?.pingedAt)}
              </Tooltip>
            </Marker>
          </>
        )}

        {/* Latest location per salesman (only when not showing a single trail) */}
        {!trailCoords.length &&
          validLatest.map((p, i) => (
            <Marker key={p.staffid?.id ?? i} position={[p.latitude, p.longitude]} icon={personPinIcon("#2563eb", true)}>
              <Tooltip permanent direction="top" offset={[0, -2]}>
                <b>{p.staffid?.name || "Salesman"}</b> — here now
                <br />
                Last seen: {fmtTime(p.pingedAt)}
                <br />
                {locationNameOf(p, locationNames)}
                {p.accuracy != null ? ` · ±${Math.round(p.accuracy)}m` : ""}
              </Tooltip>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
