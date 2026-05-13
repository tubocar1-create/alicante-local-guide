import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdVariants, type AdVariantsResponse } from "@/lib/ads/ads.functions";
import { ADVERTISERS } from "@/lib/ads/advertisers";

const ROTATE_MS = 2 * 60 * 1000; // 2 min entre rotaciones
const CACHE_TTL_MS = 5 * 60 * 1000;

type Cached = { at: number; data: AdVariantsResponse };

const cacheKey = (id: string) => `banner:${id}:variants:v3`;
const rotateKey = (id: string) => `banner:${id}:idx`;

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
  const [cycle, setCycle] = useState(0);

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

  useEffect(() => {
    const t = setInterval(() => setCycle((c) => c + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  const allLoaded = queries.every((q) => q.data);
  if (!allLoaded) return null;

  const ai = cycle % ADVERTISERS.length;
  const data = queries[ai]?.data;
  if (!data) return null;
  const variant =
    data.variants[nextIndex(ADVERTISERS[ai].id, data.variants.length)] ??
    data.variants[0];
  if (!variant) return null;
  const theme = data.advertiser.theme;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-2">
      <div
        key={cycle}
        className={`flex items-center gap-2.5 overflow-hidden rounded-2xl px-3 py-2 ${theme.bg} ${theme.fg} shadow-sm ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-500`}
      >
        <div className="text-xl leading-none shrink-0">{theme.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90 shrink-0">
              {data.advertiser.name}
            </span>
            <span className="truncate text-[12px] font-bold leading-tight">
              {variant.headline}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] opacity-95 leading-snug">
            {variant.body}
          </p>
        </div>
      </div>
    </div>
  );
}
