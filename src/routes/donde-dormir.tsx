import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { listHotels } from "@/lib/hotels.functions";

export const Route = createFileRoute("/donde-dormir")({
  head: () => ({
    meta: [
      { title: "Hoteles para hoy en Alicante · precios y disponibilidad" },
      {
        name: "description",
        content:
          "Hoteles disponibles esta noche en Alicante: tarifas por tipo de habitación, desayuno, cancelación y distancia.",
      },
    ],
  }),
  component: DondeDormirPage,
});

function hotelEmoji(t?: string | null) {
  const s = (t ?? "").toLowerCase();
  if (s.includes("hostel") || s.includes("hostal")) return "🛏️";
  if (s.includes("apart")) return "🏢";
  if (s.includes("pension") || s.includes("pensión") || s.includes("guest")) return "🏠";
  if (s.includes("resort") || s.includes("spa")) return "🌴";
  return "🏨";
}

const ROOM_LABELS_CLIENT: Record<string, string> = {
  single: "Sencilla",
  double: "Doble",
  triple: "Triple",
  quadruple: "Cuádruple",
  suite: "Suite",
  other: "Otra",
};

function DondeDormirPage() {
  const fetchHotels = useServerFn(listHotels);
  const { data, isLoading } = useQuery({
    queryKey: ["hotels-stay"],
    queryFn: () => fetchHotels(),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const all = (data?.hotels ?? []).map((h: any) => ({
      ...h,
      dyn: Array.isArray(h.hotels_dynamic) ? h.hotels_dynamic[0] : h.hotels_dynamic,
    }));
    all.sort((a: any, b: any) => {
      const aAv = a.dyn?.available ? 1 : 0;
      const bAv = b.dyn?.available ? 1 : 0;
      if (aAv !== bAv) return bAv - aAv;
      const pa = a.dyn?.current_price ?? Infinity;
      const pb = b.dyn?.current_price ?? Infinity;
      return pa - pb;
    });
    return all;
  }, [data]);

  const availableCount = ranked.filter((h: any) => h.dyn?.available).length;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-amber-50"
      style={{
        background: "linear-gradient(180deg, #1a0f05 0%, #2a1607 50%, #120800 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/[0.08] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-rose-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-amber-200/60 transition hover:text-amber-300"
          >
            ← Volver al chat
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80">
              Live · ALC
            </span>
            <Link
              to="/"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-amber-900/60 p-1.5 text-amber-200/70 hover:border-amber-500/50 hover:text-amber-300"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
            Dashboard nocturno
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-amber-50 md:text-4xl">
            Hoteles{" "}
            <span className="bg-gradient-to-r from-amber-300 via-white to-rose-300 bg-clip-text text-transparent">
              para hoy
            </span>
          </h1>
          <p className="mt-1 text-xs text-amber-200/80 md:text-sm">
            Toca un hotel para ver tarifas por tipo de habitación.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100/[0.08] bg-[rgba(20,10,4,0.7)] p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-amber-50">
              {isLoading
                ? "Cargando…"
                : `${availableCount} disponibles · ${ranked.length} alojamientos`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/70">
              estado · €/noche · des · canc · dist
            </p>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] text-amber-50">
            <colgroup>
              <col className="w-[18px]" />
              <col />
              <col className="w-[44px]" />
              <col className="w-[50px]" />
              <col className="w-[34px]" />
              <col className="w-[40px]" />
              <col className="w-[42px]" />
            </colgroup>
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.12em] text-amber-200/50">
                <th className="px-0.5 py-1" />
                <th className="px-1 py-1 font-medium">Hotel</th>
                <th className="px-1 py-1 font-medium">Estado</th>
                <th className="px-1 py-1 text-right font-medium">€/noche</th>
                <th className="px-1 py-1 text-center font-medium">Des.</th>
                <th className="px-1 py-1 text-center font-medium">Canc.</th>
                <th className="px-1 py-1 text-right font-medium">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((h: any) => {
                const d = h.dyn;
                const price = d?.current_price;
                const distLabel =
                  h.distance_km == null
                    ? "—"
                    : h.distance_km < 1
                      ? `${Math.round(h.distance_km * 1000)}m`
                      : `${Number(h.distance_km).toFixed(1)}km`;
                const roomTypes: Array<{ type: string; price: number; currency: string; label?: string }> =
                  Array.isArray(d?.room_types) ? d.room_types : [];
                const open = openId === h.id;
                return (
                  <>
                    <tr key={h.id} className="bg-white/[0.02]">
                      <td className="rounded-l-md px-0.5 py-1 align-middle">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : h.id)}
                          aria-label={open ? "Ocultar habitaciones" : "Ver habitaciones"}
                          disabled={roomTypes.length === 0}
                          className="flex h-5 w-5 items-center justify-center rounded text-amber-200/70 hover:bg-amber-500/10 disabled:opacity-20"
                        >
                          {open ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                      <td className="px-1 py-1 align-middle">
                        <Link
                          to="/hotel/$id"
                          params={{ id: h.id }}
                          className="block hover:text-amber-300"
                        >
                          <span className="flex items-center gap-1">
                            <span className="text-[13px] leading-none">{hotelEmoji(h.hotel_type)}</span>
                            <span className="min-w-0 truncate text-[11px] font-medium">{h.name}</span>
                          </span>
                          {h.address && (
                            <span className="mt-0.5 block truncate pl-[18px] text-[9px] text-amber-200/40">
                              {h.address}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-1 py-1 align-middle">
                        {d?.available ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                            ● Libre
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1 py-0.5 text-[9px] font-semibold text-rose-300/80">
                            s/d
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-1 text-right align-middle font-mono text-[11px] font-semibold tabular-nums text-amber-50">
                        {price != null ? `${Math.round(price)}€` : "—"}
                      </td>
                      <td className="px-1 py-1 text-center align-middle text-[10px] font-medium text-amber-50">
                        {d?.breakfast_included ? (
                          <span className="text-emerald-300">Sí</span>
                        ) : (
                          <span className="text-amber-200/30">No</span>
                        )}
                      </td>
                      <td className="px-1 py-1 text-center align-middle text-[10px] font-medium text-amber-50">
                        {d?.free_cancellation ? (
                          <span className="text-emerald-300">Sí</span>
                        ) : (
                          <span className="text-amber-200/30">No</span>
                        )}
                      </td>
                      <td className="rounded-r-md px-1 py-1 text-right align-middle font-mono text-[10px] tabular-nums text-amber-100/80">
                        {distLabel}
                      </td>
                    </tr>
                    {open && roomTypes.length > 0 && (
                      <tr key={h.id + "-rooms"} className="bg-amber-500/[0.04]">
                        <td className="rounded-l-md" />
                        <td colSpan={6} className="rounded-r-md px-2 py-2">
                          <ul className="flex flex-col divide-y divide-amber-100/[0.06]">
                            {roomTypes.map((rt, i) => (
                              <li
                                key={i}
                                className="flex items-center justify-between gap-3 py-1 text-[11px]"
                              >
                                <span className="text-amber-100/90">
                                  {ROOM_LABELS_CLIENT[rt.type] ?? rt.label ?? rt.type}
                                </span>
                                <span className="font-mono font-semibold tabular-nums text-amber-50">
                                  {Math.round(rt.price)} {rt.currency || "EUR"}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-[9px] italic text-amber-200/50">
                            Precios orientativos. Varían según temporada y disponibilidad.
                          </p>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!isLoading && ranked.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-xs text-amber-200/50">
                    Sin alojamientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
