import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A plain pin drawn in CSS — avoids Leaflet's default marker images, which
// need extra bundler setup to load.
const pin = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#dc2626;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

/** Keep the map centred on the pin when the location changes. */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
  return null;
}

/** Leaflet measures its box once; tell it when the box changes size. */
function InvalidateOnResize({ box }: { box: HTMLDivElement | null }) {
  const map = useMap();
  useEffect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(box);
    return () => ro.disconnect();
  }, [box, map]);
  return null;
}

/**
 * Small read-only map of a saved shop location.
 *
 * Built to FILL the space it is given, never to make room for itself: the map
 * is absolutely positioned inside a flex-1 box, so it takes whatever height is
 * left in the card and adds none. If that leftover space is too small to be
 * useful it simply does not draw.
 */
export default function LocationPreviewMap({ latitude, longitude }: { latitude: any; longitude: any }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setBox(el);
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const valid =
    latitude !== "" && latitude != null && longitude !== "" && longitude != null &&
    isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0);

  return (
    <div ref={boxRef} className="relative flex-1 min-h-0">
      {height >= 100 && (
        valid ? (
          <div className="absolute inset-0 overflow-hidden rounded-lg border border-gray-200">
            <MapContainer
              center={[lat, lng]}
              zoom={16}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[lat, lng]} icon={pin} />
              <Recenter lat={lat} lng={lng} />
              <InvalidateOnResize box={box} />
            </MapContainer>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400">
            No shop location saved yet
          </div>
        )
      )}
    </div>
  );
}
