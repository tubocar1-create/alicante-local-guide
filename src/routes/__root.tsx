import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { InstallPWA } from "@/components/InstallPWA";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import "@/integrations/supabase/server-fn-fetch";

const PUBLIC_ROUTES = ["/login", "/magic", "/welcome"];
const WELCOMED_KEY = "vamos-welcomed-v1";


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
      { title: "Alicante Friend" },
      { name: "description", content: "Your friendly local AI guide in Alicante, Spain." },
      { name: "author", content: "Alicante Friend" },
      { property: "og:title", content: "Alicante Friend" },
      { property: "og:description", content: "Your friendly local AI guide in Alicante, Spain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Alicante Friend" },
      { name: "twitter:description", content: "Your friendly local AI guide in Alicante, Spain." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/093254f8-3ab2-40aa-af9e-c02f37b4a16e/id-preview-b19d7e32--a8ec37f9-59bf-4ebb-a372-974e51dc0567.lovable.app-1778306557524.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/093254f8-3ab2-40aa-af9e-c02f37b4a16e/id-preview-b19d7e32--a8ec37f9-59bf-4ebb-a372-974e51dc0567.lovable.app-1778306557524.png" },
      { name: "theme-color", content: "#F39021" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Vamos Alicante" },
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Outlet />
      </AuthGate>
      <Toaster />
      <InstallPWA />
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const path = window.location.pathname;
    const isPublic =
      PUBLIC_ROUTES.includes(path) ||
      path.startsWith("/api/") ||
      path.startsWith("/business");
    if (!isAuthenticated && !isPublic) {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error iOS
        window.navigator.standalone === true;
      const welcomed = localStorage.getItem(WELCOMED_KEY) === "1";
      const target = !isStandalone && !welcomed ? "/welcome" : "/login";
      const redirect = encodeURIComponent(path + window.location.search);
      window.location.replace(`${target}?redirect=${redirect}`);
    }
  }, [isAuthenticated, loading]);

  if (typeof window !== "undefined" && !loading && !isAuthenticated) {
    const path = window.location.pathname;
    const isPublic =
      PUBLIC_ROUTES.includes(path) ||
      path.startsWith("/api/") ||
      path.startsWith("/business");
    if (!isPublic) return null;
  }

  return <>{children}</>;
}
