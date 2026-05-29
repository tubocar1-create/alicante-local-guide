/**
 * Identificación anónima persistente del visitante.
 *
 * Genera un UUID y lo guarda en localStorage + cookie (1 año) para hilar
 * la actividad de un mismo navegador a lo largo del tiempo, incluso antes
 * de que el visitante se registre.
 *
 * Si el visitante luego se loguea, sus eventos pasan a tener `user_id`
 * además del `visitor_id`, y se pueden fusionar en la vista de admin.
 */

const VISITOR_KEY = "vamos_vid";
const UTM_KEY = "vamos_utm";

function uuidv4(): string {
  // Crypto.randomUUID si está disponible (navegadores modernos + workers)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let vid: string | null = null;
  try {
    vid = window.localStorage.getItem(VISITOR_KEY);
  } catch {
    /* Safari modo privado */
  }
  if (!vid) vid = readCookie(VISITOR_KEY);
  if (!vid) {
    vid = uuidv4();
    try {
      window.localStorage.setItem(VISITOR_KEY, vid);
    } catch {
      /* noop */
    }
    writeCookie(VISITOR_KEY, vid, 365);
  } else {
    // Mantener cookie viva
    writeCookie(VISITOR_KEY, vid, 365);
  }
  return vid;
}

export type UtmData = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

/**
 * Captura parámetros UTM de la URL al cargar la app y los persiste en
 * sessionStorage para adjuntarlos a cada evento de esa sesión.
 */
export function captureUtm(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: UtmData = {};
    (["source", "medium", "campaign", "term", "content"] as const).forEach((k) => {
      const v = params.get("utm_" + k);
      if (v) fresh[k] = v.slice(0, 128);
    });
    if (Object.keys(fresh).length > 0) {
      window.sessionStorage.setItem(UTM_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const existing = window.sessionStorage.getItem(UTM_KEY);
    return existing ? (JSON.parse(existing) as UtmData) : {};
  } catch {
    return {};
  }
}

export function getUtm(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(UTM_KEY);
    return raw ? (JSON.parse(raw) as UtmData) : {};
  } catch {
    return {};
  }
}

export function getReferrer(): string | null {
  if (typeof document === "undefined") return null;
  const r = document.referrer;
  if (!r) return null;
  try {
    const u = new URL(r);
    // Ignora referer del propio dominio
    if (typeof window !== "undefined" && u.hostname === window.location.hostname) {
      return null;
    }
    return r.slice(0, 512);
  } catch {
    return null;
  }
}
