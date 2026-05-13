import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listMyBusinesses } from "@/lib/business/business.functions";

function playAlarm() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
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
  toast(title, { description: body, duration: 10000 });
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Subscribes in realtime to new bookings for businesses owned by the
 * current user and fires a loud alarm + toast + browser notification
 * the moment a customer creates a reservation.
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

  // Ask for browser notification permission once.
  const askedRef = useRef(false);
  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (businessIds.length === 0) return;
    const idSet = new Set(businessIds);
    // Avoid double-firing for the same thread (StrictMode / reconnects).
    const seen = new Set<string>();

    const channel = supabase
      .channel(`biz-bookings-${idsKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_threads",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            business_id?: string;
            context_snapshot?: { customer_name?: string; scheduled_at?: string } | null;
          };
          if (!row?.business_id || !idSet.has(row.business_id)) return;
          if (row.id && seen.has(row.id)) return;
          if (row.id) seen.add(row.id);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
}
