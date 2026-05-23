import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bus, XCircle, Car, Info, Heart, Check } from "lucide-react";

export const Route = createFileRoute("/rent-a-car-comparador")({
  head: () => ({
    meta: [
      { title: "Comparador Rent a Car Alicante (ALC) — 20 operadoras" },
      {
        name: "description",
        content:
          "Compara 20 operadoras de alquiler de coches y furgonetas en Alicante: shuttle, horarios, precios, seguro, franquicia, flota, transparencia y riesgo.",
      },
    ],
  }),
  component: ComparadorPage,
});

type Level =
  | "Muy bajo"
  | "Bajo"
  | "Medio-bajo"
  | "Medio"
  | "Medio-alto"
  | "Alto"
  | "Muy alto"
  | "Baja"
  | "Media-baja"
  | "Media"
  | "Media-alta"
  | "Alta"
  | "Muy alta";

type YesNoOpt = "Sí" | "No" | "Opcional" | "Variable" | "Algunas" | "Limitadas" | "Especialista";

type Operator = {
  id: string;
  name: string;
  domain: string;
  profile: string;
  airport: boolean;
  shuttle: boolean;
  hours: string;
  price: Level;
  insurance: YesNoOpt;
  franchise: YesNoOpt;
  vehicles: string;
  vans: YesNoOpt;
  renting: YesNoOpt;
  waitTime: Level;
  terminalOffice: boolean;
  transparency: Level;
  vehicleState: string;
  incidentRisk: Level;
};

const BRANDFETCH_CLIENT_ID = "5unc4ZkmCB_cM9wUkf4rXax4Iz3YgiZIuVd9IeZJ6lg0gvQhC-nDk2SwM3tACcRQCNRe2XBOd3ruhdgjch1fag";
const logoUrl = (domain: string) =>
  `https://cdn.brandfetch.io/${domain}/w/64/h/64?c=${BRANDFETCH_CLIENT_ID}`;

