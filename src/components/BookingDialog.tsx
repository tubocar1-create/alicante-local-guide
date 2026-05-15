import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Loader2, Users, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/overpass-listings";

const LOCAL_BOOKINGS_KEY = "local_booking_threads_v1";

type Props = {
  listing: Listing;
  onClose: () => void;
};

function defaultDateTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function saveLocalBooking(entry: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(localStorage.getItem(LOCAL_BOOKINGS_KEY) || "[]");
    const next = [entry, ...(Array.isArray(current) ? current : [])].slice(0, 20);
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(next));
  } catch {
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify([entry]));
  }
}

export default function BookingDialog({ listing, onClose }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [when, setWhen] = useState(defaultDateTime());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Indica un nombre");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      const res = await fetch("/api/public/booking-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          place: {
            osm_id: String(listing.id),
            name: listing.name,
            lat: listing.lat,
            lng: listing.lon,
            kind: listing.kind,
            address: listing.address,
            phone: listing.phone,
            website: listing.website,
          },
          scheduled_at: new Date(when).toISOString(),
          party_size: partySize,
          customer_name: name.trim().slice(0, 120),
          customer_phone: phone.trim() ? phone.trim().slice(0, 40) : undefined,
          notes: notes.trim() ? notes.trim().slice(0, 500) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error al reservar");
      saveLocalBooking({
        id: json.thread_id || json.id,
        booking_id: json.id,
        access_token: json.access_token,
        business_name: listing.name,
        status: json.status || "pending",
        scheduled_at: new Date(when).toISOString(),
        party_size: partySize,
        customer_name: name.trim().slice(0, 120),
        created_at: new Date().toISOString(),
      });
      onClose();
      if (json.thread_id && userId) {
        navigate({ to: "/threads/$id", params: { id: json.thread_id } });
      } else {
        navigate({ to: "/threads" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/95 backdrop-blur-md sm:items-center">
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl max-h-[90svh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-muted active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-display text-lg font-semibold">Reservar</h2>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{listing.name}</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> Fecha y hora
            </span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              required
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Users className="h-3 w-3" /> Personas
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value) || 1)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Tu nombre
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Teléfono (opcional)
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Notas (opcional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirmar reserva
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          El negocio recibirá tu reserva y podrás coordinar en el hilo.
        </p>
      </form>
    </div>,
    document.body,
  );
}
