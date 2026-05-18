// Beta auth respaldada por la tabla `test_users` en Supabase.
// Email = usuario. Si el email existe -> login. Si no, se requieren
// nombre + apellido y se crea un nuevo test_user.
// Cuando lancemos, se reemplazará por auth real (Supabase Auth).
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Iniciar sesión o registrarse con email.
 * - Si el email existe en `test_users` -> login (devuelve el usuario).
 * - Si NO existe y se proveen name+surname -> registro (inserta y devuelve).
 * - Si no existe y faltan datos -> lanza Error("SIGNUP_REQUIRED").
 */
export async function signInOrSignUp(input: {
  email: string;
  name?: string;
  surname?: string;
}): Promise<BetaUser> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email requerido");

  const { data: existing, error: selErr } = await supabase
    .from("test_users")
    .select("id, name, surname, email, created_at")
    .eq("email", email)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing) {
    const user: BetaUser = {
      id: existing.id,
      name: existing.name,
      surname: existing.surname ?? undefined,
      email: existing.email ?? undefined,
      createdAt: existing.created_at,
    };
    write(user);
    return user;
  }

  const name = input.name?.trim() ?? "";
  const surname = input.surname?.trim() ?? "";
  if (name.length < 2 || surname.length < 2) {
    throw new Error("SIGNUP_REQUIRED");
  }

  const { data: created, error: insErr } = await supabase
    .from("test_users")
    .insert({ name, surname, email })
    .select("id, name, surname, email, created_at")
    .single();

  if (insErr || !created) throw insErr ?? new Error("No se pudo crear el usuario");

  const user: BetaUser = {
    id: created.id,
    name: created.name,
    surname: created.surname ?? undefined,
    email: created.email ?? undefined,
    createdAt: created.created_at,
  };
  write(user);
  return user;
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
