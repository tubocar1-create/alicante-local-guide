// Cartelera tiempo real Alicante Terminal — fuente ADIF
import { createServerFn } from "@tanstack/react-start";

const BASE = "https://www.adif.es/w/60911-alacant/alicante-t";

export type CarteleraTrain = {
  direction: "SALIDA" | "LLEGADA";
  operator: string;
  trainNumber: string;
  origin: string;
  destination: string;
  scheduled: string;
  estimated: string;
  delayMin: number;
  platform: string;
  status: "EN_HORA" | "RETRASO" | "ADELANTO" | "CANCELADO" | "CAMBIO";
  observation: string;
};

export type CarteleraResponse = {
  generatedAt: string;
  station: string;
  salidas: CarteleraTrain[];
  llegadas: CarteleraTrain[];
};

function parseMin(a: string, b: string): number {
  if (!a || !b || a === b) return 0;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  let d = bh * 60 + bm - (ah * 60 + am);
  if (d < -720) d += 1440;
  if (d > 720) d -= 1440;
  return d;
}

function norm(item: any, dir: "SALIDA" | "LLEGADA", tt: string): CarteleraTrain {
  const scheduled = (item.hora || "").trim();
  const estimated = item.horaEstado && item.horaEstado.trim() ? item.horaEstado.trim() : scheduled;
  const delay = parseMin(scheduled, estimated);
  let status: CarteleraTrain["status"] = "EN_HORA";
  if (item.markupColor === "suppressed") status = "CANCELADO";
  else if (delay > 0) status = "RETRASO";
  else if (delay < 0) status = "ADELANTO";
  else if (item.markupColor === "audited") status = "CAMBIO";
  const op =
    (item.trenDatosOp || "").replace(/<[^>]+>/g, "").trim() ||
    (tt === "cercanias" ? "Renfe Cercanías" : "Renfe");
  const station = (item.estacion || "").trim();
  return {
    direction: dir,
    operator: op,
    trainNumber: (item.tren || "").replace(/<[^>]+>/g, "").trim(),
    origin: dir === "LLEGADA" ? station : "Alicante-Terminal",
    destination: dir === "SALIDA" ? station : "Alicante-Terminal",
    scheduled,
    estimated,
    delayMin: delay,
    platform: (item.via || "").trim(),
    status,
    observation: (item.observation || "").trim(),
  };
}

export const getCartelera = createServerFn({ method: "GET" }).handler(
  async (): Promise<CarteleraResponse> => {
    const r1 = await fetch(BASE, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });
    const setCookies = (r1.headers as any).getSetCookie
      ? (r1.headers as any).getSetCookie()
      : [r1.headers.get("set-cookie")].filter(Boolean);
    const cookieHeader = (setCookies as string[]).map((c) => c.split(";")[0]).join("; ");
    const html = await r1.text();
    const mAuth = html.match(/p_p_auth=([A-Za-z0-9]+)/);
    if (!mAuth) {
      console.error("[cartelera] ADIF no p_p_auth", {
        status: r1.status,
        url: r1.url,
        len: html.length,
        snippet: html.slice(0, 300),
      });
      throw new Error("ADIF: no p_p_auth");
    }
    const auth = mAuth[1];
    const URL_RES = `${BASE}?p_p_id=servicios_estacion_ServiciosEstacionPortlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2FconsultarHorario&p_p_cacheability=cacheLevelPage&assetEntryId=3068526&p_p_auth=${auth}`;

    async function call(searchType: string, trafficType: string, numPage = 0) {
      const body = new URLSearchParams({
        _servicios_estacion_ServiciosEstacionPortlet_searchType: searchType,
        _servicios_estacion_ServiciosEstacionPortlet_trafficType: trafficType,
        _servicios_estacion_ServiciosEstacionPortlet_numPage: String(numPage),
        _servicios_estacion_ServiciosEstacionPortlet_commuterNetwork: "MURCIA_ALICANTE",
        _servicios_estacion_ServiciosEstacionPortlet_stationCode: "60911",
      });
      const r = await fetch(URL_RES, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          Referer: BASE,
          Cookie: cookieHeader,
        },
        body,
      });
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch {
        return { horarios: [] };
      }
    }

    const ops: Array<[string, string, "SALIDA" | "LLEGADA"]> = [
      ["proximasSalidas", "cercanias", "SALIDA"],
      ["proximasSalidas", "avldmd", "SALIDA"],
      ["proximasLlegadas", "cercanias", "LLEGADA"],
      ["proximasLlegadas", "avldmd", "LLEGADA"],
    ];

    const salidas: CarteleraTrain[] = [];
    const llegadas: CarteleraTrain[] = [];
    for (const [s, t, dir] of ops) {
      for (let p = 0; p < 3; p++) {
        const j = await call(s, t, p);
        if (!j.horarios || !j.horarios.length) break;
        for (const it of j.horarios) {
          const n = norm(it, dir, t);
          (dir === "SALIDA" ? salidas : llegadas).push(n);
        }
        if (j.horarios.length < 10) break;
      }
    }

    const dedup = (arr: CarteleraTrain[]) => {
      const m = new Map<string, CarteleraTrain>();
      for (const x of arr) {
        const k = `${x.trainNumber}|${x.scheduled}|${x.destination}|${x.origin}`;
        if (!m.has(k)) m.set(k, x);
      }
      return [...m.values()].sort((a, b) => a.estimated.localeCompare(b.estimated));
    };

    return {
      generatedAt: new Date().toISOString(),
      station: "Alicante Terminal",
      salidas: dedup(salidas),
      llegadas: dedup(llegadas),
    };
  },
);
