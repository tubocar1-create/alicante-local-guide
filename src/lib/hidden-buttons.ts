// Registro central de botones que están ocultos en producción (https publicada)
// pero visibles en preview / sandbox / localhost.
//
// Sirve dos propósitos:
//  1. Exponer `isPreviewHost()` para que los componentes decidan si renderizar.
//  2. Proveer un catálogo (`HIDDEN_BUTTONS`) que el panel admin lista
//     en /admin/botones-ocultos para que el equipo sepa qué está oculto y dónde.

export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true; // SSR: render por defecto
  const h = window.location.hostname;
  return (
    h.includes("preview") ||
    h === "localhost" ||
    h.startsWith("127.") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovable.dev")
  );
}

export type HiddenButton = {
  id: string;
  label: string;
  location: string; // dónde vive en la UI
  file: string; // archivo donde se aplica el ocultamiento
  reason: string;
};

export const HIDDEN_BUTTONS: HiddenButton[] = [
  {
    id: "home-notificaciones",
    label: "Notificaciones (campana)",
    location: "Pantalla principal · cabecera",
    file: "src/components/ChatScreen.tsx",
    reason: "Funcionalidad de notificaciones aún no lista para producción.",
  },
  {
    id: "transporte-buses-larga-distancia",
    label: "Buses larga distancia",
    location: "Transporte multimodal inteligente · submenú",
    file: "src/components/ChatScreen.tsx",
    reason: "Pendiente de integración con datos en vivo (ALSA, Vectalia).",
  },
  {
    id: "transporte-tren",
    label: "Tren",
    location: "Transporte multimodal inteligente · submenú",
    file: "src/components/ChatScreen.tsx",
    reason: "Pendiente de integración con horarios Renfe/Cercanías.",
  },
  {
    id: "transporte-taxis",
    label: "Taxis, Uber, Cabify",
    location: "Transporte multimodal inteligente · submenú",
    file: "src/components/ChatScreen.tsx",
    reason: "Pendiente de integración con apps de movilidad.",
  },
];
