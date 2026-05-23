import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bus, XCircle, Car, Info, Heart } from "lucide-react";

export const Route = createFileRoute("/rent-a-car-comparador")({
  head: () => ({
    meta: [
      { title: "Comparador Rent a Car Alicante (ALC) — 15 operadoras" },
      {
        name: "description",
        content:
          "Compara operadoras de alquiler de coches en el aeropuerto de Alicante-Elche: shuttle, horarios, precios, seguro, franquicia y tipo de vehículos.",
      },
    ],
  }),
  component: ComparadorPage,
});

type PriceTier = "BAJO" | "BAJO-MEDIO" | "MEDIO" | "MEDIO-ALTO" | "ALTO";

type Operator = {
  id: string;
  name: string;
  airport: string;
  shuttle: { kind: "shuttle" | "terminal" };
  hours: string;
  price: PriceTier;
  insurance: "Sí" | "No" | "Opcional";
  franchise: "Sí" | "No" | "Opcional";
  vehicles: number; // # iconos
  total: number; // €
};

const OPERATORS: Operator[] = [
  { id: "record",   name: "Record Go",   airport: "ALC", shuttle: { kind: "shuttle"  }, hours: "07:00 – 23:00", price: "BAJO",       insurance: "Sí", franchise: "Sí",       vehicles: 2, total: 126.45 },
  { id: "centauro", name: "Centauro",    airport: "ALC", shuttle: { kind: "shuttle"  }, hours: "07:00 – 23:00", price: "BAJO-MEDIO", insurance: "Sí", franchise: "Sí",       vehicles: 3, total: 132.10 },
  { id: "goldcar",  name: "Goldcar",     airport: "ALC", shuttle: { kind: "shuttle"  }, hours: "07:30 – 23:00", price: "BAJO",       insurance: "Sí", franchise: "Sí",       vehicles: 2, total: 108.20 },
  { id: "sixt",     name: "Sixt",        airport: "ALC", shuttle: { kind: "terminal" }, hours: "08:00 – 00:30", price: "ALTO",       insurance: "Sí", franchise: "Opcional", vehicles: 3, total: 178.55 },
  { id: "wiber",    name: "Wiber",       airport: "ALC", shuttle: { kind: "shuttle"  }, hours: "07:00 – 23:00", price: "BAJO-MEDIO", insurance: "Sí", franchise: "Sí",       vehicles: 2, total: 117.30 },
  { id: "ok",       name: "OK Mobility", airport: "ALC", shuttle: { kind: "shuttle"  }, hours: "07:00 – 23:00", price: "MEDIO",      insurance: "Sí", franchise: "Opcional", vehicles: 3, total: 122.56 },
  { id: "hertz",    name: "Hertz",       airport: "ALC", shuttle: { kind: "terminal" }, hours: "08:00 – 00:00", price: "ALTO",       insurance: "Sí", franchise: "Sí",       vehicles: 3, total: 189.90 },
  { id: "europcar", name: "Europcar",    airport: "ALC", shuttle: { kind: "terminal" }, hours: "07:30 – 00:00", price: "MEDIO-ALTO", insurance: "Sí", franchise: "Sí",       vehicles: 3, total: 164.75 },
];

const PRICE_STYLES: Record<PriceTier, string> = {
  "BAJO":       "bg-emerald-100 text-emerald-700",
  "BAJO-MEDIO": "bg-emerald-50 text-emerald-700",
  "MEDIO":      "bg-amber-100 text-amber-700",
  "MEDIO-ALTO": "bg-orange-100 text-orange-700",
  "ALTO":       "bg-rose-100 text-rose-700",
};

function ShuttleCell({ kind }: { kind: Operator["shuttle"]["kind"] }) {
  if (kind === "shuttle") {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600">
        <Bus className="h-4 w-4" />
        <span className="text-sm font-medium">Sí</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-rose-500">
        <XCircle className="h-4 w-4" />
        <span className="text-sm font-medium">No</span>
      </div>
      <span className="text-[11px] text-muted-foreground">(Terminal)</span>
    </div>
  );
}

