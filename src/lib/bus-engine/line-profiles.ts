// Perfiles operacionales por línea. Capturan reglas humanas que tienen
// PRIORIDAD ABSOLUTA sobre cualquier inferencia matemática:
//   - flota base mínima durante operación diurna,
//   - flota máxima en hora punta,
//   - incorporación progresiva de buses adicionales,
//   - desincorporación nocturna,
//   - hora de último servicio.
//
// Si una línea no tiene perfil, el motor cae al cálculo puro (ceil cycle/headway).

export type LineOperationalProfile = {
  lineCode: string;
  // Flota base permanente durante la ventana diurna [serviceStart, eveningCutoff)
  baseBuses: number;
  // Tope absoluto de buses simultáneos en cualquier momento del día
  maxBuses: number;
  // Inicio de operación (hora local Madrid)
  serviceStartHHMM: string; // "07:00"
  // A esta hora se aplica la flota nocturna reducida (= baseBuses)
  eveningCutoffHHMM: string; // "22:00"
  // Última salida válida. Después de esta hora no se incorporan buses.
  lastServiceHHMM: string; // "22:30"
  // Activación de buses adicionales (sobre la base). Cada entrada:
  //   prioridad media (bus 3) / alta (bus 4)
  // El motor decide cuántos extra activar según activation_score.
  extras: Array<{
    label: string;
    priority: "medium" | "high";
    minScoreToActivate: number;
  }>;
};

// Topes operacionales por línea = "buses pico" calculados a partir de
// ciclo / headway en hora punta. La línea 12 es el único dato REAL conocido
// (4 buses confirmados por cronograma oficial); el resto son inferidos.
//
// Política de incorporación: GRADUAL. baseBuses = 1 para que la flota nazca
// progresivamente — cada salida oficial cuyo terminal esté libre incorpora
// un bus nuevo, hasta llegar al tope `maxBuses`. El cap duro se aplica en
// fleet.ts (fleetSizeMax).
function peakProfile(lineCode: string, peak: number): LineOperationalProfile {
  return {
    lineCode,
    baseBuses: 1,
    maxBuses: peak,
    serviceStartHHMM: "06:00",
    eveningCutoffHHMM: "22:00",
    lastServiceHHMM: "22:30",
    extras: [],
  };
}

const PROFILES: Record<string, LineOperationalProfile> = {
  // Diurnas: tope = buses pico inferidos
  "1":  peakProfile("1", 9),
  "2":  peakProfile("2", 7),
  "3":  peakProfile("3", 7),
  "4":  peakProfile("4", 7),
  "5":  peakProfile("5", 5),
  "6":  peakProfile("6", 7),
  "7":  peakProfile("7", 2),
  "8A": peakProfile("8A", 4),
  "9":  peakProfile("9", 4),
  // L12: dato REAL confirmado, 4 buses en carrusel
  "12": {
    lineCode: "12",
    baseBuses: 4,
    maxBuses: 4,
    serviceStartHHMM: "07:00",
    eveningCutoffHHMM: "22:00",
    lastServiceHHMM: "22:30",
    extras: [],
  },
  "13": peakProfile("13", 4),
  "14": peakProfile("14", 3),
  "22": peakProfile("22", 8),
  "24": peakProfile("24", 4),
  "27": peakProfile("27", 5),
  "28": peakProfile("28", 3),
  "39": peakProfile("39", 2),
  // Nocturnas: 1 bus por línea
  "3N":  peakProfile("3N", 1),
  "13N": peakProfile("13N", 1),
  "22N": peakProfile("22N", 1),
};

export function getLineProfile(lineCode: string): LineOperationalProfile | null {
  return PROFILES[lineCode] ?? null;
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export type FleetWindow =
  | "before_service"
  | "daytime"
  | "evening_reduced"
  | "after_last_service";

export function classifyWindow(
  profile: LineOperationalProfile,
  at: Date = new Date(),
): FleetWindow {
  const m = at.getHours() * 60 + at.getMinutes();
  if (m < hhmmToMinutes(profile.serviceStartHHMM)) return "before_service";
  if (m >= hhmmToMinutes(profile.lastServiceHHMM)) return "after_last_service";
  if (m >= hhmmToMinutes(profile.eveningCutoffHHMM)) return "evening_reduced";
  return "daytime";
}

// Devuelve el target de flota tras aplicar el perfil. Si no hay perfil,
// retorna `inferred` sin tocar nada.
//
// `serviceStartHHMM` se pasa por línea desde el horario REAL (primera salida
// del día). El cierre es fijo: último bus sale a las 22:30 de su base.
export function applyProfileFleetTarget(opts: {
  lineCode: string;
  inferred: number;
  activationScore: number; // 0..1
  at?: Date;
  serviceStartHHMM?: string; // override desde primera salida real
  lastServiceHHMM?: string;  // override (por defecto 22:30)
}): {
  target: number;
  min: number;
  max: number;
  window: FleetWindow | "no_profile";
  reason: string;
} {
  // PERFIL POR DEFECTO: 4 buses virtuales simultáneos. Ventana derivada del
  // horario real de la línea (primera salida del día). Cierre fijo 22:30.
  const explicit = getLineProfile(opts.lineCode);
  const profile: LineOperationalProfile = {
    lineCode: opts.lineCode,
    baseBuses: explicit?.baseBuses ?? 4,
    maxBuses: explicit?.maxBuses ?? 4,
    serviceStartHHMM: opts.serviceStartHHMM ?? explicit?.serviceStartHHMM ?? "06:00",
    eveningCutoffHHMM: explicit?.eveningCutoffHHMM ?? "22:00",
    lastServiceHHMM: opts.lastServiceHHMM ?? explicit?.lastServiceHHMM ?? "22:30",
    extras: explicit?.extras ?? [],
  };
  const window = classifyWindow(profile, opts.at ?? new Date());

  if (window === "before_service") {
    return { target: 0, min: 0, max: 0, window, reason: "before_service" };
  }
  if (window === "after_last_service") {
    return { target: 0, min: 0, max: 0, window, reason: "after_last_service" };
  }
  if (window === "evening_reduced") {
    return {
      target: profile.baseBuses,
      min: profile.baseBuses,
      max: profile.baseBuses,
      window,
      reason: "evening_cutoff",
    };
  }
  // daytime: base + extras según score.
  let extra = 0;
  for (const ex of profile.extras) {
    if (opts.activationScore >= ex.minScoreToActivate) extra++;
  }
  const target = Math.min(profile.maxBuses, profile.baseBuses + extra);
  return {
    target,
    min: profile.baseBuses,
    max: profile.maxBuses,
    window,
    reason: extra > 0 ? `daytime+${extra}_extra` : "daytime_base",
  };
}
