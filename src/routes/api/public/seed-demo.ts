import { createFileRoute } from "@tanstack/react-router";

// One-shot seeding of demo accounts + a demo etablissement.
// Idempotent: skips users/etablissements that already exist.
// Refuses to run once more than 5 auth users exist (bootstrap-only).

type SeedUser = {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role:
    | "super_admin"
    | "responsable_maintenance"
    | "technicien"
    | "demandeur"
    | "gestionnaire_stock"
    | "prestataire"
    | "responsable_etablissement";
};

const DEMO_USERS: SeedUser[] = [
  {
    email: "responsable@sygma.demo",
    password: "SygmaDemo!2026",
    nom: "Martin",
    prenom: "Claire",
    role: "responsable_maintenance",
  },
  {
    email: "technicien@sygma.demo",
    password: "SygmaDemo!2026",
    nom: "Dupont",
    prenom: "Julien",
    role: "technicien",
  },
  {
    email: "demandeur@sygma.demo",
    password: "SygmaDemo!2026",
    nom: "Petit",
    prenom: "Sophie",
    role: "demandeur",
  },
];

export const Route = createFileRoute("/api/public/seed-demo")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Bootstrap guard.
        const { data: existing, error: listErr } =
          await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 50 });
        if (listErr) {
          return Response.json({ error: listErr.message }, { status: 500 });
        }
        if (existing.users.length > 5) {
          return Response.json(
            { skipped: true, reason: "already-initialized" },
            { status: 200 },
          );
        }

        // Ensure demo etablissement.
        let etabId: string;
        const { data: etab } = await supabaseAdmin
          .from("etablissements")
          .select("id")
          .eq("nom", "Site de démonstration")
          .maybeSingle();
        if (etab) {
          etabId = etab.id;
        } else {
          const { data: created, error } = await supabaseAdmin
            .from("etablissements")
            .insert({
              nom: "Site de démonstration",
              adresse: "1 rue de la Fabrique, 75000 Paris",
              responsable: "Claire Martin",
              contact: "contact@sygma.demo",
            })
            .select("id")
            .single();
          if (error || !created) {
            return Response.json(
              { error: error?.message ?? "etab_create_failed" },
              { status: 500 },
            );
          }
          etabId = created.id;
        }

        const results: Array<{ email: string; created: boolean }> = [];
        for (const u of DEMO_USERS) {
          const existingUser = existing.users.find((x) => x.email === u.email);
          let userId: string;
          if (existingUser) {
            userId = existingUser.id;
            results.push({ email: u.email, created: false });
          } else {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
              email: u.email,
              password: u.password,
              email_confirm: true,
              user_metadata: { nom: u.nom, prenom: u.prenom },
            });
            if (error || !data.user) {
              return Response.json(
                { error: error?.message ?? "user_create_failed" },
                { status: 500 },
              );
            }
            userId = data.user.id;
            results.push({ email: u.email, created: true });
          }

          await supabaseAdmin
            .from("profils_utilisateurs")
            .upsert({ id: userId, nom: u.nom, prenom: u.prenom });

          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: u.role });

          await supabaseAdmin
            .from("utilisateur_etablissements")
            .upsert({ user_id: userId, etablissement_id: etabId });
        }

        return Response.json({ ok: true, users: results, etablissement: etabId });
      },
    },
  },
});
