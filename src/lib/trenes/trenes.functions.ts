// Server fn que devuelve, para una estación dada del corredor,
// la lista de trenes próximos 30 días en dirección S (Alicante→X) o L (X→Alicante).
// Combina snapshot GTFS Renfe + reglas fijas OUIGO/IRYO.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  FIXED_TRIPS,
  FIXED_CORRIDOR_STATIONS,
  addMinutes,
  fmtDuration,
} from "./fixed-schedules";

export type StationTrip = {
  id: string;
  date: string;        // ISO YYYY-MM-DD
  operator: "RENFE" | "AVLO" | "OUIGO" | "IRYO";
  product: string;
  number: string;
  departure: string;   // HH:MM en estación de origen del segmento solicitado
  arrival: string;     // HH:MM en estación destino
  durationLabel: string;
  origin: string;      // código (ALC | code intermedio)
  destination: string;
};

const InputSchema = z.object({
  stationCode: z.string().min(1).max(32),
  direction: z.enum(["S", "L"]),
});

const ALC_TERMINAL_RE = /terminal/i;

function diffMinutes(a: string, b: string): number {
  // HH:MM:SS o HH:MM. Renfe usa HH:MM:SS.
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  let d = (bh * 60 + bm) - (ah * 60 + am);
  if (d < 0) d += 1440;
  return d;
}

