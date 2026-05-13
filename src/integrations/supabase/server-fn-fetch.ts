// Browser-only: attach the Supabase access token to /_serverFn/* requests
// so server functions guarded by `requireSupabaseAuth` receive a Bearer token.
import { supabase } from "./client";

if (typeof window !== "undefined" && !(window as any).__serverFnFetchPatched) {
  (window as any).__serverFnFetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url && url.includes("/_serverFn/")) {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      } catch {
        /* fall through */
      }
    }

    return originalFetch(input, init);
  };
}

export {};
