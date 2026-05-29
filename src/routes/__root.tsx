import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  ScriptOnce,
} from "@tanstack/react-router";
import { InstallPWA } from "@/components/InstallPWA";
import { AgenteVamosFab } from "@/components/AgenteVamos";
import { AppVersionWatcher } from "@/components/AppVersionWatcher";
import { DesktopShell } from "@/components/DesktopShell";



import { useEffect } from "react";
import { AuthPromptDialog } from "@/components/AuthPrompt";

import appCss from "../styles.css?url";
import "@/integrations/supabase/server-fn-fetch";

// Stable per server/worker boot — changes on every deploy. Used by
// AppVersionWatcher to silently reload tabs running an old bundle.
const APP_VERSION = String(Date.now());



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    const msg = String(error?.message ?? "");
    const isChunkError =
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
    if (isChunkError && typeof window !== "undefined") {
      const KEY = "vamos-chunk-reload-at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 5000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Alicante Friend" },
      { name: "app-version", content: APP_VERSION },
      { property: "og:site_name", content: "Alicante Friend" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#F39021" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Vamos Alicante" },
      { name: "google-site-verification", content: "QsNkwC2wgqZPOSUKY80yKrSibd7TOHZy3C_CzK5jXvM" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito:wght@400;500;600;700&family=Quicksand:wght@700&display=swap",
      },
    ],
    scripts: [
      {
        src: "https://www.googletagmanager.com/gtag/js?id=AW-18186927022",
        async: true,
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Track de page_view en cada cambio de ruta (telemetría operacional)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path.startsWith("/admin")) return;
    void import("@/lib/operations/trackOperationalEvent").then(
      ({ trackOperationalEvent }) => {
        trackOperationalEvent({ type: "page_view", route: path });
      },
    );
  }, [router.state.location.pathname]);

  // Heartbeat de sesión: registra un evento cada 10s durante el primer
  // minuto y después cada 30s mientras la pestaña está visible. Un evento
  // final se envía al cerrarla. Sin esto, las sesiones de un solo page_view
  // duran 0 segundos porque start_at == end_at.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return;

    const ping = (type: "session_heartbeat" | "session_end") => {
      void import("@/lib/operations/trackOperationalEvent").then(
        ({ trackOperationalEvent }) => {
          trackOperationalEvent({ type, route: window.location.pathname });
        },
      );
    };

    let interval = window.setInterval(() => {
      if (document.visibilityState === "visible") ping("session_heartbeat");
    }, 10_000);

    const transitionTimer = window.setTimeout(() => {
      window.clearInterval(interval);
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") ping("session_heartbeat");
      }, 30_000);
    }, 60_000);

    const onHide = () => ping("session_end");
    window.addEventListener("pagehide", onHide);

    return () => {
      window.clearTimeout(transitionTimer);
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ScriptOnce
        children={`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-18186927022');`}
      />
      <DesktopShell>
        <Outlet />
      </DesktopShell>
      <Toaster />
      <InstallPWA />
      <AgenteVamosFab />
      <AppVersionWatcher />
      <AuthPromptDialog />
    </QueryClientProvider>
  );
}

