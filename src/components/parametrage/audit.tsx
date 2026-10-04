import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/parametrage";

type Log = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  details: unknown;
  created_at: string;
};

export function JournalAudit() {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [table, setTable] = useState("");
  const [qtext, setQtext] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", du, au],
    queryFn: async (): Promise<Log[]> => {
      let q = db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (du) q = q.gte("created_at", du);
      if (au) q = q.lte("created_at", `${au}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: profils } = useQuery({
    queryKey: ["audit-profils"],
    queryFn: async () => {
      const { data } = await db.from("profils_utilisateurs").select("id, nom, prenom");
      return new Map<string, string>(
        (data ?? []).map((p: { id: string; nom: string | null; prenom: string | null }) => [
          p.id,
          [p.prenom, p.nom].filter(Boolean).join(" "),
        ]),
      );
    },
  });

  const tables = useMemo(() => [...new Set((logs ?? []).map((l) => l.table_name))].sort(), [logs]);
  const filtered = (logs ?? []).filter((l) => {
    if (table && l.table_name !== table) return false;
    if (qtext) {
      const who = (l.user_id && profils?.get(l.user_id)) || "";
      const hay = `${who} ${l.action} ${JSON.stringify(l.details)}`.toLowerCase();
      if (!hay.includes(qtext.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="w-40" />
        <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="w-40" />
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Tous les objets</option>
          {tables.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Input placeholder="Rechercher…" value={qtext} onChange={(e) => setQtext(e.target.value)} className="w-56" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Quand</th>
              <th className="px-4 py-3">Qui</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Objet</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-muted-foreground">Chargement…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-muted-foreground">Aucune entrée.</td></tr>
            )}
            {filtered.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2">
                    {new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2">{(l.user_id && profils?.get(l.user_id)) || "Système"}</td>
                  <td className="px-4 py-2">{l.action}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.table_name}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpen(open === l.id ? null : l.id)}>
                      Détails
                    </Button>
                  </td>
                </tr>
                {open === l.id && (
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={5} className="px-4 py-2">
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                        {JSON.stringify(l.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
