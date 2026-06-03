/**
 * Vectalia / Subus Alicante — real-time bus arrival info.
 *
 * Each bus stop in Alicante has a 4-digit code printed on the stop's QR sticker.
 * The QR resolves to Vectalia's Alicante stop page.
 * which loads the official "Servicio de Información de Tiempo de Paso" page
 * (refreshes every 15s) operated by the Ayuntamiento + Vectalia.
 */

export function liveStopUrl(code: string): string {
  return `http://www.subus.es/QR/Alicante/consulta.aspx?p=${encodeURIComponent(code)}`;
}

export function isValidStopCode(code: string): boolean {
  return /^\d{3,5}$/.test(code.trim());
}
