// Beta auth: pedimos nombre y datos de contacto opcionales (apellido, email, teléfono)
// y los guardamos en localStorage. Cuando salgamos de beta, esto se reemplaza por
// auth real (Google, email…).
import { useEffect, useState, useCallback } from "react";

const KEY = "beta_user_v1";
const EVT = "beta-user-changed";

export type BetaUser = {
  id: string;
  name: string;
  surname?: string;
  email?: string;
  phone?: string;
  createdAt: string;
};

function read(): BetaUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BetaUser) : null;
  } catch {
    return null;
  }
}

function write(u: BetaUser | null) {
  if (typeof window === "undefined") return;
  if (u) localStorage.setItem(KEY, JSON.stringify(u));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function signInWithName(
  name: string,
  extra?: { surname?: string; email?: string; phone?: string },
): BetaUser {
  const trimmed = name.trim().slice(0, 60);
  const existing = read();
  const merged: BetaUser = existing
    ? {
        ...existing,
        name: trimmed,
        surname: extra?.surname?.trim().slice(0, 60) || existing.surname,
        email: extra?.email?.trim().slice(0, 120) || existing.email,
        phone: extra?.phone?.trim().slice(0, 30) || existing.phone,
      }
    : {
        id:
          (globalThis.crypto?.randomUUID?.() ??
            `beta_${Math.random().toString(36).slice(2, 10)}`),
        name: trimmed,
        surname: extra?.surname?.trim().slice(0, 60) || undefined,
        email: extra?.email?.trim().slice(0, 120) || undefined,
        phone: extra?.phone?.trim().slice(0, 30) || undefined,
        createdAt: new Date().toISOString(),
      };
  write(merged);
  return merged;
}

export function signOutBeta() {
  write(null);
}

export function useAuth() {
  const [user, setUser] = useState<BetaUser | null>(() => read());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(read());
    setLoading(false);
    const onChange = () => setUser(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const signOut = useCallback(async () => {
    signOutBeta();
  }, []);

  return {
    user,
    session: user ? { user } : null,
    loading,
    isAuthenticated: !!user,
    signOut,
  };
}