function hhmm(t: string): string {
  // Acepta HH:MM o HH:MM:SS
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

// Mapeo del código de estación interno del front (MAD-CHA, NOR-ZAZ, etc.)
// a un matcher contra el nombre del stop GTFS de Renfe.
// Solo lo justo para los corredores con datos GTFS reales.
const STATION_NAME_MATCHERS: Record<string, RegExp[]> = {
  // Corredor Madrid
  "MAD-VLL":  [/villena/i],
  "MAD-ALB":  [/albacete/i],
  "MAD-CUE":  [/cuenca/i],
  "MAD-CR":   [/ciudad\s*real/i],
  "MAD-PTL":  [/puertollano/i],
  "MAD-CHA":  [/chamart/i],
  // Mediterráneo Norte
  "MED-VLCJ": [/valencia.*sorolla/i, /joaqu[ií]n\s*sorolla/i],
  "MED-VLCN": [/valencia.*nord/i, /val[èe]ncia.*nord/i],
  "MED-XAT":  [/x[àa]tiva/i, /j[áa]tiva/i],
  "MED-CAS":  [/castell[óo]/i],
  "MED-TARC": [/camp\s*de\s*tarragona/i],
  "MED-TAR":  [/^tarragona$/i],
  "MED-BCN":  [/barcelona.*sants/i, /^barcelona$/i],
  // Norte
  "NOR-ZAZ":  [/zaragoza.*delicias/i, /^zaragoza/i],
  "NOR-SEG":  [/segovia/i],
  "NOR-VAD":  [/valladolid/i],
  "NOR-PAL":  [/palencia/i],
  "NOR-BUR":  [/burgos/i],
  "NOR-LEO":  [/^le[óo]n/i],
  "NOR-OUR":  [/ourense/i],
  "NOR-COR":  [/coru[ñn]a/i],
  "NOR-VIG":  [/vigo/i],
  "NOR-OVI":  [/oviedo/i],
  "NOR-GIJ":  [/gij[óo]n/i],
  // Murcia / Cercanías C1
  "MUR-SGA":  [/sant\s*gabriel|san\s*gabriel/i],
  "MUR-TOR":  [/torrellano/i],
  "MUR-EPA":  [/elx.*parc|elche.*parque/i],
  "MUR-ECA":  [/elx.*carr[úu]s|elche.*carr[úu]s/i],
  "MUR-CRE":  [/crevillent|crevillente/i],
  "MUR-ALB":  [/albatera|catral/i],
  "MUR-CAL":  [/callosa.*segura|cox/i],
  "MUR-ORI":  [/orihuela/i],
  "MUR-BEN":  [/beniel/i],
  "MUR-MUR":  [/murcia.*carmen|murcia\s*del\s*carmen|^murcia$/i],
  // Cartagena
  "CTG-MUR":  [/murcia.*carmen|^murcia$/i],
  "CTG-BAL":  [/balsicas|mar\s*menor/i],
  "CTG-TPA":  [/torre.*pacheco/i],
  "CTG-CTG":  [/cartagena/i],
  // Lorca
  "LOR-MUR":  [/murcia.*carmen|^murcia$/i],
  "LOR-ALC":  [/alcantarilla/i],
  "LOR-LIB":  [/librilla/i],
  "LOR-ALH":  [/alhama/i],
  "LOR-TOT":  [/totana/i],
  "LOR-LOR":  [/lorca/i],
  // Universidad C3
  "UNI-UNI":  [/universidad.*alicante|universitat/i],
  "UNI-SVI":  [/sant\s*vicent.*centre|san\s*vicente.*centro/i],
};

export const getStationSchedule = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ trips: StationTrip[]; generatedAt: string | null }> => {
    const { stationCode, direction } = data;

    // 1) Leer snapshot (puede no existir si aún no se ha sincronizado).
    const { data: snap } = await supabaseAdmin
      .from("train_schedule_snapshot")
      .select("payload, generated_at")
      .eq("id", "alicante-terminal")
      .maybeSingle();

    const out: StationTrip[] = [];

    if (snap?.payload) {
      const payload = snap.payload as any;
      const stops: Record<string, string> = payload.stops || {};
      const matchers = STATION_NAME_MATCHERS[stationCode] || [];

      // Resolver qué stop_ids del snapshot corresponden a la estación pedida
      const targetStopIds = new Set<string>();
      for (const [sid, name] of Object.entries(stops)) {
        if (matchers.some((re) => re.test(name))) targetStopIds.add(sid);
      }

      for (const trip of payload.trips as any[]) {
        const sts = trip.stops as { id: string; seq: number; arr: string; dep: string }[];
        const terminalId = trip.terminalId as string;
        const idxA = sts.findIndex((s) => s.id === terminalId);
        if (idxA < 0) continue;

        // Buscar target
        let idxT = -1;
        for (let i = 0; i < sts.length; i++) {
          if (targetStopIds.has(sts[i].id)) { idxT = i; break; }
        }
        if (idxT < 0) continue;

        if (direction === "S" && idxT <= idxA) continue;
        if (direction === "L" && idxT >= idxA) continue;

        const fromStop = direction === "S" ? sts[idxA] : sts[idxT];
        const toStop   = direction === "S" ? sts[idxT] : sts[idxA];
        const dep = hhmm(fromStop.dep || fromStop.arr);
        const arr = hhmm(toStop.arr || toStop.dep);
        const dur = diffMinutes(fromStop.dep || fromStop.arr, toStop.arr || toStop.dep);

        const operator = (trip.product === "AVLO" ? "AVLO" : "RENFE") as "RENFE" | "AVLO";

        for (const date of trip.dates as string[]) {
          out.push({
            id: `${trip.id}-${date}`,
            date,
            operator,
            product: trip.product,
            number: trip.number,
            departure: dep,
            arrival: arr,
            durationLabel: fmtDuration(dur),
            origin: direction === "S" ? "ALC" : stationCode,
            destination: direction === "S" ? stationCode : "ALC",
          });
        }
      }
    }

    // 2) Reglas fijas OUIGO / IRYO (solo si la estación pertenece al corredor Madrid soportado).
    if (FIXED_CORRIDOR_STATIONS.has(stationCode)) {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const days: string[] = [];
      for (let d = 0; d < 30; d++) {
        const x = new Date(today); x.setUTCDate(x.getUTCDate() + d);
        days.push(
          `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`
        );
      }

      for (const ft of FIXED_TRIPS) {
        if (ft.direction !== direction) continue;
        // Tiempo en la estación intermedia (offset desde salida) o en destino final (durationMin).
        let originHHMM: string;
        let arrivalHHMM: string;
        if (stationCode === "MAD-CHA") {
          // Estación principal del corredor.
          if (direction === "S") {
            originHHMM = ft.depart;
            arrivalHHMM = addMinutes(ft.depart, ft.durationMin);
          } else {
            originHHMM = ft.depart;
            arrivalHHMM = addMinutes(ft.depart, ft.durationMin);
          }
        } else {
          // Estación intermedia (Albacete, Cuenca).
          const off = ft.intermediateOffsets[stationCode];
          if (off == null) continue;
          if (direction === "S") {
            // Alicante → intermedia
            originHHMM = ft.depart;                       // sale ALC
            arrivalHHMM = addMinutes(ft.depart, off);     // llega intermedia
          } else {
            // intermedia → Alicante
            // ft.depart es salida desde Madrid. La intermedia se alcanza tras `off` minutos.
            originHHMM = addMinutes(ft.depart, off);      // sale intermedia
            arrivalHHMM = addMinutes(ft.depart, ft.durationMin); // llega ALC
          }
        }
        const dur =
          stationCode === "MAD-CHA"
            ? ft.durationMin
            : direction === "S"
            ? ft.intermediateOffsets[stationCode]
            : ft.durationMin - ft.intermediateOffsets[stationCode];

        for (const date of days) {
          out.push({
            id: `${ft.operator}-${ft.number}-${date}`,
            date,
            operator: ft.operator,
            product: ft.product,
            number: ft.number,
            departure: originHHMM,
            arrival: arrivalHHMM,
            durationLabel: fmtDuration(dur),
            origin: direction === "S" ? "ALC" : stationCode,
            destination: direction === "S" ? stationCode : "ALC",
          });
        }
      }
    }

    // Deduplicar por id, ordenar por fecha+salida
    const dedup = new Map<string, StationTrip>();
    for (const t of out) dedup.set(t.id, t);
    const list = [...dedup.values()].sort((a, b) =>
      a.date === b.date ? a.departure.localeCompare(b.departure) : a.date.localeCompare(b.date)
    );

    return { trips: list, generatedAt: snap?.generated_at ?? null };
  });
