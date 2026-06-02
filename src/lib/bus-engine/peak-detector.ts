// Clasificación de franja horaria. Pure function, sin red.
// Determinístico para que cliente y servidor coincidan.

export type TimeProfile =
  | "morning_peak"
  | "midday"
  | "afternoon_peak"
  | "evening"
  | "night"
  | "weekend"
  | "holiday";

// Festivos hardcoded (España + locales Alicante). Ampliable.
const HOLIDAYS_MMDD = new Set([
  "01-01", "01-06", "05-01", "06-24", "08-15",
  "10-09", "10-12", "11-01", "12-06", "12-08", "12-25",
]);

export function dayType(d: Date): "laborable" | "sabado" | "domingo" | "festivo" {
  const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (HOLIDAYS_MMDD.has(mmdd)) return "festivo";
  const dow = d.getDay();
  if (dow === 0) return "domingo";
  if (dow === 6) return "sabado";
  return "laborable";
}

export function detectProfile(d: Date): TimeProfile {
  const dt = dayType(d);
  if (dt === "festivo") return "holiday";
  if (dt === "sabado" || dt === "domingo") return "weekend";
  const h = d.getHours();
  if (h >= 7 && h < 10) return "morning_peak";
  if (h >= 10 && h < 13) return "midday";
  if (h >= 13 && h < 16) return "afternoon_peak";
  if (h >= 16 && h < 20) return "evening";
  return "night";
}

// Multiplicadores de tiempo segmento según perfil.
// Hora pico => más lento; noche => más rápido.
export function profileSpeedFactor(p: TimeProfile): number {
  switch (p) {
    case "morning_peak": return 1.25;
    case "afternoon_peak": return 1.25;
    case "midday": return 1.05;
    case "evening": return 1.10;
    case "weekend": return 0.95;
    case "holiday": return 0.90;
    case "night": return 0.70;
  }
}
