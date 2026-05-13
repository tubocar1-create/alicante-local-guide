import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listMyBusinesses } from "@/lib/business/business.functions";
import {
  generateReferral,
  listReferrals,
} from "@/lib/business/referrals.functions";
import { Plus, Copy } from "lucide-react";

export const Route = createFileRoute("/business/referrals")({
  component: ReferralsPage,
});

function ReferralsPage() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const fetchRefs = useServerFn(listReferrals);
  const gen = useServerFn(generateReferral);
  const qc = useQueryClient();

  const { data: bizData } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: () => fetchBiz(),
  });
  const business = bizData?.businesses[0];

  const { data } = useQuery({
    queryKey: ["referrals", business?.id],
    queryFn: () => fetchRefs({ data: { business_id: business!.id } }),
    enabled: !!business,
  });

  const m = useMutation({
    mutationFn: () => gen({ data: { business_id: business!.id } }),
    onSuccess: () => {
      toast.success("Referral creado");
      qc.invalidateQueries({ queryKey: ["referrals", business?.id] });
    },
  });

  if (!business)
    return <p className="text-sm text-muted-foreground">Crea primero un negocio.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Referrals</h1>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> Nuevo
        </button>
      </div>
      <ul className="space-y-2">
        {(data?.referrals ?? []).map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
          >
            <div>
              <p className="font-mono text-sm">{r.code}</p>
              <p className="text-xs text-muted-foreground">
                {r.status} · {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/?ref=${r.code}`,
                );
                toast.success("Enlace copiado");
              }}
              className="rounded-full border border-border p-2"
              aria-label="Copiar enlace"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {data?.referrals.length === 0 && (
          <li className="text-sm text-muted-foreground">Sin referrals todavía.</li>
        )}
      </ul>
    </div>
  );
}
