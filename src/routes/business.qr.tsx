import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { createQrCode, listQrCodes } from "@/lib/business/qr.functions";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/business/qr")({
  component: QrPage,
});

function QrPage() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const fetchQrs = useServerFn(listQrCodes);
  const create = useServerFn(createQrCode);
  const qc = useQueryClient();

  const { data: bizData } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: () => fetchBiz(),
  });
  const business = bizData?.businesses[0];

  const { data } = useQuery({
    queryKey: ["qrs", business?.id],
    queryFn: () => fetchQrs({ data: { business_id: business!.id } }),
    enabled: !!business,
  });

  const m = useMutation({
    mutationFn: (purpose: "visit" | "referral" | "promo") =>
      create({ data: { business_id: business!.id, purpose } }),
    onSuccess: () => {
      toast.success("QR creado");
      qc.invalidateQueries({ queryKey: ["qrs", business?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!business)
    return (
      <p className="text-sm text-muted-foreground">Crea primero un negocio.</p>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Códigos QR</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["visit", "referral", "promo"] as const).map((p) => (
          <button
            key={p}
            onClick={() => m.mutate(p)}
            disabled={m.isPending}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="h-3 w-3" /> {p}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {(data?.qrs ?? []).map((q) => (
          <QrItem key={q.id} code={q.code} purpose={q.purpose} uses={q.uses} />
        ))}
        {data?.qrs.length === 0 && (
          <li className="text-sm text-muted-foreground">Sin QR aún.</li>
        )}
      </ul>
    </div>
  );
}

function QrItem({
  code,
  purpose,
  uses,
}: {
  code: string;
  purpose: string;
  uses: number;
}) {
  const [img, setImg] = useState<string>("");
  const url = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/api/public/qr-validate?code=${code}`
        : `/api/public/qr-validate?code=${code}`,
    [code],
  );
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 256 }).then(setImg);
  }, [url]);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      {img ? (
        <img src={img} alt={code} className="h-20 w-20 rounded-md" />
      ) : (
        <div className="h-20 w-20 animate-pulse rounded-md bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {purpose}
        </p>
        <p className="truncate font-mono text-sm">{code}</p>
        <p className="mt-1 text-xs text-muted-foreground">Usos: {uses}</p>
      </div>
    </li>
  );
}
