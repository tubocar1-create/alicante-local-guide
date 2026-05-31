// Reglas fijas recurrentes para OUIGO e IRYO.
// Solo corredor Madrid (Alicante-Terminal ⇄ Madrid Chamartín).
// Etiquetadas como OUIGO / IRYO. Sin scraping, sin API externa.

export type FixedTrip = {
  operator: "OUIGO" | "IRYO";
  product: "OUIGO" | "IRYO";
  number: string;          // identificador comercial estable
  direction: "S" | "L";    // S = Alicante→Madrid, L = Madrid→Alicante
  depart: string;          // HH:MM en estación de origen
  durationMin: number;     // tiempo total aprox
  // Estaciones intermedias con offset minutos desde la salida (en sentido S)
  // Si en sentido L, se aplica desde Madrid (orden inverso).
  // station code -> minuto offset desde la salida de origen
  intermediateOffsets: Record<string, number>;
};

// Tiempos provisionales de paradas intermedias.
// Solo Albacete y Cuenca según operadores indicados; otras estaciones
// (Villena, Ciudad Real, Puertollano) NO son servidas por OUIGO/IRYO.
const OUIGO_DURATION = 145; // ~2h25
const IRYO_DURATION = 142;

const OUIGO_STOPS_S = { // ALC → CHA (offsets desde 00:00 hh:mm salida ALC)
  "MAD-ALB": 55,
  "MAD-CUE": 95,
};
const OUIGO_STOPS_L = { // CHA → ALC
  "MAD-CUE": 50,
  "MAD-ALB": 90,
};
const IRYO_STOPS_S = {
  "MAD-ALB": 53,
  "MAD-CUE": 92,
};
const IRYO_STOPS_L = {
  "MAD-CUE": 50,
  "MAD-ALB": 89,
};

export const FIXED_TRIPS: FixedTrip[] = [
  // ===== OUIGO =====
  { operator: "OUIGO", product: "OUIGO", number: "OG7551", direction: "S", depart: "07:51", durationMin: OUIGO_DURATION, intermediateOffsets: OUIGO_STOPS_S },
  { operator: "OUIGO", product: "OUIGO", number: "OG7800", direction: "S", depart: "18:00", durationMin: OUIGO_DURATION, intermediateOffsets: OUIGO_STOPS_S },
  { operator: "OUIGO", product: "OUIGO", number: "OG7058", direction: "S", depart: "20:58", durationMin: OUIGO_DURATION, intermediateOffsets: OUIGO_STOPS_S },
  { operator: "OUIGO", product: "OUIGO", number: "OG7015", direction: "L", depart: "10:15", durationMin: OUIGO_DURATION, intermediateOffsets: OUIGO_STOPS_L },
  { operator: "OUIGO", product: "OUIGO", number: "OG7415", direction: "L", depart: "14:15", durationMin: OUIGO_DURATION, intermediateOffsets: OUIGO_STOPS_L },
  { operator: "OUIGO", product: "OUIGO", number: "OG7815", direction: "L", depart: "18:15", durationMin: OUIGO_DURATION, intermediateOffsets: OUIGO_STOPS_L },

  // ===== IRYO =====
  { operator: "IRYO", product: "IRYO", number: "IR1228", direction: "S", depart: "12:28", durationMin: IRYO_DURATION, intermediateOffsets: IRYO_STOPS_S },
  { operator: "IRYO", product: "IRYO", number: "IR1858", direction: "S", depart: "18:58", durationMin: IRYO_DURATION, intermediateOffsets: IRYO_STOPS_S },
  { operator: "IRYO", product: "IRYO", number: "IR0745", direction: "L", depart: "07:45", durationMin: IRYO_DURATION, intermediateOffsets: IRYO_STOPS_L },
  { operator: "IRYO", product: "IRYO", number: "IR1545", direction: "L", depart: "15:45", durationMin: IRYO_DURATION, intermediateOffsets: IRYO_STOPS_L },
];

// Códigos del corredor Madrid (mismos que en src/routes/trenes.tsx STATIONS).
// Solo Madrid Chamartín como destino final + intermedias soportadas.
export const FIXED_CORRIDOR_STATIONS = new Set([
  "MAD-CHA", "MAD-ALB", "MAD-CUE",
  // No: MAD-VLL, MAD-CR, MAD-PTL (no servidas por OUIGO/IRYO).
]);

export function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + min + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
