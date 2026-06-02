# PRE_ESTIMATED_BUS_ENGINE — Checkpoint

Snapshot del sistema realtime Vectalia/Subus antes de migrar a ETA estimado.

**Estado:** deprecated / disabled (bloqueado por Akamai sobre IPs Cloudflare Workers).
**Fecha:** 2026-06-02
**Objetivo:** poder reactivar realtime real cuando dispongamos de VPN/VPS residencial.

Contenido:
- `bus-realtime-client.ts` — cliente browser
- `bus-realtime.functions.ts` — server function fetch consulta.aspx → datos.aspx
- `bus-eta.ts` — helpers ETA
- `route-bus-eta.ts`, `route-bus-datos.ts` — endpoints `/api/public/bus-*`
- `edge-bus-eta*` — edge functions Supabase

NO IMPORTAR desde aquí en código vivo. Estos archivos son referencia histórica.
Los originales en `src/lib/`, `src/routes/api/public/` y `supabase/functions/` siguen
existiendo y se gobiernan vía el feature flag `transportMode` en
`src/lib/transport-mode.ts`.
