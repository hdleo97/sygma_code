import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, useReferentiels } from "@/lib/parametrage";
import { PHASES } from "@/lib/rapport-phases";

type Op = {
  id: string;
  phase: number;
  categorie_equipement: string | null;
  libelle: string;
  ordre: number;
  actif: boolean;
};

const TOUTES = "__toutes__";
const err = (e: unknown) =>
  toast.error(e instanceof Error ? e.message : "Action impossible");

export function ParametrageChecklists() {
  const qc = useQueryClient();
  const { data: refs } = useReferentiels();
  const { data: ops } = useQuery({
    queryKey: ["checklist-admin"],
    queryFn: async (): Promise<Op[]> => {
      const { data, error } = await db
        .from("checklist_operations")
        .select("id, phase, categorie_equipement, libelle, ordre, actif")
        .order("phase")
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const s = new Set<string>();
    (refs ?? [])
      .filter((r) => r.type === "categorie_equipement")
      .forEach((r) => s.add(r.libelle));
    (ops ?? []).forEach((o) => o.categorie_equipement && s.add(o.categorie_equipement));
    return [...s].sort();
  }, [refs, ops]);

  const [cat, setCat] = useState<string>(TOUTES);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const catValue = cat === TOUTES ? null : cat;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["checklist-admin"] });

  const add = useMutation({
    mutationFn: async (phase: number) => {
      const libelle = (drafts[phase] ?? "").trim();
      const max = Math.max(
        0,
        ...(ops ?? [])
          .filter((o) => o.phase === phase && o.categorie_equipement === catValue)
          .map((o) => o.ordre),
      );
      const { error } = await db.from("checklist_operations").insert({
        phase,
        categorie_equipement: catValue,
        libelle,
        ordre: max + 1,
      });
      if (error) throw error;
      setDrafts((d) => ({ ...d, [phase]: "" }));
    },
    onSuccess: refresh,
    onError: err,
  });
  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Partial<Op> }) => {
      const { error } = await db
        .from("checklist_operations")
        .update(p.patch)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: err,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("checklist_operations").delete().eq("id", id);
      if (error)
        throw new Error(
          "Suppression impossible (opération déjà utilisée dans un rapport). Désactivez-la plutôt.",
        );
    },
    onSuccess: refresh,
    onError: err,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Catégorie d'équipement :</span>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUTES}>Toutes catégories (générique)</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {PHASES.map((p) => {
          const list = (ops ?? []).filter(
            (o) => o.phase === p.value && o.categorie_equipement === catValue,
          );
          return (
            <div key={p.value} className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 font-semibold text-foreground">
                {p.value}. {p.label}
              </h3>
              <ul className="mb-3 space-y-2">
                {list.length === 0 && (
                  <li className="text-sm text-muted-foreground">Aucune opération.</li>
                )}
                {list.map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <Input
                      defaultValue={o.libelle}
                      className={o.actif ? "" : "opacity-50"}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== o.libelle)
                          update.mutate({ id: o.id, patch: { libelle: v } });
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ id: o.id, patch: { actif: !o.actif } })}
                    >
                      {o.actif ? "Actif" : "Inactif"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        window.confirm("Supprimer cette opération ?") && remove.mutate(o.id)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={drafts[p.value] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [p.value]: e.target.value }))
                  }
                  placeholder="Nouvelle opération"
                />
                <Button
                  disabled={!(drafts[p.value] ?? "").trim() || add.isPending}
                  onClick={() => add.mutate(p.value)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
