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

      class BeachLabel extends google.maps.OverlayView {
        private div: HTMLDivElement | null = null;
        constructor(private position: any, private beach: Beach) {
          super();
        }
        onAdd() {
          const div = document.createElement("div");
          div.style.cssText =
            "position:absolute;transform:translate(-50%,8px);background:rgba(255,255,255,0.95);padding:4px 8px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.2);font-family:system-ui;text-align:center;min-width:90px;max-width:160px;cursor:pointer;pointer-events:auto;";
          div.innerHTML = `<div style="font-size:11px;font-weight:800;color:#1565c0;line-height:1.1">${this.beach.name}</div><div style="font-size:9px;color:#475569;line-height:1.15;margin-top:2px">${this.beach.description}</div>`;
          div.addEventListener("click", () => {
            window.location.href = `/playas/${this.beach.slug}`;
          });
          this.div = div;
          this.getPanes()!.overlayMouseTarget.appendChild(div);
        }
        draw() {
          if (!this.div) return;
          const p = this.getProjection().fromLatLngToDivPixel(this.position);
          if (!p) return;
          this.div.style.left = `${p.x}px`;
          this.div.style.top = `${p.y}px`;
        }
        onRemove() {
          this.div?.remove();
          this.div = null;
        }
      }

      beaches.forEach((b) => {
        const pos = new google.maps.LatLng(b.lat, b.lng);
        const marker = new google.maps.Marker({
          position: pos,
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
          window.location.href = `/playas/${b.slug}`;
        });
        const label = new BeachLabel(pos, b);
        label.setMap(map);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [beaches]);

  return <div ref={ref} style={{ height: "100%", width: "100%" }} />;
}
