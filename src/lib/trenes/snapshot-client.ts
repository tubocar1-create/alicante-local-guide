// Cliente: lee /data/alicante_snapshot.json (Renfe filtrado a Alicante)
// y mezcla con reglas fijas OUIGO/IRYO. Cero parsing pesado, cero DB.

import {
  FIXED_TRIPS,
  FIXED_CORRIDOR_STATIONS,
  addMinutes,
  fmtDuration,
} from "./fixed-schedules";

export type StationTrip = {
  id: string;
  date: string;
  operator: "RENFE" | "AVLO" | "OUIGO" | "IRYO";
  product: string;
  number: string;
  departure: string;
  arrival: string;
  durationLabel: string;
  origin: string;
  destination: string;
};

type Snapshot = {
  generatedAt: string;
  horizonDays: number;
  stops: Record<string, string>;
  trips: Array<{
    id: string;
    number: string;
    product: string;
    terminalId: string;
    dates: string[];
    stops: Array<{ id: string; seq: number; arr: string; dep: string }>;
  }>;
};

const STATION_NAME_MATCHERS: Record<string, RegExp[]> = {
  "MAD-VLL":  [/villena/i],
  "MAD-ALB":  [/albacete/i],
  "MAD-CUE":  [/cuenca/i],
  "MAD-CR":   [/ciudad\s*real/i],
  "MAD-PTL":  [/puertollano/i],
  "MAD-CHA":  [/chamart/i],
  "MED-VLCJ": [/sorolla/i],
  "MED-VLCN": [/val[èe]ncia.*nord|valencia.*nord/i],
  "MED-XAT":  [/x[àa]tiva|j[áa]tiva/i],
  "MED-CAS":  [/castell[óo]/i],
  "MED-TARC": [/camp\s*de\s*tarragona/i],
  "MED-TAR":  [/^tarragona$/i],
  "MED-BCN":  [/barcelona.*sants|^barcelona$/i],
  "NOR-ZAZ":  [/zaragoza/i],
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
  "MUR-SGA":  [/sant\s*gabriel|san\s*gabriel/i],
  "MUR-TOR":  [/torrellano/i],
  "MUR-EPA":  [/elx.*parc|elche.*parque/i],
  "MUR-ECA":  [/elx.*carr[úu]s|elche.*carr[úu]s/i],
  "MUR-CRE":  [/crevillent/i],
  "MUR-ALB":  [/albatera|catral/i],
  "MUR-CAL":  [/callosa.*segura|cox/i],
  "MUR-ORI":  [/orihuela/i],
  "MUR-BEN":  [/beniel/i],
  "MUR-MUR":  [/murcia.*carmen|^murcia$/i],
  "CTG-MUR":  [/murcia.*carmen|^murcia$/i],
  "CTG-BAL":  [/balsicas|mar\s*menor/i],
  "CTG-TPA":  [/torre.*pacheco/i],
  "CTG-CTG":  [/cartagena/i],
  "LOR-MUR":  [/murcia.*carmen|^murcia$/i],
  "LOR-ALC":  [/alcantarilla/i],
  "LOR-LIB":  [/librilla/i],
  "LOR-ALH":  [/alhama/i],
  "LOR-TOT":  [/totana/i],
  "LOR-LOR":  [/lorca/i],
  "UNI-UNI":  [/universidad.*alicante|universitat/i],
  "UNI-SVI":  [/sant\s*vicent.*centre|san\s*vicente.*centro/i],
};

let snapshotCache: Promise<Snapshot | null> | null = null;
function loadSnapshot(): Promise<Snapshot | null> {
  if (!snapshotCache) {
    snapshotCache = fetch("/data/alicante_snapshot.json", { cache: "force-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<Snapshot>) : null))
      .catch(() => null);
  }
  return snapshotCache;
}

function hhmm(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}
function diffMinutes(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  let d = bh * 60 + bm - (ah * 60 + am);
  if (d < 0) d += 1440;
  return d;
}

export async function getStationSchedule(
  stationCode: string,
  direction: "S" | "L",
): Promise<{ trips: StationTrip[]; generatedAt: string | null }> {
  const out: StationTrip[] = [];
  const snap = await loadSnapshot();

  if (snap) {
    const matchers = STATION_NAME_MATCHERS[stationCode] || [];
    const targetIds = new Set<string>();
    for (const [sid, name] of Object.entries(snap.stops)) {
      if (matchers.some((re) => re.test(name))) targetIds.add(sid);
    }

    for (const trip of snap.trips) {
      const sts = trip.stops;
      const idxA = sts.findIndex((s) => s.id === trip.terminalId);
      if (idxA < 0) continue;
      let idxT = -1;
      for (let i = 0; i < sts.length; i++) {
        if (targetIds.has(sts[i].id)) { idxT = i; break; }
      }
      if (idxT < 0) continue;
      if (direction === "S" && idxT <= idxA) continue;
      if (direction === "L" && idxT >= idxA) continue;

      const from = direction === "S" ? sts[idxA] : sts[idxT];
      const to   = direction === "S" ? sts[idxT] : sts[idxA];
      const dep = hhmm(from.dep || from.arr);
      const arr = hhmm(to.arr || to.dep);
      const dur = diffMinutes(from.dep || from.arr, to.arr || to.dep);
      const operator: "AVLO" | "RENFE" = trip.product === "AVLO" ? "AVLO" : "RENFE";

      for (const date of trip.dates) {
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

  // OUIGO / IRYO fijos
  if (FIXED_CORRIDOR_STATIONS.has(stationCode)) {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const days: string[] = [];
    for (let d = 0; d < 30; d++) {
      const x = new Date(today); x.setUTCDate(x.getUTCDate() + d);
      days.push(
        `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`,
      );
    }
    for (const ft of FIXED_TRIPS) {
      if (ft.direction !== direction) continue;
      let originHHMM: string;
      let arrivalHHMM: string;
      if (stationCode === "MAD-CHA") {
        originHHMM = ft.depart;
        arrivalHHMM = addMinutes(ft.depart, ft.durationMin);
      } else {
        const off = ft.intermediateOffsets[stationCode];
        if (off == null) continue;
        if (direction === "S") {
          originHHMM = ft.depart;
          arrivalHHMM = addMinutes(ft.depart, off);
        } else {
          originHHMM = addMinutes(ft.depart, off);
          arrivalHHMM = addMinutes(ft.depart, ft.durationMin);
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

  const dedup = new Map<string, StationTrip>();
  for (const t of out) dedup.set(t.id, t);
  const list = [...dedup.values()].sort((a, b) =>
    a.date === b.date ? a.departure.localeCompare(b.departure) : a.date.localeCompare(b.date),
  );

  return { trips: list, generatedAt: snap?.generatedAt ?? null };
}
