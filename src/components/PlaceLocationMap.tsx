import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10b981;color:white;width:30px;height:30px;border-radius:9999px 9999px 9999px 2px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 10px rgba(0,0,0,.4);border:2px solid white"><span style="transform:rotate(45deg)">📍</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

export default function PlaceLocationMap({
  lat,
  lng,
  name,
  address,
}: {
  lat: number;
  lng: number;
  name: string;
  address?: string | null;
}) {
  return (
    <div className="h-56 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={pinIcon}>
          <Popup>
            <strong>{name}</strong>
            {address ? <div className="text-xs">{address}</div> : null}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
