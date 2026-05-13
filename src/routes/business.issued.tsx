import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { listIssuedQrs } from "@/lib/business/issued-qrs.functions";
import { ArrowLeft, Mail, Phone, User as UserIcon, Clock, Eye, Printer, X, MapPin, Store } from "lucide-react";

export const Route = createFileRoute("/business/issued")({
  component: IssuedQrsPage,
});

type IssuerPayload = {
  issued_by?: string;
  user_id?: string | null;
  user_name?: string | null;
  user_surname?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  issued_at?: string | null;
};

type QrRow = {
  id: string;
  code: string;
  purpose: string;
  created_at: string;
  expires_at: string | null;
  uses: number;
  max_uses: number | null;
  active: boolean;
  payload: IssuerPayload | null;
};

type BusinessInfo = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  opening_hours_json: string | null;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function IssuedQrsPage() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const { data: bizData } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: () => fetchBiz(),
  });
  const primary = bizData?.businesses?.[0];

  const fetchQrs = useServerFn(listIssuedQrs);
  const { data, isLoading } = useQuery({
    queryKey: ["issued-qrs", primary?.id],
    queryFn: () => fetchQrs({ data: { business_id: primary!.id, limit: 100 } }),
    enabled: !!primary,
    refetchInterval: 15000,
  });

  const qrs = (data?.qrs ?? []) as QrRow[];
  const business = (data?.business ?? null) as BusinessInfo | null;
  const [openQr, setOpenQr] = useState<QrRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          to="/business"
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <h1 className="text-xl font-semibold">QR emitidos</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        Lista de QR generados por usuarios para tu negocio. Pulsa un elemento para ver e
        imprimir el código.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!isLoading && qrs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aún no hay QR emitidos.
        </p>
      )}

      <ul className="space-y-2">
        {qrs.map((q) => {
          const p = q.payload ?? {};
          const fullName = [p.user_name, p.user_surname].filter(Boolean).join(" ") || "Anónimo";
          const expired = q.expires_at && new Date(q.expires_at).getTime() < Date.now();
          const used = q.max_uses != null && q.uses >= q.max_uses;
          return (
            <li
              key={q.id}
              className="rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <UserIcon className="h-3.5 w-3.5 text-primary" />
                    {fullName}
                  </p>
                  <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                    {p.user_email && (
                      <p className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {p.user_email}
                      </p>
                    )}
                    {p.user_phone && (
                      <p className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {p.user_phone}
                      </p>
                    )}
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Emitido: {fmtDateTime(p.issued_at ?? q.created_at)}
                    </p>
                    {q.expires_at && (
                      <p className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Caduca: {fmtDateTime(q.expires_at)}
                      </p>
                    )}
                    <p className="font-mono text-foreground/80">{q.code}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {used && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        Usado
                      </span>
                    )}
                    {expired && (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                        Caducado
                      </span>
                    )}
                    {!q.active && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setOpenQr(q)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground"
                >
                  <Eye className="h-3 w-3" /> Ver
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {openQr && <QrModal qr={openQr} business={business} onClose={() => setOpenQr(null)} />}
    </div>
  );
}

function formatHours(json: string | null): Array<[string, string]> {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.entries(v).map(([k, val]) => [
        k,
        typeof val === "string" ? val : JSON.stringify(val),
      ]);
    }
    if (typeof v === "string") return [["Horario", v]];
  } catch {
    return [["Horario", json]];
  }
  return [];
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function QrModal({
  qr,
  business,
  onClose,
}: {
  qr: QrRow;
  business: BusinessInfo | null;
  onClose: () => void;
}) {
  const p = qr.payload ?? {};
  const fullName = [p.user_name, p.user_surname].filter(Boolean).join(" ") || "Anónimo";
  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
        `https://alicante-friend.app/v/${qr.code}`,
      )}`,
    [qr.code],
  );
  const hours = formatHours(business?.opening_hours_json ?? null);

  function handlePrint() {
    const w = window.open("", "_blank", "width=480,height=720");
    if (!w) return;
    const bizBlock = business
      ? `
        <h2>${escapeHtml(business.name)}</h2>
        ${business.phone ? `<p>Tel: ${escapeHtml(business.phone)}</p>` : ""}
        ${business.address ? `<p>${escapeHtml(business.address)}</p>` : ""}
        ${
          hours.length
            ? `<div class="hours"><strong>Horario</strong>${hours
                .map(
                  ([k, v]) =>
                    `<p><span>${escapeHtml(k)}</span>: ${escapeHtml(v)}</p>`,
                )
                .join("")}</div>`
            : ""
        }
        <hr />
      `
      : "";
    w.document.write(`<!doctype html><html><head><title>QR ${qr.code}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; text-align: center; color: #111; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        h2 { font-size: 16px; margin: 4px 0; }
        p { margin: 4px 0; font-size: 13px; color: #444; }
        hr { border: 0; border-top: 1px solid #ddd; margin: 12px 0; }
        .code { font-family: ui-monospace, monospace; font-size: 14px; margin-top: 12px; }
        .hours { margin-top: 6px; font-size: 12px; }
        .hours p { margin: 2px 0; }
        img { margin: 16px auto; display: block; }
      </style></head><body>
      ${bizBlock}
      <h1>${escapeHtml(fullName)}</h1>
      ${p.user_email ? `<p>${escapeHtml(p.user_email)}</p>` : ""}
      ${p.user_phone ? `<p>${escapeHtml(p.user_phone)}</p>` : ""}
      <p>Emitido: ${fmtDateTime(p.issued_at ?? qr.created_at)}</p>
      ${qr.expires_at ? `<p>Caduca: ${fmtDateTime(qr.expires_at)}</p>` : ""}
      <img src="${qrUrl}" width="320" height="320" alt="QR ${qr.code}" />
      <p class="code">${escapeHtml(qr.code)}</p>
      <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-soft max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{fullName}</h3>
            {p.user_email && (
              <p className="text-[11px] text-muted-foreground truncate">{p.user_email}</p>
            )}
            {p.user_phone && (
              <p className="text-[11px] text-muted-foreground">{p.user_phone}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-secondary p-1.5 text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {business && (
          <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-3 text-[11px]">
            <p className="flex items-center gap-1 text-sm font-medium text-foreground">
              <Store className="h-3.5 w-3.5 text-primary" /> {business.name}
            </p>
            <div className="mt-1 space-y-0.5 text-muted-foreground">
              {business.phone && (
                <p className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {business.phone}
                </p>
              )}
              {business.address && (
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {business.address}
                </p>
              )}
              {hours.length > 0 && (
                <div className="mt-1">
                  <p className="flex items-center gap-1 font-medium text-foreground">
                    <Clock className="h-3 w-3" /> Horario
                  </p>
                  <ul className="ml-4 mt-0.5 space-y-0.5">
                    {hours.map(([k, v]) => (
                      <li key={k}>
                        <span className="capitalize">{k}</span>: {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-center">
          <img
            src={qrUrl}
            alt={`QR ${qr.code}`}
            width={240}
            height={240}
            className="rounded-2xl border border-border bg-white p-2"
          />
        </div>

        <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          <p>Código: <span className="font-mono text-foreground">{qr.code}</span></p>
          <p>Emitido: {fmtDateTime(p.issued_at ?? qr.created_at)}</p>
          {qr.expires_at && <p>Caduca: {fmtDateTime(qr.expires_at)}</p>}
        </div>

        <button
          onClick={handlePrint}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-95"
        >
          <Printer className="h-4 w-4" /> Imprimir QR
        </button>
      </div>
    </div>
  );
}
