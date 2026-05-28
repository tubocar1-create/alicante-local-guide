// Helper isomórfico (browser + server) para construir la URL del proxy de fotos
// de Google Places. NO hace ninguna llamada a Google: solo construye la URL.
//
// Uso: <img src={googlePhotoUrl("places/ChIJ.../photos/AeJbb...", 600)} />
//
// El proxy real está en src/routes/api/public/google-photo.$.ts y resuelve
// (1 vez por foto+anchura, para siempre) la imagen contra Storage.

export function googlePhotoUrl(photoName: string | null | undefined, widthPx = 800): string | null {
  if (!photoName) return null;
  if (!photoName.startsWith("places/")) return null;
  const w = Math.min(Math.max(Math.round(widthPx), 80), 1600);
  return `/api/public/google-photo/${photoName}?w=${w}`;
}
