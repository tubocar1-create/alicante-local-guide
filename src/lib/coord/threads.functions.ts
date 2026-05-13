import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export const listThreadsForBusiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ business_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabase } = context;
      const { data: rows, error } = await supabase
        .from("conversation_threads")
        .select("id, booking_id, business_id, user_id, status, last_message_at, created_at, context_snapshot")
        .eq("business_id", data.business_id)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("listThreadsForBusiness error", error);
        return { threads: [] };
      }

      const ids = (rows ?? []).map((r) => r.id);
      const bookingIds = (rows ?? []).map((r) => r.booking_id);
      const [{ data: msgs }, { data: bks }] = await Promise.all([
        supabase
          .from("messages")
          .select("id, thread_id, sender_type, message_type, template_key, text, payload, created_at")
          .in("thread_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id, customer_name, customer_phone, customer_email, scheduled_at, party_size, status, notes")
          .in("id", bookingIds.length ? bookingIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);
      const lastByThread = new Map<string, NonNullable<typeof msgs>[number]>();
      (msgs ?? []).forEach((m) => {
        if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
      });
      const bookingsById = new Map((bks ?? []).map((b) => [b.id, b]));

      return {
        threads: (rows ?? []).map((t) => ({
          ...t,
          last_message: lastByThread.get(t.id) ?? null,
          booking: bookingsById.get(t.booking_id) ?? null,
        })),
      };
    } catch (e) {
      console.error("listThreadsForBusiness failed", e);
      return { threads: [] };
    }
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ thread_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: thread, error } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("id", data.thread_id)
      .single();
    if (error) throw new Error(error.message);

    const [{ data: messages }, { data: booking }] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("thread_id", data.thread_id)
        .order("created_at", { ascending: true }),
      supabase.from("bookings").select("*").eq("id", thread.booking_id).single(),
    ]);

    return { thread, messages: messages ?? [], booking: booking ?? null };
  });

export const listThreadsForUser = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const authHeader = getRequestHeader("authorization");
      if (!authHeader?.startsWith("Bearer ")) return { threads: [] };

      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return { threads: [] };

      const token = authHeader.replace("Bearer ", "");
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userError || !userId) return { threads: [] };

      const { data: rows, error } = await supabase
        .from("conversation_threads")
        .select("id, booking_id, business_id, status, last_message_at, context_snapshot")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("listThreadsForUser error", error);
        return { threads: [] };
      }
      const bizIds = [...new Set((rows ?? []).map((r) => r.business_id))];
      const { data: bizs } = await supabase
        .from("businesses")
        .select("id, name, address, phone")
        .in("id", bizIds.length ? bizIds : ["00000000-0000-0000-0000-000000000000"]);
      const map = new Map((bizs ?? []).map((b) => [b.id, b]));
      return {
        threads: (rows ?? []).map((t) => ({ ...t, business: map.get(t.business_id) ?? null })),
      };
    } catch (e) {
      console.error("listThreadsForUser failed", e);
      return { threads: [] };
    }
  });
