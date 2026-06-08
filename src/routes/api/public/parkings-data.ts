import { createFileRoute } from "@tanstack/react-router";

// Server-side proxy to movilidad.alicante.es/asmpois — extracts only the
// parking rows so the client doesn't need to hit a third-party endpoint
// (which blocks browser fetches via CORS).

type RawPoi = Record<string, unknown> & {
  id?: string | number;
  title?: string;
  name?: string;
  content_type?: string;
  icono?: string;
  popup?: { content?: string };
  lat?: number | string;
  lng?: number | string;
  lon?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  position?: { lat?: number; lng?: number; lon?: number };
  geo?: { lat?: number; lng?: number; lon?: number };
  coordinates?: number[] | { lat?: number; lng?: number };
};

type Status = "green" | "yellow" | "red" | "unknown";

type Coords = { lat: number; lng: number };

type ParkingRow = {
  id: string;
  name: string;
  status: Status;
  free?: number;
  total?: number;
  occupancyPct?: number;
  availablePct?: number;
  coords?: Coords;
  popupText?: string;
};

function flattenPois(payload: unknown): RawPoi[] {
  const out: RawPoi[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if ("content_type" in obj || "icono" in obj || "popup" in obj) out.push(obj as RawPoi);
      Object.values(obj).forEach(visit);
    }
  };
  visit(payload);
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = String(p.id ?? JSON.stringify(p).slice(0, 80));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function statusFromIcono(icono?: string): Status {
  if (!icono) return "unknown";
  const i = icono.toLowerCase();
  if (i.includes("green") || i.includes("verde")) return "green";
  if (i.includes("yellow") || i.includes("amber") || i.includes("orange") || i.includes("amarillo")) return "yellow";
  if (i.includes("red") || i.includes("rojo")) return "red";
  return "unknown";
}

function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFreeTotal(text: string): { free?: number; total?: number } {
  const slash = text.match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
  if (slash) return { free: Number(slash[1]), total: Number(slash[2]) };
  const de = text.match(/(\d{1,4})\s+de\s+(\d{1,4})/i);
  if (de) return { free: Number(de[1]), total: Number(de[2]) };
  const libres = text.match(/(?:libres?\s*[:\-]?\s*)(\d{1,4})/i) || text.match(/(\d{1,4})\s*libres?/i);
  const total = text.match(/(?:total|plazas|capacidad)\s*[:\-]?\s*(\d{1,4})/i);
  return {
    free: libres ? Number(libres[1]) : undefined,
    total: total ? Number(total[1]) : undefined,
  };
}

function extractCoords(p: RawPoi): Coords | undefined {
  const toNum = (v: unknown) => (v == null ? NaN : Number(v));
  const tryPair = (lat: unknown, lng: unknown): Coords | undefined => {
    const la = toNum(lat);
    const ln = toNum(lng);
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      return { lat: la, lng: ln };
    }
    return undefined;
  };
  return (
    tryPair(p.lat, p.lng ?? p.lon) ||
    tryPair(p.latitude, p.longitude) ||
    tryPair(p.position?.lat, p.position?.lng ?? p.position?.lon) ||
    tryPair(p.geo?.lat, p.geo?.lng ?? p.geo?.lon) ||
    (Array.isArray(p.coordinates)
      ? tryPair(p.coordinates[1], p.coordinates[0])
      : p.coordinates && typeof p.coordinates === "object"
        ? tryPair((p.coordinates as { lat?: number; lng?: number }).lat, (p.coordinates as { lat?: number; lng?: number }).lng)
        : undefined)
  );
}

function extractNameFromPopup(html: string, fallback: string): string {
  if (!html) return fallback;
  const h = html.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i);
  if (h) {
    const t = htmlToText(h[1]);
    if (t) return t;
  }
  const strong = html.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
  if (strong) {
    const t = htmlToText(strong[1]);
    if (t && !/^\d/.test(t)) return t;
  }
  const plain = htmlToText(html);
  const first = plain.split(/[.·•\-–|]/)[0]?.trim();
  if (first && first.length > 2 && first.length < 60 && !/^\d/.test(first)) return first;
  return fallback;
}

function extractParkings(payload: unknown): ParkingRow[] {
  return flattenPois(payload)
    .filter((p) => String(p.content_type ?? "").toLowerCase().includes("parking"))
    .map((p) => {
      const popupHtml = p.popup?.content ?? "";
      const popupText = htmlToText(popupHtml);
      const { free, total } = extractFreeTotal(popupText);
      let availablePct: number | undefined;
      let occupancyPct: number | undefined;
      if (free != null && total != null && total > 0) {
        availablePct = Math.max(0, Math.min(100, Math.round((free / total) * 100)));
        occupancyPct = 100 - availablePct;
      }
      const fallbackName = String(p.title ?? p.name ?? "Parking");
      const name = extractNameFromPopup(popupHtml, fallbackName);
      return {
        id: String(p.id ?? name ?? Math.random()),
        name,
        status: statusFromIcono(p.icono),
        free,
        total,
        availablePct,
        occupancyPct,
        coords: extractCoords(p),
        popupText: popupText || undefined,
      };
    });
}

export const Route = createFileRoute("/api/public/parkings-data")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const r = await fetch("https://movilidad.alicante.es/asmpois", {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
              Accept: "application/json, text/plain, */*",
              Referer: "https://movilidad.alicante.es/",
              "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) {
            return Response.json({ ok: false, error: `HTTP ${r.status}`, rows: [] }, { status: 200 });
          }
          const text = await r.text();
          const json = JSON.parse(text);
          const rows = extractParkings(json);
          return new Response(JSON.stringify({ ok: true, rows, updatedAt: Date.now() }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60, s-maxage=60",
            },
          });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e), rows: [] },
            { status: 200 },
          );
        }
      },
    },
  },
});
