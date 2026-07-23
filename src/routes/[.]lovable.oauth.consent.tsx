import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type AuthorizationDetails = {
  client?: { name?: string; client_id?: string } | null;
  redirect_uri?: string | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type SupabaseAuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
function authOAuth(): SupabaseAuthOAuth {
  return (supabase.auth as unknown as { oauth: SupabaseAuthOAuth }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Paramètre authorization_id manquant.");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId =
      new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await authOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return data;
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="max-w-md rounded-xl border border-destructive/40 bg-card p-6 text-sm">
        <h1 className="text-base font-semibold">Impossible de charger cette autorisation</h1>
        <p className="mt-2 text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error } = approve
      ? await authOAuth().approveAuthorization(authorization_id)
      : await authOAuth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(null);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("Aucune URL de redirection renvoyée par le serveur d'autorisation.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "une application";
  const scope = details?.scope ?? "";

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          Connecter {clientName} à SYGMA
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} pourra appeler les outils MCP de SYGMA en votre nom, avec les mêmes
          droits d'accès que dans l'application.
        </p>

        {details?.redirect_uri && (
          <p className="mt-4 text-xs text-muted-foreground">
            URL de redirection : <span className="font-mono">{details.redirect_uri}</span>
          </p>
        )}
        {scope && (
          <p className="mt-1 text-xs text-muted-foreground">
            Portée demandée : <span className="font-mono">{scope}</span>
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Cela ne contourne pas les règles d'accès de SYGMA.
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide(true)}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Autoriser
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide(false)}
            className="inline-flex flex-1 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy === "deny" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refuser
          </button>
        </div>
      </div>
    </main>
  );
}
