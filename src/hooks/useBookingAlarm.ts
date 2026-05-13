import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { listThreadsForBusiness } from "@/lib/coord/threads.functions";

// Generate a loud alarm WAV (3s, alternating 1200/800 Hz square wave) once
// and reuse it. HTMLAudioElement is more reliable than scheduled oscillators
// inside iframes (Lovable preview) where AudioContext may be suspended at
// the moment a realtime event arrives.
let alarmUrl: string | null = null;
let alarmEl: HTMLAudioElement | null = null;
let unlocked = false;

function buildAlarmWav(): string {
  const sampleRate = 22050;
  const duration = 3; // seconds
  const total = sampleRate * duration;
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + total * bytesPerSample);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + total * bytesPerSample, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, total * bytesPerSample, true);

  // Alternating beep pattern: 0.25s on (1200Hz), 0.15s off, 0.25s on (800Hz), 0.15s off …
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const cycle = t % 0.8; // 0.8s cycle
    let sample = 0;
    if (cycle < 0.25) {
      // 1200 Hz square
      sample = Math.sign(Math.sin(2 * Math.PI * 1200 * t)) * 0.6;
    } else if (cycle >= 0.4 && cycle < 0.65) {
      // 800 Hz square
      sample = Math.sign(Math.sin(2 * Math.PI * 800 * t)) * 0.6;
    }
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }
  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function getAlarmEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!alarmUrl) alarmUrl = buildAlarmWav();
  if (!alarmEl) {
    alarmEl = new Audio(alarmUrl);
    alarmEl.preload = "auto";
    alarmEl.volume = 1;
  }
  return alarmEl;
}

function unlockAudio() {
  const el = getAlarmEl();
  if (!el) return;
  // Play + immediately pause inside the gesture handler to satisfy browser
  // autoplay policies. After this, .play() works from any callback.
  el.muted = true;
  el.play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      unlocked = true;
      console.log("[alarm] audio unlocked");
    })
    .catch((e) => {
      el.muted = false;
      console.warn("[alarm] unlock failed", e);
    });
}

export function playAlarm() {
  const el = getAlarmEl();
  if (el) {
    try {
      el.currentTime = 0;
      el.volume = 1;
      el.muted = false;
      const p = el.play();
      if (p) p.catch((e) => console.warn("[alarm] play() rejected", e));
    } catch (e) {
      console.warn("[alarm] play threw", e);
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
