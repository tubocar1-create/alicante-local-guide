/**
 * Mini parser de User-Agent: devuelve browser, OS y tipo de dispositivo.
 * Sin dependencias. Cubre los casos mayoritarios (Chrome/Safari/Firefox/Edge,
 * iOS/Android/Windows/macOS/Linux). Server-only para no inflar bundle cliente.
 */

export type UaInfo = {
  browser: string | null;
  os: string | null;
  device: "mobile" | "tablet" | "desktop" | "bot" | null;
};

const BOT_RE = /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegrambot|slackbot|discordbot|preview/i;

export function parseUserAgent(ua: string): UaInfo {
  if (!ua) return { browser: null, os: null, device: null };
  const s = ua.toLowerCase();

  // Device
  let device: UaInfo["device"];
  if (BOT_RE.test(ua)) device = "bot";
  else if (/ipad|tablet|playbook|silk/.test(s) || (/android/.test(s) && !/mobile/.test(s))) device = "tablet";
  else if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) device = "mobile";
  else device = "desktop";

  // OS
  let os: string | null = null;
  if (/iphone|ipad|ipod/.test(s)) {
    const m = ua.match(/OS (\d+[._]\d+)/);
    os = m ? `iOS ${m[1].replace("_", ".")}` : "iOS";
  } else if (/android/.test(s)) {
    const m = ua.match(/Android (\d+(?:\.\d+)?)/);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/windows nt/.test(s)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/);
    const map: Record<string, string> = {
      "10.0": "Windows 10/11",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    os = m ? map[m[1]] ?? `Windows ${m[1]}` : "Windows";
  } else if (/mac os x/.test(s)) {
    const m = ua.match(/Mac OS X (\d+[._]\d+)/);
    os = m ? `macOS ${m[1].replace("_", ".")}` : "macOS";
  } else if (/cros/.test(s)) {
    os = "ChromeOS";
  } else if (/linux/.test(s)) {
    os = "Linux";
  }

  // Browser (orden importa: Edge antes que Chrome, Chrome antes que Safari)
  let browser: string | null = null;
  if (/edg\//i.test(ua)) {
    const m = ua.match(/Edg\/(\d+)/);
    browser = m ? `Edge ${m[1]}` : "Edge";
  } else if (/opr\/|opera/i.test(ua)) {
    const m = ua.match(/(?:OPR|Opera)\/(\d+)/);
    browser = m ? `Opera ${m[1]}` : "Opera";
  } else if (/firefox\//i.test(ua)) {
    const m = ua.match(/Firefox\/(\d+)/);
    browser = m ? `Firefox ${m[1]}` : "Firefox";
  } else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) {
    const m = ua.match(/Chrome\/(\d+)/);
    browser = m ? `Chrome ${m[1]}` : "Chrome";
  } else if (/safari\//i.test(ua) && /version\//i.test(ua)) {
    const m = ua.match(/Version\/(\d+)/);
    browser = m ? `Safari ${m[1]}` : "Safari";
  } else if (device === "bot") {
    const m = ua.match(/([A-Za-z]+bot[A-Za-z]*)/i);
    browser = m ? m[1] : "Bot";
  }

  return { browser, os, device };
}
