import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
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

// Coloured pin as an inline divIcon — avoids the broken default-marker-image
// problem in bundlers (no image assets needed).
const dot = (color: string, ring = false) =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};
      border:2px solid #fff;box-shadow:0 0 0 ${ring ? "3px" : "1px"} ${color}55;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

// Pulsing "you are here" marker for the current / latest known position.
const currentIcon = () =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:24px;height:24px;">
      <div class="lt-pulse-ring"></div>
      <div style="position:absolute;inset:5px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 5px rgba(0,0,0,.45);"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const START_ICON = dot("#16a34a", true); // green — punch-in (trail start)

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
              <Popup>
                <b>Punch-in / start</b>
                <br />
                {fmtTime(trail[0]?.pingedAt)}
              </Popup>
            </Marker>
            <Marker position={trailCoords[trailCoords.length - 1]} icon={currentIcon()}>
              <Popup>
                <b>Current location (here now)</b>
                <br />
                {fmtTime(trail[trail.length - 1]?.pingedAt)}
              </Popup>
            </Marker>
          </>
        )}

        {/* Latest location per salesman (only when not showing a single trail) */}
        {!trailCoords.length &&
          latest.filter(valid).map((p, i) => (
            <Marker key={p.staffid?.id ?? i} position={[p.latitude, p.longitude]} icon={currentIcon()}>
              <Popup>
                <b>{p.staffid?.name || "Salesman"}</b> — here now
                <br />
                Last seen: {fmtTime(p.pingedAt)}
                <br />
                {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                {p.accuracy != null ? ` · ±${Math.round(p.accuracy)}m` : ""}
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
