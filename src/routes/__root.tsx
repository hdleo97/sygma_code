import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { EtablissementSelector } from "@/components/etablissement-selector";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { createAppQueryClient } from "@/lib/query-client";
import { installSafeFeedback } from "@/lib/feedback";
import { safeErrorSummary } from "@/lib/app-errors";
import { InactivitySession } from "@/components/inactivity-session";
import { toast } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page demandée n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(safeErrorSummary(error));
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur est survenue. Vous pouvez réessayer ou revenir à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accueil
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
      { title: "SYGMA — Système de Gestion de Maintenance Assistée" },
      {
        name: "description",
        content:
          "Application SYGMA pour la gestion de la maintenance industrielle : interventions, équipements, stocks et préventif.",
      },
      { property: "og:title", content: "SYGMA" },
      {
        property: "og:description",
        content: "Application SYGMA pour la maintenance industrielle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: (props) => (
    <ErrorComponent error={props.error as Error} reset={props.reset} />
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
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

// Routes that render outside the authenticated shell.
const PUBLIC_UI_PREFIXES = ["/auth", "/reset-password", "/.lovable.oauth", "/.lovable/oauth"];

function isPublicUiRoute(pathname: string): boolean {
  return PUBLIC_UI_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    installSafeFeedback();
    const rejected = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      toast.error(event.reason);
    };
    window.addEventListener("unhandledrejection", rejected);
    return () => window.removeEventListener("unhandledrejection", rejected);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { loading, session, currentEtablissementId } = useAuth();
  const siteQueryClient = useMemo(() => createAppQueryClient(), [session?.user.id, currentEtablissementId]);
  useEffect(() => () => { void siteQueryClient.cancelQueries(); siteQueryClient.clear(); }, [siteQueryClient]);
  const navigate = useNavigate();
  const isPublic = isPublicUiRoute(pathname);

  useEffect(() => {
    if (!loading && !session && !isPublic) {
      navigate({ to: "/auth", search: { next: pathname }, replace: true });
    }
  }, [loading, session, isPublic, pathname, navigate]);

  if (isPublic) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <QueryClientProvider key={`${session.user.id}:${currentEtablissementId}`} client={siteQueryClient}>
    <InactivitySession />
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="grid h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-card px-4 lg:flex">
            <SidebarTrigger className="shrink-0" />
            <div className="hidden min-w-0 flex-col leading-tight lg:flex">
              <span className="text-sm font-semibold text-foreground">SYGMA</span>
              <span className="text-xs text-muted-foreground">
                Système de Gestion de Maintenance Assistée
              </span>
            </div>
            <div className="ml-auto min-w-0 max-w-full">
              <EtablissementSelector />
            </div>
          </header>
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
    </QueryClientProvider>
  );
}
