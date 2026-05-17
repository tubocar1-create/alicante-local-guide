// Shared leaflet CSS link config — included only on routes that render maps.
export const LEAFLET_HEAD_LINK = {
  rel: "stylesheet",
  href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
  crossOrigin: "",
} as const;
