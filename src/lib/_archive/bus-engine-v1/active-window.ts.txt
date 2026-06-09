// Ventana de servicio activa de un bus virtual.
//
// REGLA FUNDAMENTAL:
//   Un bus virtual SOLO puede existir si:
//     departure_time <= now <= departure_time + cycle_min + grace
//
// Prohibido:
//   - proyectar buses futuros como activos
//   - mantener buses cuyo ciclo ya cerró
//
// El cierre de ciclo es DURO: el bus se archiva, nunca se reutiliza.
// El siguiente ciclo nace siempre de la siguiente salida oficial.

const ACTIVE_GRACE_MIN = 2; // tolerancia operativa al cierre de ciclo
const FUTURE_INMINENT_MIN = 1.5; // un origen futuro inminente puede mostrarse

export type ActiveWindowStatus = "future" | "imminent" | "active" | "expired";

export function classifyDepartureWindow(opts: {
  departureMin: number;
  nowMin: number;
  cycleMin: number;
}): ActiveWindowStatus {
  const elapsed = opts.nowMin - opts.departureMin;
  if (elapsed < -FUTURE_INMINENT_MIN) return "future";
  if (elapsed < 0) return "imminent";
  if (elapsed <= opts.cycleMin + ACTIVE_GRACE_MIN) return "active";
  return "expired";
}

export function isWithinActiveServiceWindow(opts: {
  departureMin: number;
  nowMin: number;
  cycleMin: number;
}): boolean {
  const w = classifyDepartureWindow(opts);
  return w === "active" || w === "imminent";
}
