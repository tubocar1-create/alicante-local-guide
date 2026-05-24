// Real Supabase auth hook for the public app (separate from beta `useAuth`).
import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "public_user" | "business_user" | "admin";

export type AppProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  language: string | null;
  terms_accepted_at: string | null;
  last_seen_at: string | null;
  login_method: string | null;
  blocked: boolean;
};

export function useAppAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setRoles([]);
      return;
    }
    void supabase.rpc("touch_last_seen");
    supabase
      .from("profiles")
      .select(
        "id,email,display_name,full_name,avatar_url,city,language,terms_accepted_at,last_seen_at,login_method,blocked",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile((data as AppProfile) ?? null));
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => setRoles((data ?? []).map((r) => r.role as AppRole)));
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    profile,
    roles,
    isAuthenticated: !!user,
    emailVerified: !!user?.email_confirmed_at,
    isAdmin: roles.includes("admin"),
    isBusiness: roles.includes("business_user") || roles.includes("admin"),
    loading,
    signOut,
  };
}
