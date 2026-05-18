import { useEffect, useRef } from "react";

export type Beach = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  description: string;
};

declare global {
  interface Window {
    google?: any;
    __initAlicanteMap?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  scriptPromise = new Promise((resolve, reject) => {
    window.__initAlicanteMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initAlicanteMap&channel=${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function LeafletMap({ beaches }: { beaches: Beach[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !ref.current || !window.google?.maps) return;
      const google = window.google;
      const fixedCenter = { lat: 38.335, lng: -0.47 };
      const map = new google.maps.Map(ref.current, {
        center: fixedCenter,
        zoom: 11,
        minZoom: 11,
        maxZoom: 11,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: "none",
        keyboardShortcuts: false,
        zoomControl: false,
        scrollwheel: false,
        disableDoubleClickZoom: true,
        draggable: false,
      });

      google.maps.event.addListener(map, "center_changed", () => {
        const center = map.getCenter();
        if (!center) return;
        if (
          Math.abs(center.lat() - fixedCenter.lat) > 0.00001 ||
          Math.abs(center.lng() - fixedCenter.lng) > 0.00001
        ) {
          map.setCenter(fixedCenter);
        }
      });

      const info = new google.maps.InfoWindow({ disableAutoPan: true });
      beaches.forEach((b) => {
        const marker = new google.maps.Marker({
          position: { lat: b.lat, lng: b.lng },
          map,
          title: b.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#1e88e5",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          label: { text: "🏖️", fontSize: "14px" },
        });
        marker.addListener("click", () => {
          info.setContent(
            `<div style="min-width:200px;font-family:system-ui">
              <strong style="color:#1565c0;font-size:14px">${b.name}</strong>
              <p style="margin:4px 0 8px;font-size:12px;color:#475569">${b.description}</p>
              <a href="/playas/${b.slug}" style="display:inline-block;background:#0891b2;color:#fff;padding:6px 12px;border-radius:9999px;font-size:12px;font-weight:800;text-decoration:none">Abrir playa →</a>
            </div>`,
          );
          info.open({ anchor: marker, map });
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [beaches]);

  return <div ref={ref} style={{ height: "100%", width: "100%" }} />;
}
