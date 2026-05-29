import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type Beach = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  description: string;
};

// Mapa Leaflet con tiles OpenStreetMap (gratis, sin API key).
// Sustituye a Google Maps: misma referencia geográfica visual, cero coste.
export function LeafletMap({ beaches }: { beaches: Beach[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const map = L.map(ref.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0.25,
    });
    const bounds = L.latLngBounds(beaches.map((b) => [b.lat, b.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [10, 10] });
    const fitZoom = map.getZoom();
    map.setMinZoom(fitZoom);
    map.setMaxZoom(fitZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // Tooltip flotante único
    const container = ref.current;
    container.style.position = "relative";
    container.style.cursor = "pointer";

    const tooltip = document.createElement("div");
    tooltip.style.cssText =
      "position:absolute;pointer-events:none;transform:translate(-50%,-100%);background:rgba(255,255,255,0.97);padding:6px 10px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.25);font-family:system-ui;text-align:center;min-width:110px;max-width:200px;opacity:0;transition:opacity .12s;z-index:1000;margin-top:-14px;";
    container.appendChild(tooltip);

    const arrow = document.createElement("div");
    arrow.style.cssText =
      "position:absolute;pointer-events:none;transform:translate(-10%,-10%);font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45));opacity:0;transition:opacity .12s;z-index:1001;";
    arrow.textContent = "👆";
    container.appendChild(arrow);

    const beachIcon = L.divIcon({
      className: "beach-marker",
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#1e88e5;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const pixelCache: { beach: Beach; x: number; y: number }[] = [];
    beaches.forEach((b) => {
      const marker = L.marker([b.lat, b.lng], { icon: beachIcon }).addTo(map);
      marker.on("click", () => {
        window.location.href = `/playas/${b.slug}`;
      });
      marker.bindTooltip(b.name, {
        permanent: true,
        direction: "right",
        offset: [10, 0],
        className: "beach-label",
      });
      const p = map.latLngToContainerPoint([b.lat, b.lng]);
      pixelCache.push({ beach: b, x: p.x, y: p.y });
    });

    const recomputeCache = () => {
      pixelCache.length = 0;
      beaches.forEach((b) => {
        const p = map.latLngToContainerPoint([b.lat, b.lng]);
        pixelCache.push({ beach: b, x: p.x, y: p.y });
      });
    };
    map.on("resize moveend", recomputeCache);

    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      arrow.style.left = `${x}px`;
      arrow.style.top = `${y}px`;
      arrow.style.opacity = "1";
      let best: { beach: Beach; x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const p of pixelCache) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best && bestD < 70 * 70) {
        tooltip.innerHTML = `<div style="font-size:12px;font-weight:800;color:#1565c0;line-height:1.15">${best.beach.name}</div><div style="font-size:10px;color:#475569;line-height:1.2;margin-top:2px">${best.beach.description}</div><div style="font-size:10px;color:#0d9488;font-weight:700;margin-top:3px">👆 Toca para ver detalles</div>`;
        tooltip.style.left = `${best.x}px`;
        tooltip.style.top = `${best.y}px`;
        tooltip.style.opacity = "1";
      } else {
        tooltip.style.opacity = "0";
      }
    };
    const onLeave = () => {
      tooltip.style.opacity = "0";
      arrow.style.opacity = "0";
    };
    const onTap = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      let best: { beach: Beach; x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const p of pixelCache) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best && bestD < 50 * 50) {
        window.location.href = `/playas/${best.beach.slug}`;
      }
    };
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerdown", onMove);
    container.addEventListener("pointerup", onTap);
    container.addEventListener("pointerleave", onLeave);

    return () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerdown", onMove);
      container.removeEventListener("pointerup", onTap);
      container.removeEventListener("pointerleave", onLeave);
      map.remove();
      tooltip.remove();
      arrow.remove();
    };
  }, [beaches]);

  return <div ref={ref} style={{ height: "100%", width: "100%" }} />;
}
