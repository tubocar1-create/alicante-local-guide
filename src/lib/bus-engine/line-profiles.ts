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

const PROFILES: Record<string, LineOperationalProfile> = {
  "12": {
    lineCode: "12",
    // Flota fija conforme al cronograma oficial: 4 buses girando en carrusel
    // durante toda la ventana de servicio diurno.
    baseBuses: 4,
    maxBuses: 4,
    serviceStartHHMM: "07:00",
    eveningCutoffHHMM: "22:00",
    lastServiceHHMM: "22:30",
    extras: [],
  },
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
export function applyProfileFleetTarget(opts: {
  lineCode: string;
  inferred: number;
  activationScore: number; // 0..1
  at?: Date;
}): {
  target: number;
  min: number;
  max: number;
  window: FleetWindow | "no_profile";
  reason: string;
} {
  const profile = getLineProfile(opts.lineCode);
  if (!profile) {
    return {
      target: opts.inferred,
      min: 0,
      max: opts.inferred + 1,
      window: "no_profile",
      reason: "no_profile",
    };
  }
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
