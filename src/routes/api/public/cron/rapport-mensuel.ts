import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";

import { VISITES_SELECT, moisPrecedent, visitesToRows, type VisiteRow } from "@/lib/rapports-format";

/**
 * Appelé par la tâche planifiée le 1er de chaque mois : compile les visites
 * quotidiennes du mois écoulé, un classeur par établissement.
 * Idempotent : ne régénère pas un mois déjà compilé.
 */
export const Route = createFileRoute("/api/public/cron/rapport-mensuel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!key || request.headers.get("apikey") !== key) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const m = moisPrecedent();
        const db = supabaseAdmin as unknown as { from: (t: string) => any };

        const { data: etabs, error: e1 } = await db.from("etablissements").select("id, nom");
        if (e1) return new Response(e1.message, { status: 500 });

        let crees = 0;
        for (const etab of (etabs ?? []) as { id: string; nom: string }[]) {
          const { data: deja } = await db
            .from("rapports_generes")
            .select("id")
            .eq("type", "mensuel_preventif")
            .eq("etablissement_id", etab.id)
            .eq("periode_debut", m.debut)
            .limit(1);
          if (deja && deja.length > 0) continue;

          const { data: visites, error } = await db
            .from("visites_quotidiennes")
            .select(VISITES_SELECT)
            .eq("etablissement_id", etab.id)
            .gte("date_visite", `${m.debut}T00:00:00Z`)
            .lte("date_visite", `${m.fin}T23:59:59Z`)
            .order("date_visite");
          if (error) return new Response(error.message, { status: 500 });

          const rows = visitesToRows((visites ?? []) as VisiteRow[]);
          const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "Aucune visite sur la période" }]);
          const book = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(book, sheet, "Visites");
          const buf = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
          const path = `system/${m.debut}-${etab.id}.xlsx`;
          const up = await supabaseAdmin.storage.from("rapports").upload(path, new Uint8Array(buf), {
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            upsert: true,
          });
          if (up.error) return new Response(up.error.message, { status: 500 });

          await db.from("rapports_generes").insert({
            type: "mensuel_preventif",
            titre: `Rapport mensuel des visites quotidiennes — ${m.label} — ${etab.nom}`,
            filtres: { source: "visites", du: m.debut, au: m.fin, etablissement: etab.id },
            format: "xlsx",
            fichier_path: path,
            etablissement_id: etab.id,
            periode_debut: m.debut,
            periode_fin: m.fin,
            genere_par: null,
          });
          crees++;
        }
        return Response.json({ ok: true, mois: m.label, rapports: crees });
      },
    },
  },
});
