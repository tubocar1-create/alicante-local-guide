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
  url: string;
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

// Logo desde el favicon oficial de cada web (scraping vía Google S2).
const logoUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const OPERATORS: Operator[] = [
  { id: "goldcar",   name: "Goldcar",            domain: "goldcar.es",            url: "https://www.goldcar.es",            profile: "Low cost masivo",         airport: true,  shuttle: true,  hours: "07:30–23:00", price: "Muy bajo",    insurance: "Opcional", franchise: "Sí",       vehicles: "Turismo, SUV",                  vans: "No",           renting: "No", waitTime: "Alto",       terminalOffice: false, transparency: "Media-baja", vehicleState: "Correcto",  incidentRisk: "Alto" },
  { id: "centauro",  name: "Centauro",           domain: "centauro.net",          url: "https://www.centauro.net",          profile: "Low cost equilibrado",    airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Bajo",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, familiar",        vans: "Algunas",      renting: "No", waitTime: "Medio",      terminalOffice: false, transparency: "Media",      vehicleState: "Bueno",     incidentRisk: "Medio" },
  { id: "record",    name: "Record Go",          domain: "recordrentacar.com",    url: "https://www.recordrentacar.com",    profile: "Low cost moderno",        airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Bajo",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, híbridos",        vans: "Limitadas",    renting: "No", waitTime: "Medio-bajo", terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "clickrent", name: "ClickRent",          domain: "clickrent.es",          url: "https://www.clickrent.es",          profile: "Low cost agresivo",       airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Muy bajo",    insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV",                  vans: "No",           renting: "No", waitTime: "Medio-alto", terminalOffice: false, transparency: "Media-baja", vehicleState: "Correcto",  incidentRisk: "Medio-alto" },
  { id: "wiber",     name: "Wiber",              domain: "wiber.com",             url: "https://www.wiber.com",             profile: "Low cost premiumizado",   airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Medio-bajo",  insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV",                  vans: "Algunas",      renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "ok",        name: "OK Mobility",        domain: "okmobility.com",        url: "https://www.okmobility.com",        profile: "Flexible/moderno",        airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Medio",       insurance: "Sí",       franchise: "Opcional", vehicles: "Turismo, SUV, premium",         vans: "Sí",           renting: "Sí", waitTime: "Medio",      terminalOffice: false, transparency: "Media-alta", vehicleState: "Muy bueno", incidentRisk: "Medio" },
  { id: "sixt",      name: "SIXT",               domain: "sixt.com",              url: "https://www.sixt.com",              profile: "Premium internacional",   airport: true,  shuttle: false, hours: "08:00–00:30", price: "Alto",        insurance: "Sí",       franchise: "Opcional", vehicles: "Premium, SUV, eléctricos",      vans: "Sí",           renting: "Sí", waitTime: "Bajo",       terminalOffice: true,  transparency: "Muy alta",   vehicleState: "Excelente", incidentRisk: "Muy bajo" },
  { id: "hertz",     name: "Hertz",              domain: "hertz.com",             url: "https://www.hertz.com",             profile: "Premium clásico",         airport: true,  shuttle: false, hours: "08:00–00:00", price: "Alto",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, premium",         vans: "Sí",           renting: "Sí", waitTime: "Medio-bajo", terminalOffice: true,  transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "europcar",  name: "Europcar",           domain: "europcar.com",          url: "https://www.europcar.com",          profile: "Corporativo",             airport: true,  shuttle: false, hours: "07:30–00:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, furgonetas",      vans: "Sí",           renting: "Sí", waitTime: "Medio",      terminalOffice: true,  transparency: "Alta",       vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "avis",      name: "Avis",               domain: "avis.com",              url: "https://www.avis.com",              profile: "Business internacional",  airport: true,  shuttle: false, hours: "08:00–23:45", price: "Alto",        insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, ejecutivos, SUV",      vans: "Algunas",      renting: "Sí", waitTime: "Bajo",       terminalOffice: true,  transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "enterprise",name: "Enterprise",         domain: "enterprise.com",        url: "https://www.enterprise.com",        profile: "Servicio completo",       airport: true,  shuttle: false, hours: "08:00–22:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, SUV, furgonetas",      vans: "Sí",           renting: "Sí", waitTime: "Bajo",       terminalOffice: true,  transparency: "Muy alta",   vehicleState: "Muy bueno", incidentRisk: "Muy bajo" },
  { id: "budget",    name: "Budget",             domain: "budget.com",            url: "https://www.budget.com",            profile: "Económico corporativo",   airport: true,  shuttle: false, hours: "08:00–23:00", price: "Medio",       insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, compactos",            vans: "Limitadas",    renting: "No", waitTime: "Medio",      terminalOffice: true,  transparency: "Media",      vehicleState: "Bueno",     incidentRisk: "Medio" },
  { id: "drivalia",  name: "Drivalia",           domain: "drivalia.com",          url: "https://www.drivalia.com",          profile: "Innovador / EV",          airport: true,  shuttle: true,  hours: "07:00–23:00", price: "Medio",       insurance: "Sí",       franchise: "Sí",       vehicles: "Turismo, eléctricos, SUV",      vans: "Sí",           renting: "Sí", waitTime: "Medio",      terminalOffice: false, transparency: "Media-alta", vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "firefly",   name: "Firefly",            domain: "fireflycarrental.com",  url: "https://www.fireflycarrental.com",  profile: "Ultra low cost",          airport: true,  shuttle: true,  hours: "08:00–01:00", price: "Muy bajo",    insurance: "Opcional", franchise: "Sí",       vehicles: "Turismo económico",             vans: "No",           renting: "No", waitTime: "Alto",       terminalOffice: false, transparency: "Baja",       vehicleState: "Correcto",  incidentRisk: "Alto" },
  { id: "victoria",  name: "Victoria Cars",      domain: "victoriacars.com",      url: "https://www.victoriacars.com",      profile: "Familiar/local",          airport: true,  shuttle: true,  hours: "24h",         price: "Medio",       insurance: "Sí",       franchise: "Opcional", vehicles: "Turismo, monovolumen",          vans: "No",           renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "northgate", name: "Northgate",          domain: "northgate.es",          url: "https://www.northgate.es",          profile: "Renting profesional",     airport: false, shuttle: false, hours: "08:00–19:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Variable", vehicles: "Industriales, comerciales",     vans: "Especialista", renting: "Sí", waitTime: "Muy bajo",   terminalOffice: false, transparency: "Muy alta",   vehicleState: "Excelente", incidentRisk: "Muy bajo" },
  { id: "telefurgo", name: "TELEFURGO",          domain: "telefurgo.com",         url: "https://www.telefurgo.com",         profile: "Comercial/furgo",         airport: false, shuttle: false, hours: "08:00–20:00", price: "Medio",       insurance: "Opcional", franchise: "Sí",       vehicles: "Furgonetas",                    vans: "Especialista", renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "covey",     name: "Covey",              domain: "covey.es",              url: "https://www.covey.es",              profile: "Industrial/renting",      airport: false, shuttle: false, hours: "08:00–19:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Furgonetas industriales",       vans: "Especialista", renting: "Sí", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
  { id: "demetrio",  name: "Furgonetas Demetrio",domain: "furgonetasdemetrio.com",url: "https://www.furgonetasdemetrio.com",profile: "Local comercial",         airport: false, shuttle: false, hours: "08:00–19:00", price: "Medio",       insurance: "Opcional", franchise: "Sí",       vehicles: "Furgonetas y carga",            vans: "Especialista", renting: "No", waitTime: "Bajo",       terminalOffice: false, transparency: "Media",      vehicleState: "Bueno",     incidentRisk: "Bajo" },
  { id: "primoti",   name: "PRIMOTI",            domain: "primoti.com",           url: "https://www.primoti.com",           profile: "Industrial/logística",    airport: false, shuttle: false, hours: "08:00–18:00", price: "Medio-alto",  insurance: "Sí",       franchise: "Sí",       vehicles: "Comerciales e industriales",    vans: "Especialista", renting: "Sí", waitTime: "Bajo",       terminalOffice: false, transparency: "Alta",       vehicleState: "Muy bueno", incidentRisk: "Bajo" },
];



function Badge({ value }: { value: string; styles?: Record<string, string> }) {
  return (
    <span className="whitespace-nowrap text-[11px] font-semibold text-white">
      {value}
    </span>
  );
}

function YesNo({ value }: { value: YesNoOpt | boolean }) {
  if (value === true) return <Check className="h-4 w-4 text-white" />;
  if (value === false) return <XCircle className="h-4 w-4 text-white" />;
  return <span className="text-xs font-medium text-white">{value}</span>;
}

function ShuttleCell({ value, terminalOffice }: { value: boolean; terminalOffice: boolean }) {
  if (value) {
    return (
      <div className="flex items-center gap-1.5 text-white">
        <Bus className="h-4 w-4" />
        <span className="text-sm font-medium">Sí</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-white">
        <XCircle className="h-4 w-4" />
        <span className="text-sm font-medium">No</span>
      </div>
      {terminalOffice && <span className="text-[11px] text-white">(Terminal)</span>}
    </div>
  );
}

function ComparadorPage() {
  return (
    <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
      <main className="mx-auto w-full max-w-[1600px] flex-1 min-h-0 flex flex-col px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Link
            to="/rent-a-car"
            className="grid h-8 w-8 place-items-center rounded-full text-white hover:bg-white/10"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex items-center gap-1.5 text-base font-semibold text-white">
            {OPERATORS.length} operadoras comparadas
            <Info className="h-4 w-4 text-white" />
          </h1>
        </div>

        <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-white/10 bg-black">
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-[11px]">
            <thead className="text-left text-[10px] uppercase tracking-wide text-white">
              <tr>
                <Th sticky className="px-2 py-1.5">Operadora</Th>
                <Th>Perfil</Th>
                <Th>Aerop.</Th>
                <Th>Shuttle</Th>
                <Th>Horario</Th>
                <Th>Precio</Th>
                <Th>Seguro TR</Th>
                <Th>Franq.</Th>
                <Th>Vehículos</Th>
                <Th>Furgo.</Th>
                <Th>Renting</Th>
                <Th>Espera</Th>
                <Th>Transp.</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {OPERATORS.map((op) => (
                <tr key={op.id} className="group">
                <Td sticky className="px-1.5 py-1.5">
                  <div className="flex items-center gap-1">
                    <img
                      src={logoUrl(op.domain)}
                      alt={op.name}
                      width={18}
                      height={18}
                      loading="lazy"
                      className="h-[18px] w-[18px] shrink-0 rounded-sm object-contain bg-white/90"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <a
                      href={op.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap text-[11px] font-semibold text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      {op.name}
                    </a>
                  </div>
                </Td>
                  <Td className="text-white">{op.profile}</Td>
                  <Td>
                    {op.airport ? (
                      <span className="inline-block whitespace-nowrap rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Terminal
                      </span>
                    ) : (
                      <span className="text-white">—</span>
                    )}
                  </Td>
                  <Td><ShuttleCell value={op.shuttle} terminalOffice={op.terminalOffice} /></Td>
                  <Td className="text-white whitespace-nowrap">{op.hours}</Td>
                  <Td><Badge value={op.price} /></Td>
                  <Td><YesNo value={op.insurance} /></Td>
                  <Td><YesNo value={op.franchise} /></Td>
                  <Td className="text-white">{op.vehicles}</Td>
                  <Td><YesNo value={op.vans} /></Td>
                  <Td><YesNo value={op.renting} /></Td>
                  <Td><Badge value={op.waitTime} /></Td>
                  <Td><Badge value={op.transparency} /></Td>
                  <Td><Badge value={op.vehicleState} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-center text-[11px] text-white">
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
  const base = "sticky top-0 z-10 bg-neutral-900";
  const stickyCls = sticky
    ? "sticky left-0 top-0 z-20 bg-neutral-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.6)]"
    : base;
  return (
    <th className={`border-b border-white/10 px-1.5 py-1.5 font-semibold whitespace-nowrap ${stickyCls} ${className}`}>
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
    ? "sticky left-0 z-10 bg-black shadow-[2px_0_4px_-2px_rgba(0,0,0,0.6)] group-hover:bg-neutral-900"
    : "group-hover:bg-white/5";
  return (
    <td className={`border-b border-white/5 px-1.5 py-1.5 align-middle ${stickyCls} ${className}`}>
      {children}
    </td>
  );
}
