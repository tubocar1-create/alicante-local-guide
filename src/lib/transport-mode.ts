/**
 * Feature flag global para el sistema de buses.
 *
 * - "estimated": ETA calculado desde horarios oficiales Vectalia (modo activo,
 *   por bloqueo Akamai sobre IPs de Cloudflare Workers).
 * - "realtime": fetch directo a consulta.aspx/datos.aspx (Subus/Vectalia).
 *   Preservado en `src/legacy/realtime/` + archivos originales. Reactivable
 *   cuando dispongamos de VPN/VPS residencial.
 *
 * Cambiar SOLO aquí. Toda la UI lee este flag.
 */
export type TransportMode = "estimated" | "realtime";

export const transportMode = "estimated" as TransportMode;

export const isRealtimeMode = () => transportMode === "realtime";
export const isEstimatedMode = () => transportMode === "estimated";
