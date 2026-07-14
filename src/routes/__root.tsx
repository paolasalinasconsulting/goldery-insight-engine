import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { useAuth } from "@/hooks/useAuth";
import { pullFromCloud, pushToCloud, startAutoSync, stopAutoSync } from "@/lib/goldery/sync";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Sidebar } from "@/components/goldery/Sidebar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">La ruta solicitada no existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Ir al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Esta página no cargó</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Reintentar
          </button>
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
      { title: "Category IQ · Category Intelligence Platform by Goldery" },
      { name: "description", content: "Convierte data de autoservicio en decisiones de portafolio, precio, empaque y oportunidad." },
      { name: "author", content: "Goldery" },
      { property: "og:title", content: "Category IQ · Category Intelligence by Goldery" },
      { property: "og:description", content: "Centro de comando de categoría: dónde competir, con qué tamaño, precio, marca y claim." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    const isChunkLoadError = (value: unknown) => {
      const message = value instanceof Error ? value.message : String(value ?? "");
      return message.includes("Failed to fetch dynamically imported module") || message.includes("Importing a module script failed");
    };
    const reloadOnce = () => {
      const key = "category-iq-chunk-reload-attempted";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) reloadOnce();
    };
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) reloadOnce();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthRoute = location.pathname === "/auth";

  // Redirect unauthenticated users to /auth
  useEffect(() => {
    if (!loading && !user && !isAuthRoute) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, isAuthRoute, navigate]);

  // Sync: pull on sign-in, push on sign-out
  useEffect(() => {
    if (!user) { stopAutoSync(); return; }
    let cancelled = false;
    (async () => {
      const res = await pullFromCloud(user.id);
      if (cancelled) return;
      // Si la nube está vacía, subimos el snapshot local actual como primer estado
      if (res === "empty") await pushToCloud(user.id);
      startAutoSync(user.id);
    })();
    return () => { cancelled = true; stopAutoSync(); };
  }, [user?.id]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Cargando…</div>;
  }
  if (isAuthRoute || !user) {
    return <Outlet />;
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 bg-background">
        <Outlet />
      </main>
    </div>
  );
}