function VehicleIcons({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1 text-foreground/70">
      {Array.from({ length: count }).map((_, i) => (
        <Car key={i} className="h-4 w-4" />
      ))}
    </div>
  );
}

function ComparadorPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/rent-a-car"
              className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
                <Car className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-base font-bold text-slate-900">RentCompare</p>
                <p className="text-[11px] text-slate-500">Alicante</p>
              </div>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
            <span className="border-b-2 border-blue-600 pb-1 text-blue-600">Comparar</span>
            <span>Guía Alicante</span>
            <span>Consejos</span>
            <span>Opiniones</span>
            <span>Ofertas</span>
          </nav>
          <button className="hidden items-center gap-1.5 text-sm text-slate-600 md:flex">
            <Heart className="h-4 w-4" /> Favoritos
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {/* Search summary */}
        <section className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Field label="RECOGIDA" value="Alicante Aeropuerto (ALC)" />
          <Field label="DEVOLUCIÓN" value="Alicante Aeropuerto (ALC)" />
          <Field label="FECHAS" value="10 Jun 2026 – 17 Jun 2026" sub="7 días" />
          <Field label="CONDUCTOR" value="30–65 años" />
          <button className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Modificar búsqueda
          </button>
        </section>

        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
            {OPERATORS.length} proveedores encontrados
            <Info className="h-4 w-4 text-slate-400" />
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Ordenar por:</span>
            <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
              <option>Mejor puntuación</option>
              <option>Precio (asc)</option>
              <option>Precio (desc)</option>
              <option>Shuttle más rápido</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <Th sticky>Operadora</Th>
                <Th>Aeropuerto</Th>
                <Th>Shuttle</Th>
                <Th>Horarios</Th>
                <Th>Rango de precios</Th>
                <Th>Seguro todo riesgo</Th>
                <Th>Franquicia</Th>
                <Th>Tipo de vehículos</Th>
                <Th className="text-right">
                  Precio total
                  <div className="text-[10px] font-normal normal-case text-slate-400">7 días</div>
                </Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {OPERATORS.map((op) => (
                <tr key={op.id} className="group">
                  <Td sticky>
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-20 shrink-0 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] font-medium uppercase text-slate-400">
                        logo
                      </div>
                      <span className="font-semibold text-slate-800">{op.name}</span>
                    </div>
                  </Td>
                  <Td className="text-slate-700">{op.airport}</Td>
                  <Td><ShuttleCell kind={op.shuttle.kind} /></Td>
                  <Td className="text-slate-700">{op.hours}</Td>
                  <Td>
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${PRICE_STYLES[op.price]}`}>
                      {op.price}
                    </span>
                  </Td>
                  <Td className="text-slate-700">{op.insurance}</Td>
                  <Td className="text-slate-700">{op.franchise}</Td>
                  <Td><VehicleIcons count={op.vehicles} /></Td>
                  <Td className="text-right font-semibold text-emerald-600">
                    € {op.total.toFixed(2).replace(".", ",")}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                        Ver oferta
                      </button>
                      <button className="text-slate-300 hover:text-rose-500" aria-label="Favorito">
                        <Heart className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-center">
          <button className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-blue-600 shadow-sm hover:bg-slate-50">
            Cargar más resultados ⌄
          </button>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          Precios actualizados hoy a las 09:30 <Info className="h-3 w-3" />
        </p>
      </main>
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[160px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      <button className="text-xs text-blue-600 hover:underline">Cambiar</button>
    </div>
  );
}

function Th({
  children,
  className = "",
  sticky = false,
}: {
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  const stickyCls = sticky
    ? "sticky left-0 z-10 bg-slate-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
    : "bg-slate-50/60";
  return (
    <th className={`border-b border-slate-200 px-4 py-3 font-semibold ${stickyCls} ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  sticky = false,
}: {
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  const stickyCls = sticky
    ? "sticky left-0 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] group-hover:bg-slate-50"
    : "group-hover:bg-slate-50/50";
  return (
    <td className={`border-b border-slate-100 px-4 py-3 align-middle ${stickyCls} ${className}`}>
      {children}
    </td>
  );
}

