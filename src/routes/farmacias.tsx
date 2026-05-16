import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin, Phone, Search } from "lucide-react";

type Pharmacy = {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
};

// Sectores de Alicante por código postal (zonas reconocidas)
const SECTORS: Record<string, string> = {
  "03001": "Centro",
  "03002": "Casco Antiguo / Playa Postiguet",
  "03003": "Mercado / Renfe",
  "03004": "Centro – Alfonso X",
  "03005": "Pla del Bon Repós",
  "03006": "Benalúa / Babel",
  "03007": "Carolinas Bajas / Florida",
  "03008": "Carolinas Altas",
  "03009": "Pla / Garbinet",
  "03010": "Virgen del Remedio",
  "03011": "Juan XXIII / Virgen del Carmen",
  "03012": "Ciudad de Asís / Sagrada Familia",
  "03013": "San Blas",
  "03014": "Polígono San Blas / Tómbola",
  "03015": "Vistahermosa / Albufereta",
  "03016": "Cabo Huertas / Albufereta",
  "03112": "Villafranqueza",
  "03113": "Rebolledo / El Moralet",
  "03540": "Playa de San Juan",
  "03550": "Sant Joan d'Alacant",
  "03690": "Partidas Rurales",
  "03699": "Cañada del Fenollar",
};

const sectorFor = (cp: string | null) =>
  (cp && SECTORS[cp]) || (cp ? `Zona ${cp}` : "Sin código postal");

export const Route = createFileRoute("/farmacias")({
  head: () => ({
    meta: [
      { title: "Farmacias de Alicante · Listado completo por zona" },
      {
        name: "description",
        content:
          "Directorio de farmacias de Alicante clasificadas por código postal y sector. Direcciones, teléfonos y zona.",
      },
    ],
  }),
  component: FarmaciasPage,
});

function FarmaciasPage() {
  const [items, setItems] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState<"sector" | "postal">("sector");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, code, name, address, postal_code, city, phone")
        .order("postal_code", { ascending: true })
        .order("name", { ascending: true });
      if (!error && data) setItems(data as Pharmacy[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((p) =>
      [p.name, p.address, p.postal_code, p.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [items, q]);

  const groups = useMemo(() => {
    const map = new Map<string, Pharmacy[]>();
    for (const p of filtered) {
      const key =
        groupBy === "sector"
          ? sectorFor(p.postal_code)
          : p.postal_code || "Sin CP";
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "es"),
    );
  }, [filtered, groupBy]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-card p-0.5 text-xs">
            <button
              onClick={() => setGroupBy("sector")}
              className={`rounded-full px-3 py-1 ${
                groupBy === "sector"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Por sector
            </button>
            <button
              onClick={() => setGroupBy("postal")}
              className={`rounded-full px-3 py-1 ${
                groupBy === "postal"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Por CP
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <h1 className="text-xl font-bold">💊 Farmacias de Alicante</h1>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Cargando…"
              : `${filtered.length} farmacias · ${groups.length} ${
                  groupBy === "sector" ? "sectores" : "códigos postales"
                }`}
          </p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, calle, CP o teléfono…"
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-6">
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin resultados.</p>
        )}
        {groups.map(([groupName, list]) => (
          <section key={groupName}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </h2>
              <span className="text-xs text-muted-foreground">
                {list.length}
              </span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {list.map((p) => {
                const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${p.name} ${p.address ?? ""} Alicante`,
                )}`;
                return (
                  <li key={p.id} className="p-3">
                    <p className="text-sm font-medium leading-snug">
                      {p.name}
                    </p>
                    {p.address && (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-start gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          {p.address}
                          {p.postal_code ? ` · ${p.postal_code}` : ""}
                        </span>
                      </a>
                    )}
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {p.phone}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
