import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons (Leaflet expects assets via webpack URLs)
const icon = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 9999px;
    background: oklch(0.68 0.19 45); border: 4px solid white;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:14px;">🏖️</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export type Beach = {
  name: string;
  lat: number;
  lng: number;
  description: string;
};

export function LeafletMap({ beaches }: { beaches: Beach[] }) {
  return (
    <MapContainer
      center={[38.345, -0.48]}
      zoom={12}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {beaches.map((b) => (
        <Marker key={b.name} position={[b.lat, b.lng]} icon={icon}>
          <Popup>
            <div style={{ minWidth: 180 }}>
              <strong style={{ color: "oklch(0.62 0.17 45)", fontSize: 14 }}>{b.name}</strong>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>{b.description}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
