// CAROUSEL ENGINE
//
// Modelo humano de una línea de bus:
//   - Una línea = un carrusel circular con N actores (buses).
//   - Dos terminales (IDA y VUELTA). Cada terminal tiene sus salidas oficiales.
//   - Los buses se incorporan en el ramp-up matinal hasta llegar a N.
//   - Cada bus, al llegar a una terminal, ESPERA OBLIGATORIAMENTE a la próxima
//     salida oficial de ESA terminal antes de volver a salir.
//   - Nadie adelanta. Nadie se inventa. Las salidas oficiales son la verdad.
//
// La simulación es event-driven: recorremos en orden temporal todas las salidas
// oficiales del día. En cada evento, asignamos la salida al bus disponible más
// veterano en esa terminal; si no hay ninguno y todavía no se alcanzó la flota
// objetivo, nace un bus nuevo en ese instante.
//
// Esto produce, por construcción:
//   - Anclaje 100% a horarios oficiales.
//   - Cero solapamiento / cero adelantamientos.
//   - Espacios coherentes entre buses.
//   - Ramp-up matinal natural.

import type { Direction } from "./types";
import type { LineFleetPlan } from "./fleet";

export type CarouselTrip = {
  busId: string;
  direction: Direction;
  departureMin: number;
  arrivalMin: number;
};

export type CarouselBus = {
  busId: string;
  trips: CarouselTrip[];
};

export type CarouselSimulation = {
  buses: CarouselBus[];
  idaTotalMin: number;
  vueltaTotalMin: number;
};

export function simulateCarousel(
  plan: LineFleetPlan,
  nowMin: number,
  horizonMin: number,
): CarouselSimulation {
  const idaTotal = plan.dirIda?.totalMin ?? 0;
  const vueltaTotal = plan.dirVuelta?.totalMin ?? 0;
  const N = Math.max(
    1,
    plan.fleetSizeExpected || plan.fleetSizeInferred || 1,
  );

  const events: Array<{ t: number; dir: Direction }> = [];
  for (const t of plan.officialDeparturesByDirection[1]) events.push({ t, dir: 1 });
  for (const t of plan.officialDeparturesByDirection[2]) events.push({ t, dir: 2 });
  events.sort((a, b) => a.t - b.t || a.dir - b.dir);

  type SimBus = {
    busId: string;
    availableAt: number;
    atTerminalForDir: Direction;
    trips: CarouselTrip[];
  };
  const buses: SimBus[] = [];
  let nextBusId = 1;

  const horizonEnd = nowMin + horizonMin;

  for (const ev of events) {
    if (ev.t > horizonEnd + 5) break;

    const candidates = buses
      .filter((b) => b.atTerminalForDir === ev.dir && b.availableAt <= ev.t)
      .sort((a, b) => a.availableAt - b.availableAt);

    let bus: SimBus | undefined = candidates[0];

    if (!bus && buses.length < N) {
      bus = {
        busId: `${plan.lineCode}_B${String(nextBusId++).padStart(2, "0")}`,
        availableAt: ev.t,
        atTerminalForDir: ev.dir,
        trips: [],
      };
      buses.push(bus);
    }

    if (!bus) continue;

    const dur = ev.dir === 1 ? idaTotal : vueltaTotal;
    if (dur <= 0) continue;
    const trip: CarouselTrip = {
      busId: bus.busId,
      direction: ev.dir,
      departureMin: ev.t,
      arrivalMin: ev.t + dur,
    };
    bus.trips.push(trip);
    bus.availableAt = trip.arrivalMin;
    bus.atTerminalForDir = ev.dir === 1 ? 2 : 1;
  }

  return {
    buses: buses.map((b) => ({ busId: b.busId, trips: b.trips })),
    idaTotalMin: idaTotal,
    vueltaTotalMin: vueltaTotal,
  };
}
