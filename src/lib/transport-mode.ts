/**
 * Feature flag global para el sistema de buses.
 *
 * Arquitectura híbrida:
 * - PRODUCCIÓN  → "estimated" (ETA calculado desde horarios oficiales offline).
 * - PREVIEW/dev → "realtime"  (consulta.aspx / datos.aspx vía server functions).
 *
 * El modo realtime en preview funciona como LABORATORIO de captura/entrenamiento,
 * no como producción. PREVIEW_CAPTURE_MODE se activa automáticamente cuando el
 * hostname indica preview/dev.
 */
export type TransportMode = "estimated" | "realtime";

const PREVIEW_HOSTS_RE = /(id-preview--|lovableproject\.com|lovable\.app\/dev|localhost|127\.0\.0\.1)/i;

/**
 * True cuando estamos en preview o dev y se permite usar realtime como
 * herramienta experimental de captura.
 */
export function isPreviewCaptureMode(): boolean {
  if (typeof window === "undefined") {
    // SSR: conservador → estimated (producción es el caso mayoritario en SSR).
    return false;
  }
  const host = window.location.hostname || "";
  // Sólo preview de Lovable o local. La producción publicada
  // (alicante-local-guide.lovable.app, vamosalicante.com) NO entra.
  if (host === "alicante-local-guide.lovable.app") return false;
  if (host.endsWith("vamosalicante.com")) return false;
  return PREVIEW_HOSTS_RE.test(host);
}

export function getTransportMode(): TransportMode {
  return isPreviewCaptureMode() ? "realtime" : "estimated";
}

export const isRealtimeMode = () => getTransportMode() === "realtime";
export const isEstimatedMode = () => getTransportMode() === "estimated";

/** Compat: algunos sitios pueden importar `transportMode` como constante. */
export const transportMode: TransportMode =
  typeof window !== "undefined" && isPreviewCaptureMode() ? "realtime" : "estimated";
