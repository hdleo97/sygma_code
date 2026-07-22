import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "SYGMA — Accueil" },
      {
        name: "description",
        content: "Application SYGMA en cours de construction.",
      },
    ],
  }),
});

function Index() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health_check"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_check")
        .select("id, status")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ok = !!data && !isError;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">SYGMA</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Application en cours de construction
        </p>

        <div className="mt-8 rounded-lg border border-border bg-muted/40 p-4">
          {isLoading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Vérification de la connexion à la base de données…</span>
            </div>
          ) : ok ? (
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Connexion base de données : OK</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm font-medium text-destructive">
              <XCircle className="h-5 w-5" />
              <span>Connexion base de données : échec</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
