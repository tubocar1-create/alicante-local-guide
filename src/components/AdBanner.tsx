import { useEffect, useState, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { getAdVariants, type AdVariantsResponse } from "@/lib/ads/ads.functions";
import { ADVERTISERS } from "@/lib/ads/advertisers";

const FREQUENCY_MS = 2 * 60 * 1000; // 2 min
const VISIBLE_MS = 18 * 1000; // 18s visible
const FIRST_DELAY_MS = 30 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min (datos de parking/tráfico cambian rápido)

type Cached = { at: number; data: AdVariantsResponse };

function cacheKey(id: string) {
  return `banner:${id}:variants:v2`;
}
function rotateKey(id: string) {
  return `banner:${id}:idx`;
}

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

function nextIndex(id: string, len: number): number {
  if (len <= 0) return 0;
  try {
    const cur = parseInt(localStorage.getItem(rotateKey(id)) ?? "0", 10);
    const next = (Number.isFinite(cur) ? cur : 0) % len;
    localStorage.setItem(rotateKey(id), String((next + 1) % len));
    return next;
  } catch {
    return Math.floor(Math.random() * len);
  }
}

export function AdBanner() {
  const fetchAds = useServerFn(getAdVariants);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0); // qué advertiser
  const [variantIdx, setVariantIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const cycleRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!allLoaded || dismissed) return;
    let cancelled = false;

    const showNow = () => {
      if (cancelled) return;
      const ai = cycleRef.current % ADVERTISERS.length;
      cycleRef.current += 1;
      const data = queries[ai].data!;
      setActiveIdx(ai);
      setVariantIdx(nextIndex(ADVERTISERS[ai].id, data.variants.length));
      setOpen(true);
      hideTimerRef.current = setTimeout(() => {
        if (!cancelled) setOpen(false);
      }, VISIBLE_MS);
    };

    const firstTimer = setTimeout(showNow, FIRST_DELAY_MS);
    const interval = setInterval(showNow, FREQUENCY_MS);

    return () => {
      cancelled = true;
      clearTimeout(firstTimer);
      clearInterval(interval);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [allLoaded, dismissed, queries]);

  if (!allLoaded || !open || dismissed) return null;
  const data = queries[activeIdx]?.data;
  if (!data) return null;
  const v = data.variants[variantIdx] ?? data.variants[0];
  if (!v) return null;
  const theme = data.advertiser.theme;

  return (
    <div className="fixed inset-x-2 bottom-2 z-[60] pointer-events-none sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
      <div
        className={`pointer-events-auto relative overflow-hidden rounded-2xl ${theme.bg} ${theme.fg} shadow-2xl ring-1 ring-black/10 animate-in slide-in-from-bottom-4 fade-in duration-300`}
      >
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDismissed(true);
            setTimeout(() => setDismissed(false), FREQUENCY_MS);
          }}
          aria-label="Cerrar"
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/20 hover:bg-black/30"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3 px-3 py-2.5 pr-9">
          <div className="text-2xl leading-none mt-0.5">{theme.emoji}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold opacity-95 truncate">
                {data.advertiser.name}
              </span>
            </div>
            <h4 className="mt-0.5 text-[14px] font-bold leading-tight">
              {v.headline}
            </h4>
            <p className="mt-0.5 text-[11px] opacity-95 leading-snug line-clamp-2">
              {v.body}
            </p>
            <a
              href={data.advertiser.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${theme.accent} active:scale-95`}
            >
              {v.cta} →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
