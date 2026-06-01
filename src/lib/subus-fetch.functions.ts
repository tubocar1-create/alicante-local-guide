import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Reproduce el flujo real del navegador contra Vectalia/SUBUS:
//   1) GET consulta.aspx?p=N  → captura cookies de sesión (ASP.NET_SessionId, etc.)
//   2) GET datos.aspx?p=N     → con cookies + headers replicados
// Sin proxy, sin ScrapingBee. Devuelve status, headers, cookies y body
// completo de cada paso para inspección.

const CONSULTA_URL = "http://www.subus.es/QR/Alicante/consulta.aspx";
const DATOS_URL = "http://www.subus.es/QR/Alicante/datos.aspx";

const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export type SubusStep = {
  type: string;
  ok: boolean;
  status: number;
  statusText: string;
  ms: number;
  url: string;
  finalUrl: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  setCookie: string[];
  cookieJar: Record<string, string>;
  bodyLength: number;
  body: string;
  json?: JsonValue;
  error?: string;
};

// Parser ligero de Set-Cookie → { name: value } (acumulativo).
function mergeSetCookie(
  jar: Record<string, string>,
  setCookieHeaders: string[],
): Record<string, string> {
  const out = { ...jar };
  for (const raw of setCookieHeaders) {
    // Una línea Set-Cookie por entrada (lo dividimos abajo si vienen
    // concatenadas con coma, evitando cortar "Expires=Mon, 01 Jan...").
    const parts = splitSetCookie(raw);
    for (const part of parts) {
      const [pair] = part.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name) continue;
      // valor vacío = borrar
      if (!value || /^deleted$/i.test(value)) {
        delete out[name];
      } else {
        out[name] = value;
      }
    }
  }
  return out;
}

function splitSetCookie(input: string): string[] {
  // Divide por comas que NO estén dentro de "Expires=...".
  const parts: string[] = [];
  let buf = "";
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === ",") {
      // Mira si lo que sigue parece "<sp>DDD<sp>" (Expires) — si sí, no es separador.
      const ahead = input.slice(i + 1, i + 6);
      if (/^\s\d{2}[ -]/.test(ahead)) {
        buf += c;
        i++;
        continue;
      }
      parts.push(buf);
      buf = "";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function cookieJarToHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

// Node/undici expone los Set-Cookie agregados via .getSetCookie() (Headers spec).
// Fallback: parsear el header concatenado.
function extractSetCookies(h: Headers): string[] {
  const anyH = h as unknown as { getSetCookie?: () => string[] };
  if (typeof anyH.getSetCookie === "function") {
    return anyH.getSetCookie();
  }
  const raw = h.get("set-cookie");
  return raw ? splitSetCookie(raw) : [];
}

async function fetchStep(opts: {
  type: string;
  url: string;
  extraHeaders?: Record<string, string>;
  cookieJar: Record<string, string>;
  referer?: string;
}): Promise<SubusStep> {
  const t0 = Date.now();
  const requestHeaders: Record<string, string> = {
    "User-Agent": UA,
    Accept: opts.extraHeaders?.Accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    ...(opts.referer ? { Referer: opts.referer } : {}),
    ...(opts.extraHeaders || {}),
  };
  const cookieHeader = cookieJarToHeader(opts.cookieJar);
  if (cookieHeader) requestHeaders["Cookie"] = cookieHeader;

  try {
    const r = await fetch(opts.url, {
      headers: requestHeaders,
      redirect: "follow",
    });
    const body = await r.text();
    const setCookie = extractSetCookies(r.headers);
    const cookieJar = mergeSetCookie(opts.cookieJar, setCookie);
    let json: JsonValue | undefined;
    try {
      json = JSON.parse(body) as JsonValue;
    } catch {
      /* HTML */
    }
    return {
      type: opts.type,
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      ms: Date.now() - t0,
      url: opts.url,
      finalUrl: r.url,
      requestHeaders,
      responseHeaders: headersToObject(r.headers),
      setCookie,
      cookieJar,
      bodyLength: body.length,
      body,
      json,
    };
  } catch (e) {
    return {
      type: opts.type,
      ok: false,
      status: 0,
      statusText: "",
      ms: Date.now() - t0,
      url: opts.url,
      finalUrl: opts.url,
      requestHeaders,
      responseHeaders: {},
      setCookie: [],
      cookieJar: opts.cookieJar,
      bodyLength: 0,
      body: "",
      error: String(e),
    };
  }
}

export type SubusInspectResult = {
  ts: string;
  stop: string;
  steps: SubusStep[];
  // Campos diagnóstico extraídos del body de datos.aspx (si es JSON).
  diagnostic: {
    nparada?: JsonValue;
    parada?: JsonValue;
    tiempos?: JsonValue;
  };
};

function extractField(json: JsonValue | undefined, key: string): JsonValue | undefined {
  if (!json || typeof json !== "object" || Array.isArray(json)) return undefined;
  // case-insensitive
  for (const k of Object.keys(json)) {
    if (k.toLowerCase() === key.toLowerCase()) return (json as Record<string, JsonValue>)[k];
  }
  return undefined;
}

export const subusInspect = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      stop: z.string().regex(/^\d{1,6}$/),
    }).parse,
  )
  .handler(async ({ data }): Promise<SubusInspectResult> => {
    const stop = data.stop;
    const consultaUrl = `${CONSULTA_URL}?p=${encodeURIComponent(stop)}`;
    const datosUrl = `${DATOS_URL}?p=${encodeURIComponent(stop)}`;

    // Paso 1: GET consulta.aspx (recoge cookies)
    const step1 = await fetchStep({
      type: "1) consulta.aspx",
      url: consultaUrl,
      cookieJar: {},
    });

    // Paso 2: GET datos.aspx (con cookies + headers que envía el navegador real)
    const step2 = await fetchStep({
      type: "2) datos.aspx",
      url: datosUrl,
      cookieJar: step1.cookieJar,
      referer: consultaUrl,
      extraHeaders: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "X-Vectalia-App": "qr-alicante",
      },
    });

    return {
      ts: new Date().toISOString(),
      stop,
      steps: [step1, step2],
      diagnostic: {
        nparada: extractField(step2.json, "nparada"),
        parada: extractField(step2.json, "parada"),
        tiempos: extractField(step2.json, "tiempos"),
      },
    };
  });
