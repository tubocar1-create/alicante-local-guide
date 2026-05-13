import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { listThreadsForBusiness } from "@/lib/coord/threads.functions";

// Singleton AudioContext. Browsers require a user gesture before audio can
// play; we create/resume the context the first time the user interacts with
// the page and reuse it for every alarm afterwards.
let sharedCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  return sharedCtx;
}

function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
  unlocked = true;
}

export function playAlarm() {
  const ctx = getCtx();
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    try {
      const now = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const t = now + i * 0.45;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(1200, t);
        o.frequency.setValueAtTime(800, t + 0.15);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.42);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([500, 150, 500, 150, 700, 150, 500]);
    }
  } catch {
    /* ignore */
  }
}

function notify(title: string, body: string) {
  playAlarm();
  toast(title, { description: body, duration: 15000 });
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* ignore */
  }
}

// Tracks thread IDs we've already alerted on, across realtime + polling.
const seenThreads = new Set<string>();

/**
 * Subscribes in realtime to new bookings for businesses owned by the
 * current user and fires a loud alarm + toast + browser notification
 * the moment a customer creates a reservation. Falls back to polling
 * every 10s in case the realtime websocket misses an event (RLS, auth
 * token race, dropped WS, etc).
 */
export function useBookingAlarm() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const { data } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: () => fetchBiz(),
    retry: false,
    throwOnError: false,
  });
  const businesses = data?.businesses ?? [];
  const businessIds = businesses.map((b) => b.id);
  const idsKey = businessIds.join(",");

  // Ask for browser notification permission + unlock audio on first gesture.
  const askedRef = useRef(false);
  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const onGesture = () => {
      if (!unlocked) unlockAudio();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchstart", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (businessIds.length === 0) return;
    const idSet = new Set(businessIds);

    const channel = supabase
      .channel(`biz-bookings-${idsKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_threads" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            business_id?: string;
            context_snapshot?: { customer_name?: string; scheduled_at?: string } | null;
          };
          console.log("[alarm] realtime thread INSERT", row);
          if (!row?.business_id || !idSet.has(row.business_id)) return;
          if (row.id && seenThreads.has(row.id)) return;
          if (row.id) seenThreads.add(row.id);

          const biz = businesses.find((b) => b.id === row.business_id);
          const customer = row.context_snapshot?.customer_name?.trim();
          const when = row.context_snapshot?.scheduled_at
            ? new Date(row.context_snapshot.scheduled_at).toLocaleString("es-ES", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;

          const title = `¡Nueva reserva${biz ? ` en ${biz.name}` : ""}!`;
          const body = [customer, when].filter(Boolean).join(" · ") || "Un cliente acaba de reservar";
          notify(title, body);
        },
      )
      .subscribe((status) => {
        console.log("[alarm] realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Polling fallback — every 10s fetch threads and alert on any new ones.
  // This guarantees the alarm fires even if the realtime channel never
  // receives the event (auth race, WS disconnect, RLS edge case).
  const fetchThreads = useServerFn(listThreadsForBusiness);
  const baselineSetRef = useRef(false);
  const { data: pollData } = useQuery({
    queryKey: ["alarm-poll", idsKey],
    queryFn: () => fetchThreads({ data: { business_ids: businessIds } }),
    enabled: businessIds.length > 0,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    retry: false,
    throwOnError: false,
  });

  useEffect(() => {
    const threads = pollData?.threads ?? [];
    if (!baselineSetRef.current) {
      // First load: mark all existing threads as seen so we don't alarm
      // on historical reservations.
      threads.forEach((t) => seenThreads.add(t.id));
      baselineSetRef.current = true;
      return;
    }
    for (const t of threads) {
      if (seenThreads.has(t.id)) continue;
      seenThreads.add(t.id);
      const biz = businesses.find((b) => b.id === t.business_id);
      const customer =
        (t.context_snapshot as { customer_name?: string } | null)?.customer_name?.trim() ||
        t.booking?.customer_name?.trim();
      const when = t.booking?.scheduled_at
        ? new Date(t.booking.scheduled_at).toLocaleString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
      const title = `¡Nueva reserva${biz ? ` en ${biz.name}` : ""}!`;
      const body = [customer, when].filter(Boolean).join(" · ") || "Un cliente acaba de reservar";
      console.log("[alarm] polling detected new thread", t.id);
      notify(title, body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollData]);
}
