import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "SYGMA — Réinitialisation du mot de passe" },
      {
        name: "description",
        content: "Définir un nouveau mot de passe pour votre compte SYGMA.",
      },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase parses the hash and emits PASSWORD_RECOVERY / SIGNED_IN.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      return setError("Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (password !== confirm) {
      return setError("Les mots de passe ne correspondent pas.");
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/" }), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Définissez le nouveau mot de passe de votre compte SYGMA.
        </p>

        {!ready ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification du lien de réinitialisation…
          </div>
        ) : done ? (
          <p className="mt-6 text-sm text-foreground">
            Mot de passe mis à jour. Redirection…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label
                className="text-xs font-medium text-foreground"
                htmlFor="password"
              >
                Nouveau mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label
                className="text-xs font-medium text-foreground"
                htmlFor="confirm"
              >
                Confirmation
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