const OPERATORS: Operator[] = [
  { id: "goldcar",   name: "Goldcar",            domain: "goldcar.es",            profile: "Low cost masivo",         airport: true,  shuttle: true,  hours: "07:30–23:00", price: "Muy bajo",    insurance: "Opcional", franchise: "Sí",       vehicles: "Turismo, SUV",                  vans: "No",           renting: "No", waitTime: "Alto",       terminalOffice: false, transparency: "Media-baja", vehicleState: "Correcto",  incidentRisk: "Alto" },
  { id: "centauro",  name: "Centauro",           domain: "centauro.net",          profile: "Low cost equilibrado",    airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Bajo",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, familiar",        vans: "Algunas",      renting: "No", waitTime: "Medio",      terminalOffice: false, transparency: "Media",      vehicleState: "Bueno",     incidentRisk: "Medio" },
  { id: "record",    name: "Record Go",          domain: "recordrentacar.com",    profile: "Low cost moderno",        airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Bajo",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, híbridos",        vans: "Limitadas",    renting: "No", waitTime: "Medio-bajo", terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "clickrent", name: "ClickRent",          domain: "clickrent.es",          profile: "Low cost agresivo",       airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Muy bajo",    insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV",                  vans: "No",           renting: "No", waitTime: "Medio-alto", terminalOffice: false, transparency: "Media-baja", vehicleState: "Correcto",  incidentRisk: "Medio-alto" },
  { id: "wiber",     name: "Wiber",              domain: "wiber.com",             profile: "Low cost premiumizado",   airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Medio-bajo",  insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV",                  vans: "Algunas",      renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "ok",        name: "OK Mobility",        domain: "okmobility.com",        profile: "Flexible/moderno",        airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Medio",       insurance: "Sí",       franchise: "Opcional", vehicles: "Turismo, SUV, premium",         vans: "Sí",           renting: "Sí", waitTime: "Medio",      terminalOffice: false, transparency: "Media-alta", vehicleState: "Muy bueno", incidentRisk: "Medio" },
  { id: "sixt",      name: "SIXT",               domain: "sixt.com",              profile: "Premium internacional",   airport: true,  shuttle: false, hours: "08:00–00:30", price: "Alto",        insurance: "Sí",       franchise: "Opcional", vehicles: "Premium, SUV, eléctricos",      vans: "Sí",           renting: "Sí", waitTime: "Bajo",       terminalOffice: true,  transparency: "Muy alta",   vehicleState: "Excelente", incidentRisk: "Muy bajo" },
  { id: "hertz",     name: "Hertz",              domain: "hertz.com",             profile: "Premium clásico",         airport: true,  shuttle: false, hours: "08:00–00:00", price: "Alto",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, premium",         vans: "Sí",           renting: "Sí", waitTime: "Medio-bajo", terminalOffice: true,  transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "europcar",  name: "Europcar",           domain: "europcar.com",          profile: "Corporativo",             airport: true,  shuttle: false, hours: "07:30–00:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, furgonetas",      vans: "Sí",           renting: "Sí", waitTime: "Medio",      terminalOffice: true,  transparency: "Alta",       vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "avis",      name: "Avis",               domain: "avis.com",              profile: "Business internacional",  airport: true,  shuttle: false, hours: "08:00–23:45", price: "Alto",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, ejecutivos, SUV",      vans: "Algunas",      renting: "Sí", waitTime: "Bajo",       terminalOffice: true,  transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "enterprise",name: "Enterprise",         domain: "enterprise.com",        profile: "Servicio completo",       airport: true,  shuttle: false, hours: "08:00–22:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, furgonetas",      vans: "Sí",           renting: "Sí", waitTime: "Bajo",       terminalOffice: true,  transparency: "Muy alta",   vehicleState: "Muy bueno", incidentRisk: "Muy bajo" },
  { id: "budget",    name: "Budget",             domain: "budget.com",            profile: "Económico corporativo",   airport: true,  shuttle: false, hours: "08:00–23:00", price: "Medio",       insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, compactos",            vans: "Limitadas",    renting: "No", waitTime: "Medio",      terminalOffice: true,  transparency: "Media",      vehicleState: "Bueno",     incidentRisk: "Medio" },
  { id: "drivalia",  name: "Drivalia",           domain: "drivalia.com",          profile: "Innovador / EV",          airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Medio",       insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, eléctricos, SUV",      vans: "Sí",           renting: "Sí", waitTime: "Medio",      terminalOffice: false, transparency: "Media-alta", vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "firefly",   name: "Firefly",            domain: "fireflycarrental.com",  profile: "Ultra low cost",          airport: true,  shuttle: true,  hours: "08:00–01:00", price: "Muy bajo",    insurance: "Opcional", franchise: "Sí",       vehicles: "Turismo económico",             vans: "No",           renting: "No", waitTime: "Alto",       terminalOffice: false, transparency: "Baja",       vehicleState: "Correcto",  incidentRisk: "Alto" },
  { id: "victoria",  name: "Victoria Cars",      domain: "victoriacars.com",      profile: "Familiar/local",          airport: true,  shuttle: true,  hours: "24h",         price: "Medio",       insurance: "Sí",       franchise: "Opcional", vehicles: "Turismo, monovolumen",          vans: "No",           renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "northgate", name: "Northgate",          domain: "northgate.es",          profile: "Renting profesional",     airport: false, shuttle: false, hours: "08:00–19:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Variable", vehicles: "Industriales, comerciales",     vans: "Especialista", renting: "Sí", waitTime: "Muy bajo",   terminalOffice: false, transparency: "Muy alta",   vehicleState: "Excelente", incidentRisk: "Muy bajo" },
  { id: "telefurgo", name: "TELEFURGO",          domain: "telefurgo.com",         profile: "Comercial/furgo",         airport: false, shuttle: false, hours: "08:00–20:00", price: "Medio",       insurance: "Opcional", franchise: "Sí",       vehicles: "Furgonetas",                    vans: "Especialista", renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "covey",     name: "Covey",              domain: "covey.es",              profile: "Industrial/renting",      airport: false, shuttle: false, hours: "08:00–19:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Furgonetas industriales",       vans: "Especialista", renting: "Sí", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "demetrio",  name: "Furgonetas Demetrio",domain: "furgonetasdemetrio.com",profile: "Local comercial",         airport: false, shuttle: false, hours: "08:00–19:00", price: "Medio",       insurance: "Opcional", franchise: "Sí",       vehicles: "Furgonetas y carga",            vans: "Especialista", renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Media",      vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "primoti",   name: "PRIMOTI",            domain: "primoti.com",           profile: "Industrial/logística",    airport: false, shuttle: false, hours: "08:00–18:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Comerciales e industriales",    vans: "Especialista", renting: "Sí", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
];

const LEVEL_STYLES: Record<string, string> = {
  "Muy bajo":    "bg-emerald-100 text-emerald-700",
  "Bajo":        "bg-emerald-50 text-emerald-700",
  "Medio-bajo":  "bg-lime-100 text-lime-700",
  "Medio":       "bg-amber-100 text-amber-700",
  "Medio-alto":  "bg-orange-100 text-orange-700",
  "Alto":        "bg-rose-100 text-rose-700",
  "Muy alto":    "bg-rose-200 text-rose-800",
  "Baja":        "bg-rose-100 text-rose-700",
  "Media-baja":  "bg-orange-100 text-orange-700",
  "Media":       "bg-amber-100 text-amber-700",
  "Media-alta":  "bg-lime-100 text-lime-700",
  "Alta":        "bg-emerald-50 text-emerald-700",
  "Muy alta":    "bg-emerald-100 text-emerald-700",
};

// For "Precio" higher = worse (red). For transparency/state higher = better (green).
// LEVEL_STYLES already maps both name sets.

const STATE_STYLES: Record<string, string> = {
  "Correcto":  "bg-amber-100 text-amber-700",
  "Bueno":     "bg-lime-100 text-lime-700",
  "Muy bueno": "bg-emerald-100 text-emerald-700",
  "Excelente": "bg-emerald-200 text-emerald-800",
};

function Badge({ value, styles }: { value: string; styles: Record<string, string> }) {
  const cls = styles[value] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {value}
    </span>
  );
}

function YesNo({ value }: { value: YesNoOpt | boolean }) {
  if (value === true) return <Check className="h-4 w-4 text-emerald-600" />;
  if (value === false) return <XCircle className="h-4 w-4 text-rose-400" />;
  const tone =
    value === "Sí"           ? "text-emerald-600" :
    value === "No"           ? "text-rose-500" :
    value === "Especialista" ? "text-blue-600 font-semibold" :
                               "text-amber-600";
  return <span className={`text-xs font-medium ${tone}`}>{value}</span>;
}

function ShuttleCell({ value, terminalOffice }: { value: boolean; terminalOffice: boolean }) {
  if (value) {
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
      {terminalOffice && <span className="text-[11px] text-muted-foreground">(Terminal)</span>}
    </div>
  );
}

function ComparadorPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-slate-50">
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
          <button className="hidden items-center gap-1.5 text-sm text-slate-600 md:flex">
            <Heart className="h-4 w-4" /> Favoritos
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
            {OPERATORS.length} operadoras comparadas
            <Info className="h-4 w-4 text-slate-400" />
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Ordenar por:</span>
            <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
              <option>Mejor puntuación</option>
              <option>Precio (asc)</option>
              <option>Precio (desc)</option>
              <option>Menor tiempo de espera</option>
              <option>Mayor transparencia</option>
            </select>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1800px] border-separate border-spacing-0 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <Th sticky className="px-2 py-2">Operadora</Th>
                <Th>Perfil</Th>
                <Th>Aeropuerto</Th>
                <Th>Shuttle</Th>
                <Th>Horarios</Th>
                <Th>Precio</Th>
                <Th>Seguro todo riesgo</Th>
                <Th>Franquicia</Th>
                <Th>Tipo de vehículos</Th>
                <Th>Furgonetas</Th>
                <Th>Renting/Leasing</Th>
                <Th>Tiempo espera</Th>
                <Th>Oficina terminal</Th>
                <Th>Transparencia</Th>
                <Th>Estado vehículos</Th>
                <Th>Riesgo incidencias</Th>
              </tr>
            </thead>
            <tbody>
              {OPERATORS.map((op) => (
                <tr key={op.id} className="group">
                <Td sticky className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={logoUrl(op.domain)}
                      alt={op.name}
                      width={24}
                      height={24}
                      loading="lazy"
                      className="h-6 w-6 shrink-0 rounded-sm object-contain bg-white"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <span className="whitespace-nowrap text-xs font-semibold text-slate-800">
                      {op.name}
                    </span>
                  </div>
                </Td>
                  <Td className="text-slate-600 text-xs">{op.profile}</Td>
                  <Td><YesNo value={op.airport} /></Td>
                  <Td><ShuttleCell value={op.shuttle} terminalOffice={op.terminalOffice} /></Td>
                  <Td className="text-slate-700 whitespace-nowrap">{op.hours}</Td>
                  <Td><Badge value={op.price} styles={LEVEL_STYLES} /></Td>
                  <Td><YesNo value={op.insurance} /></Td>
                  <Td><YesNo value={op.franchise} /></Td>
                  <Td className="text-slate-700 text-xs">{op.vehicles}</Td>
                  <Td><YesNo value={op.vans} /></Td>
                  <Td><YesNo value={op.renting} /></Td>
                  <Td><Badge value={op.waitTime} styles={LEVEL_STYLES} /></Td>
                  <Td><YesNo value={op.terminalOffice} /></Td>
                  <Td><Badge value={op.transparency} styles={LEVEL_STYLES} /></Td>
                  <Td><Badge value={op.vehicleState} styles={STATE_STYLES} /></Td>
                  <Td><Badge value={op.incidentRisk} styles={LEVEL_STYLES} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          Datos orientativos. Desliza horizontalmente para ver todas las columnas <Info className="h-3 w-3" />
        </p>
      </main>
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
    <th className={`border-b border-slate-200 px-3 py-3 font-semibold whitespace-nowrap ${stickyCls} ${className}`}>
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
    <td className={`border-b border-slate-100 px-3 py-3 align-middle ${stickyCls} ${className}`}>
      {children}
    </td>
  );
}
