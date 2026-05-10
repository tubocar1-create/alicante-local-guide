// Alicante Friend Points (AFP) — gamification core.
// Frontend-only for now (localStorage). When backend acuerdos arrive,
// move history + redemptions to Supabase.

export type AfpAction =
  | "qr_generated"
  | "qr_confirmed"
  | "itinerary_done"
  | "review_left"
  | "streak_day"
  | "friend_invited";

export const AFP_REWARDS: Record<AfpAction, number> = {
  qr_generated: 20,
  qr_confirmed: 80,
  itinerary_done: 40,
  review_left: 35,
  streak_day: 25,
  friend_invited: 150,
};

export const AFP_LABELS: Record<AfpAction, string> = {
  qr_generated: "Generaste un QR de referral",
  qr_confirmed: "El local confirmó tu visita",
  itinerary_done: "Completaste un itinerario",
  review_left: "Dejaste una reseña honesta",
  streak_day: "Racha diaria en la app",
  friend_invited: "Un amigo se unió por tu invitación",
};

export const AFP_MESSAGES: Record<AfpAction, string> = {
  qr_generated: "¡QR listo! Enséñalo en el local para sumar más puntos 🔥",
  qr_confirmed: "¡Brutal! El local confirmó tu visita. Estás más cerca de Alicante Legend 🚀",
  itinerary_done: "¡Plan completado! De puta madre, sigue así 💪",
  review_left: "Gracias por la reseña honesta, tío. Eso ayuda un montón 🙌",
  streak_day: "¡Racha activa! Vuelve mañana para sumar más 🔥",
  friend_invited: "¡Tu colega se ha unido! Ese es el regalo más grande 🎉",
};

export const STREAK_WEEKLY_CAP = 100; // máx 4 días de streak por semana ISO

export type AfpLevel = {
  id: 1 | 2 | 3 | 4;
  name: string;
  min: number;
  max: number; // Infinity para el último
  perk: string;
  emoji: string;
};

export const AFP_LEVELS: AfpLevel[] = [
  {
    id: 1,
    name: "Alicante Friend",
    min: 0,
    max: 600,
    perk: "Recomendaciones locales y plan personalizado",
    emoji: "👋",
  },
  {
    id: 2,
    name: "Local Insider",
    min: 601,
    max: 2000,
    perk: "Acceso a más hidden gems y sitios exclusivos",
    emoji: "🕶️",
  },
  {
    id: 3,
    name: "Alicante Legend",
    min: 2001,
    max: 4500,
    perk: "Recomendaciones prioritarias + modo Ultra Local",
    emoji: "🔥",
  },
  {
    id: 4,
    name: "Alicante VIP",
    min: 4501,
    max: Infinity,
    perk: "Sugiere nuevos locales y mayor peso en las stats",
    emoji: "👑",
  },
];

export function getLevel(points: number): AfpLevel {
  return AFP_LEVELS.find((l) => points >= l.min && points <= l.max) ?? AFP_LEVELS[0];
}

export function getNextLevel(points: number): AfpLevel | null {
  const current = getLevel(points);
  return AFP_LEVELS.find((l) => l.id === current.id + 1) ?? null;
}

export function getLevelProgress(points: number): {
  level: AfpLevel;
  next: AfpLevel | null;
  pctToNext: number;
  remaining: number;
} {
  const level = getLevel(points);
  const next = getNextLevel(points);
  if (!next) return { level, next: null, pctToNext: 100, remaining: 0 };
  const span = next.min - level.min;
  const pos = points - level.min;
  return {
    level,
    next,
    pctToNext: Math.min(100, Math.max(0, Math.round((pos / span) * 100))),
    remaining: Math.max(0, next.min - points),
  };
}

export type AfpEntry = {
  id: string;
  action: AfpAction;
  points: number;
  at: string; // ISO
  note?: string;
};

export type AfpState = {
  points: number;
  history: AfpEntry[];
  streakDays: number; // racha consecutiva actual
  lastStreakISO: string | null; // último día que se sumó streak
  weekISO: string | null; // semana ISO YYYY-Www en la que se llevan puntos de streak
  weekStreakPoints: number; // puntos de streak ya ganados esta semana
  invitedFriends: string[]; // ids de amigos invitados (anti-duplicado)
};

export const AFP_INITIAL: AfpState = {
  points: 0,
  history: [],
  streakDays: 0,
  lastStreakISO: null,
  weekISO: null,
  weekStreakPoints: 0,
  invitedFriends: [],
};
