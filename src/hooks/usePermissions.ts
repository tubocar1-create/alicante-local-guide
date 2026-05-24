import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BrowserPermission = "geolocation" | "microphone" | "notifications" | "camera";
export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

const LS_PREFIX = "vamos-perm-";

function readLocal(p: BrowserPermission): PermissionState | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(LS_PREFIX + p);
  return (v as PermissionState) || null;
}

function writeLocal(p: BrowserPermission, state: PermissionState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_PREFIX + p, state);
}

async function persistRemote(p: BrowserPermission, granted: boolean) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase
    .from("user_permissions")
    .upsert(
      { user_id: data.user.id, permission: p, granted, updated_at: new Date().toISOString() },
      { onConflict: "user_id,permission" },
    );
}

export function usePermission(permission: BrowserPermission) {
  const [state, setState] = useState<PermissionState>(() => readLocal(permission) ?? "prompt");

  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) {
      setState("unsupported");
      return;
    }
    let canceled = false;
    const name = (
      permission === "microphone" ? "microphone" : permission
    ) as PermissionName;
    navigator.permissions
      .query({ name })
      .then((status) => {
        if (canceled) return;
        const next = status.state as PermissionState;
        setState(next);
        writeLocal(permission, next);
        status.onchange = () => {
          const v = status.state as PermissionState;
          setState(v);
          writeLocal(permission, v);
          void persistRemote(permission, v === "granted");
        };
      })
      .catch(() => setState("unsupported"));
    return () => {
      canceled = true;
    };
  }, [permission]);

  const request = useCallback(async () => {
    try {
      if (permission === "geolocation") {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            (err) => reject(err),
            { timeout: 8000 },
          );
        });
        setState("granted");
        writeLocal(permission, "granted");
        void persistRemote(permission, true);
        return "granted" as const;
      }
      if (permission === "microphone") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setState("granted");
        writeLocal(permission, "granted");
        void persistRemote(permission, true);
        return "granted" as const;
      }
      if (permission === "notifications" && "Notification" in window) {
        const res = await Notification.requestPermission();
        const next: PermissionState = res === "granted" ? "granted" : res === "denied" ? "denied" : "prompt";
        setState(next);
        writeLocal(permission, next);
        void persistRemote(permission, next === "granted");
        return next;
      }
      return state;
    } catch {
      setState("denied");
      writeLocal(permission, "denied");
      void persistRemote(permission, false);
      return "denied" as const;
    }
  }, [permission, state]);

  const dismiss = useCallback(() => {
    writeLocal(permission, "denied");
    setState("denied");
    void persistRemote(permission, false);
  }, [permission]);

  return { state, request, dismiss };
}
