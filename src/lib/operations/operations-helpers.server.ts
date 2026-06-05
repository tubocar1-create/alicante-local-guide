/** Helpers de tracking operacional — importados desde operations.functions.ts.
 *  Viven en .server.ts para sobrevivir al splitter `?tss-serverfn-split`. */

/** Devuelve la IP truncada a /24 (IPv4) o /48 (IPv6). Nunca la completa. */
export function truncateIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ip = raw.split(",")[0].trim();
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::";
  }
  return null;
}

type CfLike = { city?: unknown; region?: unknown; country?: unknown };

/** Lee país/ciudad/región desde headers de Cloudflare o request.cf. */
export function readGeo(request: Request): {
  country: string | null;
  city: string | null;
  region: string | null;
} {
  const h = request.headers;
  const country = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? null;
  let city = h.get("cf-ipcity") ?? h.get("x-vercel-ip-city") ?? null;
  let region = h.get("cf-region") ?? h.get("x-vercel-ip-country-region") ?? null;
  const cf = (request as unknown as { cf?: CfLike }).cf;
  if (cf) {
    if (!city && typeof cf.city === "string") city = cf.city;
    if (!region && typeof cf.region === "string") region = cf.region;
  }
  return {
    country: country ? country.slice(0, 8) : null,
    city: city ? city.slice(0, 64) : null,
    region: region ? region.slice(0, 64) : null,
  };
}

export function readIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for") ??
    null
  );
}
