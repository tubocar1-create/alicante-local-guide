import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listThreadsForBusiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ business_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("conversation_threads")
      .select("id, booking_id, business_id, user_id, status, last_message_at, created_at, context_snapshot")
      .eq("business_id", data.business_id)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    // Adjuntar booking + último mensaje
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("conversation_threads")
      .select("id, booking_id, business_id, status, last_message_at, context_snapshot")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const bizIds = [...new Set((rows ?? []).map((r) => r.business_id))];
    const { data: bizs } = await supabase
      .from("businesses")
      .select("id, name, address, phone")
      .in("id", bizIds.length ? bizIds : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((bizs ?? []).map((b) => [b.id, b]));
    return {
      threads: (rows ?? []).map((t) => ({ ...t, business: map.get(t.business_id) ?? null })),
    };
  });
