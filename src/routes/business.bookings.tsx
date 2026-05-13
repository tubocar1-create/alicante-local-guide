import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listMyBusinesses } from "@/lib/business/business.functions";
import {
  listBookings,
  updateBookingStatus,
} from "@/lib/business/bookings.functions";

export const Route = createFileRoute("/business/bookings")({
  component: BookingsPage,
});

const STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

function BookingsPage() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const fetchBookings = useServerFn(listBookings);
  const update = useServerFn(updateBookingStatus);
  const qc = useQueryClient();

  const { data: bizData } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: () => fetchBiz(),
  });
  const business = bizData?.businesses[0];

  const { data } = useQuery({
    queryKey: ["bookings", business?.id],
    queryFn: () => fetchBookings({ data: { business_id: business!.id } }),
    enabled: !!business,
  });

  const m = useMutation({
    mutationFn: (v: { id: string; status: (typeof STATUSES)[number] }) =>
      update({ data: v }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["bookings", business?.id] });
    },
  });

  if (!business)
    return <p className="text-sm text-muted-foreground">Crea primero un negocio.</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Reservas</h1>
      <ul className="space-y-2">
        {(data?.bookings ?? []).map((b) => (
          <li key={b.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {b.customer_name ?? "Cliente"} · {b.party_size}p
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.scheduled_at).toLocaleString()}
                </p>
                {b.notes && <p className="mt-1 text-xs">{b.notes}</p>}
              </div>
              <select
                value={b.status}
                onChange={(e) =>
                  m.mutate({ id: b.id, status: e.target.value as never })
                }
                className="rounded-full border border-border bg-background px-2 py-1 text-xs"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </li>
        ))}
        {data?.bookings.length === 0 && (
          <li className="text-sm text-muted-foreground">Sin reservas todavía.</li>
        )}
      </ul>
    </div>
  );
}
