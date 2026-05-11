// Almacenamiento local de QR generados para la beta (sin backend).
// Cuando exista la app de locales con validación real, migraremos a Supabase.

export type QrStatus = "active" | "used" | "expired";

export type LocalQr = {
  id: string;
  user_id: string;
  place_id: string;
  place_name: string;
  code: string;
  status: QrStatus;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
};

const KEY = "beta_qrs_v1";
const EVT = "beta-qrs-changed";

function read(): LocalQr[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as LocalQr[];
  } catch {
    return [];
  }
}

function write(list: LocalQr[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

export function listQrs(userId: string): LocalQr[] {
  return read()
    .filter((q) => q.user_id === userId)
    .map((q) => {
      if (
        q.status === "active" &&
        q.expires_at &&
        new Date(q.expires_at) < new Date()
      ) {
        return { ...q, status: "expired" as QrStatus };
      }
      return q;
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function sameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function findTodayQr(userId: string, placeId: string): LocalQr | null {
  const today = new Date();
  return (
    read().find(
      (q) =>
        q.user_id === userId &&
        q.place_id === placeId &&
        sameLocalDay(q.created_at, today)
    ) ?? null
  );
}

export function addQr(qr: LocalQr) {
  const list = read();
  list.push(qr);
  write(list);
}

export function subscribeQrs(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}
