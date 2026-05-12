import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AFP_INITIAL,
  AFP_LABELS,
  AFP_MESSAGES,
  AFP_REWARDS,
  STREAK_WEEKLY_CAP,
  type AfpAction,
  type AfpEntry,
  type AfpState,
  getLevel,
  getNextLevel,
} from "@/lib/afp";

const STORAGE_KEY = "afp_state_v1";

function loadState(): AfpState {
  if (typeof window === "undefined") return AFP_INITIAL;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return AFP_INITIAL;
    const parsed = JSON.parse(raw);
    return { ...AFP_INITIAL, ...parsed };
  } catch {
    return AFP_INITIAL;
  }
}

function saveState(s: AfpState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function weekISO(date = new Date()): string {
  // ISO week (YYYY-Www)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

let listeners = new Set<() => void>();
let memoryState: AfpState = AFP_INITIAL;
let hasHydratedClientState = false;

function hydrateState() {
  if (hasHydratedClientState || typeof window === "undefined") return;
  hasHydratedClientState = true;
  memoryState = loadState();
  listeners.forEach((l) => l());
}

function getState(): AfpState {
  return memoryState;
}

function setState(updater: (s: AfpState) => AfpState) {
  hydrateState();
  const next = updater(getState());
  memoryState = next;
  saveState(next);
  listeners.forEach((l) => l());
}

export function usePoints() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    hydrateState();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const state = getState();

  const award = useCallback((action: AfpAction, opts?: { note?: string; silent?: boolean; uniqueKey?: string }) => {
    const reward = AFP_REWARDS[action];
    const current = getState();

    // Anti-duplicado para friend_invited
    if (action === "friend_invited" && opts?.uniqueKey) {
      if (current.invitedFriends.includes(opts.uniqueKey)) {
        toast.info("Ya sumaste puntos por ese amigo 😉");
        return 0;
      }
    }

    const entry: AfpEntry = {
      id: crypto.randomUUID(),
      action,
      points: reward,
      at: new Date().toISOString(),
      note: opts?.note,
    };

    const beforeLevel = getLevel(current.points);
    const newPoints = current.points + reward;
    const afterLevel = getLevel(newPoints);

    setState((s) => ({
      ...s,
      points: newPoints,
      history: [entry, ...s.history].slice(0, 200),
      invitedFriends:
        action === "friend_invited" && opts?.uniqueKey
          ? [...s.invitedFriends, opts.uniqueKey]
          : s.invitedFriends,
    }));

    if (!opts?.silent) {
      const next = getNextLevel(newPoints);
      const nearMsg = next
        ? `Ya estás más cerca de ser ${next.name} ${next.emoji}`
        : "¡Estás en el top, leyenda! 👑";
      toast.success(`¡+${reward} puntos! ${AFP_MESSAGES[action]}`, {
        description: nearMsg,
        duration: 4500,
      });
      if (afterLevel.id !== beforeLevel.id) {
        setTimeout(() => {
          toast(`🎉 ¡Nuevo nivel: ${afterLevel.name} ${afterLevel.emoji}!`, {
            description: afterLevel.perk,
            duration: 6000,
          });
        }, 600);
      }
    }
    return reward;
  }, []);

  // Streak diario (se ejecuta una vez al montar)
  const ranStreak = useRef(false);
  useEffect(() => {
    if (ranStreak.current) return;
    ranStreak.current = true;
    const s = getState();
    const today = todayISO();
    const wk = weekISO();

    if (s.lastStreakISO === today) return; // ya sumó hoy

    // Reset semanal del cap
    let weekPts = s.weekISO === wk ? s.weekStreakPoints : 0;
    if (weekPts >= STREAK_WEEKLY_CAP) {
      // ya alcanzó el tope, solo actualizar streakDays sin sumar
      const consecutive =
        s.lastStreakISO && diffDays(s.lastStreakISO, today) === 1
          ? s.streakDays + 1
          : 1;
      setState((st) => ({
        ...st,
        streakDays: consecutive,
        lastStreakISO: today,
        weekISO: wk,
        weekStreakPoints: weekPts,
      }));
      return;
    }

    const reward = AFP_REWARDS.streak_day;
    const consecutive =
      s.lastStreakISO && diffDays(s.lastStreakISO, today) === 1
        ? s.streakDays + 1
        : 1;

    const entry: AfpEntry = {
      id: crypto.randomUUID(),
      action: "streak_day",
      points: reward,
      at: new Date().toISOString(),
      note: `Día ${consecutive} de racha`,
    };
    const newPoints = s.points + reward;
    const beforeLevel = getLevel(s.points);
    const afterLevel = getLevel(newPoints);

    setState((st) => ({
      ...st,
      points: newPoints,
      history: [entry, ...st.history].slice(0, 200),
      streakDays: consecutive,
      lastStreakISO: today,
      weekISO: wk,
      weekStreakPoints: weekPts + reward,
    }));

    // Toast de bienvenida con streak (con pequeño retraso para no chocar con el render)
    setTimeout(() => {
      toast.success(`¡+${reward} puntos! Racha de ${consecutive} día${consecutive > 1 ? "s" : ""} 🔥`, {
        description: AFP_MESSAGES.streak_day,
        duration: 4500,
      });
      if (afterLevel.id !== beforeLevel.id) {
        setTimeout(() => {
          toast(`🎉 ¡Nuevo nivel: ${afterLevel.name} ${afterLevel.emoji}!`, {
            description: afterLevel.perk,
            duration: 6000,
          });
        }, 600);
      }
    }, 800);
  }, []);

  const reset = useCallback(() => {
    setState(() => AFP_INITIAL);
    toast("Progreso reiniciado");
  }, []);

  return { ...state, award, reset, AFP_LABELS };
}
