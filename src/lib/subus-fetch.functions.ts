import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-side fetch directo (sin scrapingbee, sin iframe) de los
// endpoints de Vectalia/SUBUS. Replica lo que hace el JS de
// consulta.aspx cuando llama a datos.aspx — pero corriendo en el
// servidor para evitar CORS / X-Frame-Options.

const CONSULTA_URL = "https://movilidad.vectalia.es/QR/Alicante/consulta.aspx";
const DATOS_URL = "https://movilidad.vectalia.es/QR/Alicante/datos.aspx";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Referer: "https://movilidad.vectalia.es/QR/Alicante/consulta.aspx",
};

async function fetchOne(target: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(target, { headers: COMMON_HEADERS, redirect: "follow" });
    const text = await r.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* puede ser HTML */
    }
    return {
      ok: r.ok,
      status: r.status,
      ms: Date.now() - t0,
      url: target,
      finalUrl: r.url,
      bodyLength: text.length,
      bodyPreview: text.slice(0, 4000),
      json,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      url: target,
      error: String(e),
    };
  }
}

export const subusInspect = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      stop: z.string().regex(/^\d{1,6}$/),
    }).parse,
  )
  .handler(async ({ data }) => {
    const stop = data.stop;
    const consultaUrl = `${CONSULTA_URL}?p=${encodeURIComponent(stop)}`;
    const datosUrl = `${DATOS_URL}?p=${encodeURIComponent(stop)}`;
    const [consulta, datos] = await Promise.all([
      fetchOne(consultaUrl),
      fetchOne(datosUrl),
    ]);
    return {
      ts: new Date().toISOString(),
      stop,
      requests: [
        { type: "consulta.aspx", ...consulta },
        { type: "datos.aspx", ...datos },
      ],
    };
  });
