import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const uuid = z.string().uuid();

const BusinessThreadsSchema = z
  .object({
    business_id: uuid.optional(),
    business_ids: z.array(uuid).min(1).max(25).optional(),
  })
  .refine((d) => d.business_id || d.business_ids?.length, {
    message: "business_id requerido",
  });

const ThreadSchema = z.object({
  thread_id: uuid,
  actor_role: z.enum(["user", "business"]).optional(),
  access_token: z.string().min(12).max(120).optional(),
});

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function currentUserId() {
  const authHeader = getRequestHeader("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  return data.user.id;
}

function uniqueBusinessIds(input: z.infer<typeof BusinessThreadsSchema>) {
  return [
    ...new Set([...(input.business_ids ?? []), ...(input.business_id ? [input.business_id] : [])]),
  ];
}

async function allowedBusinessIds(
  admin: ReturnType<typeof createClient<Database>>,
  requestedIds: string[],
  userId: string | null,
) {
  const { data: businesses, error } = await admin
    .from("businesses")
    .select("id, owner_id")
    .in("id", requestedIds);
  if (error || !businesses?.length) return [];

  const openIds = businesses.filter((b) => b.owner_id === null).map((b) => b.id);
  if (!userId) return openIds;

  const [{ data: memberships }, { data: roles }] = await Promise.all([
    admin
      .from("business_users")
      .select("business_id")
      .eq("user_id", userId)
      .in("business_id", requestedIds),
    admin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  const memberIds = new Set((memberships ?? []).map((m) => m.business_id));

  return businesses
    .filter((b) => isAdmin || b.owner_id === null || b.owner_id === userId || memberIds.has(b.id))
    .map((b) => b.id);
}

function tokenMatches(booking: { metadata: unknown } | null, accessToken?: string) {
  if (
    !booking ||
    !accessToken ||
    typeof booking.metadata !== "object" ||
    booking.metadata === null
  ) {
    return false;
  }
  return (booking.metadata as Record<string, unknown>).public_access_token === accessToken;
}

export const listThreadsForBusiness = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => BusinessThreadsSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const admin = serviceClient();
      if (!admin) return { threads: [] };
      const userId = await currentUserId();
      const allowedIds = await allowedBusinessIds(admin, uniqueBusinessIds(data), userId);
      if (!allowedIds.length) return { threads: [] };

      const { data: rows, error } = await admin
        .from("conversation_threads")
        .select(
          "id, booking_id, business_id, user_id, status, last_message_at, created_at, context_snapshot",
        )
        .in("business_id", allowedIds)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("listThreadsForBusiness error", error);
        return { threads: [] };
      }

      const ids = (rows ?? []).map((r) => r.id);
      const bookingIds = (rows ?? []).map((r) => r.booking_id);
      const [{ data: msgs }, { data: bks }] = await Promise.all([
        admin
          .from("messages")
          .select(
            "id, thread_id, sender_type, message_type, template_key, text, payload, created_at",
          )
          .in("thread_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
          .order("created_at", { ascending: false }),
        admin
          .from("bookings")
          .select(
            "id, customer_name, customer_phone, customer_email, scheduled_at, party_size, status, notes",
          )
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
  .inputValidator((d: unknown) => ThreadSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = serviceClient();
    if (!admin) throw new Error("Backend no disponible");

    const { data: thread, error } = await admin
      .from("conversation_threads")
      .select("*")
      .eq("id", data.thread_id)
      .single();
    if (error) throw new Error(error.message);

    const [{ data: messages }, { data: booking }, { data: business }] = await Promise.all([
      admin
        .from("messages")
        .select("*")
        .eq("thread_id", data.thread_id)
        .order("created_at", { ascending: true }),
      admin.from("bookings").select("*").eq("id", thread.booking_id).single(),
      admin.from("businesses").select("id, owner_id, name").eq("id", thread.business_id).single(),
    ]);

    const userId = await currentUserId();
    const allowedForBusiness = (
      await allowedBusinessIds(admin, [thread.business_id], userId)
    ).includes(thread.business_id);
    const allowedForUser =
      (userId && thread.user_id === userId) ||
      tokenMatches(booking, data.access_token) ||
      (data.actor_role === "user" &&
        !thread.user_id &&
        !(booking?.metadata as Record<string, unknown> | null)?.public_access_token);
    const allowedOpenBusiness = data.actor_role === "business" && business?.owner_id === null;

    if (!allowedForUser && !allowedForBusiness && !allowedOpenBusiness) {
      throw new Error("No autorizado");
    }

    return { thread, messages: messages ?? [], booking: booking ?? null, business: business ?? null };
  });

export const listThreadsForUser = createServerFn({ method: "GET" }).handler(async () => {
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
    const bookingIds = (rows ?? []).map((r) => r.booking_id);
    const [{ data: bizs }, { data: bookings }] = await Promise.all([
      supabase
        .from("businesses")
        .select("id, name, address, phone")
        .in("id", bizIds.length ? bizIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("bookings")
        .select("id, status, scheduled_at, customer_name")
        .in("id", bookingIds.length ? bookingIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const map = new Map((bizs ?? []).map((b) => [b.id, b]));
    const bookingsById = new Map((bookings ?? []).map((b) => [b.id, b]));
    return {
      threads: (rows ?? []).map((t) => ({
        ...t,
        business: map.get(t.business_id) ?? null,
        booking: bookingsById.get(t.booking_id) ?? null,
      })),
    };
  } catch (e) {
    console.error("listThreadsForUser failed", e);
    return { threads: [] };
  }
});

const GuestStatusesSchema = z.object({
  items: z
    .array(z.object({ booking_id: uuid, token: z.string().min(8).max(120) }))
    .min(1)
    .max(50),
});

export const listGuestBookingStatuses = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GuestStatusesSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const admin = serviceClient();
      if (!admin) return { items: [] };

      const ids = data.items.map((i) => i.booking_id);
      const { data: bookings } = await admin
        .from("bookings")
        .select("id, status, scheduled_at, business_id, metadata, customer_name")
        .in("id", ids);

      const valid = (bookings ?? []).filter((b) => {
        const tok = data.items.find((i) => i.booking_id === b.id)?.token;
        return tokenMatches(b as { metadata: unknown }, tok);
      });

      const bizIds = [...new Set(valid.map((b) => b.business_id))];
      const { data: bizs } = await admin
        .from("businesses")
        .select("id, name")
        .in("id", bizIds.length ? bizIds : ["00000000-0000-0000-0000-000000000000"]);
      const bizMap = new Map((bizs ?? []).map((b) => [b.id, b]));

      const { data: threads } = await admin
        .from("conversation_threads")
        .select("id, booking_id, status, last_message_at")
        .in("booking_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const threadByBooking = new Map((threads ?? []).map((t) => [t.booking_id, t]));

      return {
        items: valid.map((b) => ({
          booking_id: b.id,
          booking_status: b.status,
          scheduled_at: b.scheduled_at,
          customer_name: b.customer_name ?? null,
          business_name: bizMap.get(b.business_id)?.name ?? null,
          thread: threadByBooking.get(b.id) ?? null,
        })),
      };
    } catch (e) {
      console.error("listGuestBookingStatuses failed", e);
      return { items: [] };
    }
  });
