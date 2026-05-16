import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdVariants, type AdVariantsResponse } from "@/lib/ads/ads.functions";
import { ADVERTISERS } from "@/lib/ads/advertisers";

const FREQUENCY_MS = 10 * 1000; // 10 s entre apariciones
const VISIBLE_MS = 10 * 1000; // 10 s visible
const FIRST_DELAY_MS = 5 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

type Cached = { at: number; data: AdVariantsResponse };
const cacheKey = (id: string) => `banner:${id}:variants:v4`;

function readCache(id: string): AdVariantsResponse | null {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (Date.now() - c.at > CACHE_TTL_MS) return null;
    return c.data;
  } catch {
    return null;
  }
}
function writeCache(id: string, data: AdVariantsResponse) {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore */
  }
}
function pickRandomIndex(len: number): number {
  if (len <= 0) return 0;
  return Math.floor(Math.random() * len);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function AdBanner() {
  const fetchAds = useServerFn(getAdVariants);
  const [cycle, setCycle] = useState(0);
  const [open, setOpen] = useState(false);

  // Orden barajado del carrusel: estable durante la vida del componente,
  // distinto en cada montaje. Es un array de índices sobre ADVERTISERS.
  const shuffledOrder = useMemo(
    () => shuffle(ADVERTISERS.map((_, i) => i)),
    [],
  );

  const queries = useQueries({
    queries: ADVERTISERS.map((a) => ({
      queryKey: ["banner-variants", a.id],
      queryFn: async () => {
        const cached = readCache(a.id);
        if (cached) return cached;
        const res = await fetchAds({ data: { advertiserId: a.id, count: 6 } });
        writeCache(a.id, res);
        return res;
      },
      staleTime: CACHE_TTL_MS,
      retry: false,
    })),
  });
  const allLoaded = queries.every((q) => q.data);

  useEffect(() => {
    if (!allLoaded) return;
    const show = () => {
      setCycle((c) => c + 1);
      setOpen(true);
    };
    const first = setTimeout(show, FIRST_DELAY_MS);
    const interval = setInterval(show, VISIBLE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [allLoaded]);

  // Reservamos siempre el alto del banner para que no salte el layout.
  const SLOT = (
    <div className="mx-auto w-full max-w-2xl px-4 pt-2" aria-hidden={!open}>
      <div className="h-[44px]" />
    </div>
  );

  if (!allLoaded || !open) return SLOT;

  // Filtramos anunciantes sin variantes (banner suspendido, p.ej. Aena sin incidencias)
  // y respetamos el orden barajado del carrusel.
  const activeIdx: number[] = [];
  for (const i of shuffledOrder) {
    const q = queries[i];
    if (q?.data && q.data.variants.length > 0) activeIdx.push(i);
  }
  if (activeIdx.length === 0) return SLOT;

  const ai = activeIdx[(cycle - 1 + activeIdx.length * 1000) % activeIdx.length];
  const data = queries[ai]?.data;
  if (!data) return SLOT;
  // Variante aleatoria en cada aparición (la cartelera se enseña al azar).
  const variant =
    data.variants[pickRandomIndex(data.variants.length)] ?? data.variants[0];
  if (!variant) return SLOT;
  const theme = data.advertiser.theme;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-2">
      <a
        key={cycle}
        href={data.advertiser.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Ver fuente · ${data.advertiser.name}`}
        aria-label={`${data.advertiser.name}: ${variant.headline}. Abrir fuente en nueva pestaña.`}
        className={`flex h-[44px] items-center gap-2.5 overflow-hidden rounded-2xl px-3 ${theme.bg} ${theme.fg} shadow-sm ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-300 transition hover:shadow-md hover:ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer no-underline`}
      >
        <div className="text-lg leading-none shrink-0">{theme.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90 shrink-0">
              {data.advertiser.name}
            </span>
            <span className="truncate text-[12px] font-bold">
              {variant.headline}
            </span>
          </div>
          <p className="truncate text-[11px] opacity-95 leading-tight">
            {variant.body}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="shrink-0 text-[11px] font-semibold opacity-70"
        >
          ↗
        </span>
      </a>
    </div>
  );
}
