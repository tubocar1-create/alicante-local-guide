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

      // Single floating tooltip, follows touch/mouse and shows the nearest beach
      const tooltip = document.createElement("div");
      tooltip.style.cssText =
        "position:absolute;pointer-events:none;transform:translate(-50%,-100%);background:rgba(255,255,255,0.97);padding:6px 10px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.25);font-family:system-ui;text-align:center;min-width:110px;max-width:200px;opacity:0;transition:opacity .12s;z-index:10;margin-top:-14px;";
      ref.current!.style.position = "relative";
      ref.current!.style.cursor = "pointer";
      ref.current!.appendChild(tooltip);

      // Floating arrow cursor that follows pointer / finger
      const arrow = document.createElement("div");
      arrow.style.cssText =
        "position:absolute;pointer-events:none;transform:translate(-10%,-10%);font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45));opacity:0;transition:opacity .12s;z-index:11;";
      arrow.textContent = "👆";
      ref.current!.appendChild(arrow);

      const markers: { beach: Beach; marker: any }[] = [];
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
          window.location.href = `/playas/${b.slug}`;
        });
        markers.push({ beach: b, marker });
      });

      // Cached container pixel positions (map is locked, so compute once on idle)
      let pixelCache: { beach: Beach; x: number; y: number }[] = [];
      const overlay = new google.maps.OverlayView();
      overlay.onAdd = () => {};
      overlay.draw = () => {
        const proj = overlay.getProjection();
        if (!proj) return;
        pixelCache = markers.map(({ beach, marker }) => {
          const p = proj.fromLatLngToContainerPixel(marker.getPosition()!);
          return { beach, x: p?.x ?? 0, y: p?.y ?? 0 };
        });
      };
      overlay.onRemove = () => {};
      overlay.setMap(map);

      const onMove = (ev: PointerEvent) => {
        const rect = ref.current!.getBoundingClientRect();
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
          tooltip.innerHTML = `<div style="font-size:12px;font-weight:800;color:#1565c0;line-height:1.15">${best.beach.name}</div><div style="font-size:10px;color:#475569;line-height:1.2;margin-top:2px">${best.beach.description}</div>`;
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
      ref.current!.addEventListener("pointermove", onMove);
      ref.current!.addEventListener("pointerdown", onMove);
      ref.current!.addEventListener("pointerleave", onLeave);
    });
    return () => {
      cancelled = true;
    };
  }, [beaches]);

  return <div ref={ref} style={{ height: "100%", width: "100%" }} />;
}
