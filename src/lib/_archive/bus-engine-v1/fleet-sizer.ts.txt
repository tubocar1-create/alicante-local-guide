// Tamaño de flota real:  fleet_size = ceil(cycle_time / active_headway)
// Tope físico: nunca generamos más de fleet_size + 1 (tolerancia operativa).

export function computeFleetSize(cycleMin: number, headwayMin: number): number {
  if (!Number.isFinite(cycleMin) || !Number.isFinite(headwayMin)) return 0;
  if (cycleMin <= 0 || headwayMin <= 0) return 0;
  return Math.max(1, Math.ceil(cycleMin / headwayMin));
}

export function fleetSizeCap(cycleMin: number, headwayMin: number): number {
  return computeFleetSize(cycleMin, headwayMin) + 1;
}
