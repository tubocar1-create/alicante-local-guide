import { useEffect, useRef } from "react";

export type Beach = {
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
      const map = new google.maps.Map(ref.current, {
        center: { lat: 38.335, lng: -0.47 },
        zoom: 11,
        minZoom: 11,
        maxZoom: 11,
        disableDefaultUI: true,
        gestureHandling: "none",
        keyboardShortcuts: false,
        zoomControl: false,
        scrollwheel: false,
        disableDoubleClickZoom: true,
        draggable: false,
      });

      const info = new google.maps.InfoWindow();
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
            `<div style="min-width:180px;font-family:system-ui">
              <strong style="color:#1565c0;font-size:14px">${b.name}</strong>
              <p style="margin:4px 0 0;font-size:12px;color:#475569">${b.description}</p>
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
