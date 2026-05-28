import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdVariants, type AdVariantsResponse, type AdCopy } from "@/lib/ads/ads.functions";
import { getAdComment } from "@/lib/ad-comment.functions";
import { ADVERTISERS } from "@/lib/ads/advertisers";
import { X, Loader2, Sparkles } from "lucide-react";

const FREQUENCY_MS = 10 * 1000; // 10 s entre apariciones
const VISIBLE_MS = 10 * 1000; // 10 s visible
const FIRST_DELAY_MS = 5 * 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h: 1 generación por banner por día

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

type CommentTarget = {
  advertiserName: string;
  category: string;
  ctaUrl: string;
  headline: string;
  body: string;
};

export function AdBanner() {
  const fetchAds = useServerFn(getAdVariants);
  const fetchComment = useServerFn(getAdComment);
  const [cycle, setCycle] = useState(0);
  const [open, setOpen] = useState(false);

  // Popup state
  const [target, setTarget] = useState<CommentTarget | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentErr, setCommentErr] = useState<string | null>(null);

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

  // Cerrar popup con Escape
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);

  async function openComment(t: CommentTarget) {
    setTarget(t);
    setCommentText("");
    setCommentErr(null);
    setCommentLoading(true);
    try {
      const res = await fetchComment({
        data: {
          advertiserName: t.advertiserName,
          category: t.category,
          headline: t.headline,
          body: t.body,
        },
      });
      setCommentText(res.text || "");
    } catch (e) {
      setCommentErr(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setCommentLoading(false);
    }
  }

  // Reservamos siempre el alto del banner.
  const SLOT = (
    <div className="mx-auto w-full max-w-2xl px-4 pt-2" aria-hidden={!open}>
      <div className="h-[44px]" />
    </div>
  );

  if (!allLoaded || !open) return target ? (
    <>
      {SLOT}
      <CommentPopup
        target={target}
        text={commentText}
        loading={commentLoading}
        err={commentErr}
        onClose={() => setTarget(null)}
      />
    </>
  ) : SLOT;

  const activeIdx: number[] = [];
  for (const i of shuffledOrder) {
    const q = queries[i];
    if (q?.data && q.data.variants.length > 0) activeIdx.push(i);
  }
  if (activeIdx.length === 0) return SLOT;

  const ai = activeIdx[(cycle - 1 + activeIdx.length * 1000) % activeIdx.length];
  const data = queries[ai]?.data;
  if (!data) return SLOT;
  const variant: AdCopy | undefined =
    data.variants[pickRandomIndex(data.variants.length)] ?? data.variants[0];
  if (!variant) return SLOT;
  const theme = data.advertiser.theme;

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pt-2">
        <button
          key={cycle}
          type="button"
          onClick={() =>
            openComment({
              advertiserName: data.advertiser.name,
              category: data.advertiser.name,
              ctaUrl: data.advertiser.ctaUrl,
              headline: variant.headline,
              body: variant.body,
            })
          }
          title={`Comentario sobre ${data.advertiser.name}`}
          aria-label={`${data.advertiser.name}: ${variant.headline}. Abrir comentario.`}
          className={`flex h-[44px] w-full items-center gap-2.5 overflow-hidden rounded-2xl px-3 text-left ${theme.bg} ${theme.fg} shadow-sm ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-300 transition hover:shadow-md hover:ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer`}
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
        </button>
      </div>
      {target && (
        <CommentPopup
          target={target}
          text={commentText}
          loading={commentLoading}
          err={commentErr}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}

function CommentPopup({
  target,
  text,
  loading,
  err,
  onClose,
}: {
  target: CommentTarget;
  text: string;
  loading: boolean;
  err: string | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Comentario sobre ${target.advertiserName}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1e2a44] via-[#243352] to-[#2d2a4a] p-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 flex items-center gap-2 pr-8">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/10 text-slate-200">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-100">
              {target.advertiserName}
            </h3>
            <p className="truncate text-[11px] text-slate-400">{target.headline}</p>
          </div>
        </div>
        <div className="min-h-[8rem] text-sm leading-relaxed text-slate-200">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analizando…
            </div>
          )}
          {err && !loading && (
            <p className="text-rose-300">No pudimos generar el comentario: {err}</p>
          )}
          {text && !loading && <p className="whitespace-pre-wrap">{text}</p>}
        </div>
        {target.ctaUrl && (
          <div className="mt-4 flex justify-end border-t border-white/5 pt-3">
            <a
              href={target.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-slate-300 hover:text-white"
            >
              Ver fuente original ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
