import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DOMAINES_STATUTS,
  db,
  fetchLibellesStatuts,
  useReferentiels,
  type LibelleStatut,
} from "@/lib/parametrage";

const err = (e: unknown) =>
  toast.error(e instanceof Error ? e.message : "Action impossible");

function ListeReferentiel({
  type,
  titre,
}: {
  type: "categorie_equipement" | "zone";
  titre: string;
}) {
  const qc = useQueryClient();
  const { data } = useReferentiels();
  const [nouveau, setNouveau] = useState("");
  const items = (data ?? []).filter((r) => r.type === type);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["referentiels"] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from("referentiels")
        .insert({ type, libelle: nouveau.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setNouveau("");
      refresh();
    },
    onError: err,
  });
  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await db.from("referentiels").update(p.patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: err,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("referentiels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: err,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 font-semibold text-foreground">{titre}</h3>
      <div className="mb-3 flex gap-2">
        <Input
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          placeholder="Nouveau libellé"
        />
        <Button disabled={!nouveau.trim() || add.isPending} onClick={() => add.mutate()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-muted-foreground">Aucun élément.</li>
        )}
        {items.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <Input
              defaultValue={r.libelle}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== r.libelle)
                  update.mutate({ id: r.id, patch: { libelle: v } });
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => update.mutate({ id: r.id, patch: { actif: !r.actif } })}
            >
              {r.actif ? "Actif" : "Inactif"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => window.confirm("Supprimer ?") && remove.mutate(r.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LibellesStatuts() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["libelles-statuts"],
    queryFn: fetchLibellesStatuts,
  });
  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Partial<LibelleStatut> }) => {
      const { error } = await db.from("libelles_statuts").update(p.patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Enregistré");
      void qc.invalidateQueries({ queryKey: ["libelles-statuts"] });
    },
    onError: err,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {DOMAINES_STATUTS.map((d) => (
        <div key={d.value} className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 font-semibold text-foreground">{d.label}</h3>
          <ul className="space-y-2">
            {(data ?? [])
              .filter((l) => l.domaine === d.value)
              .map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    defaultValue={l.couleur}
                    className="h-9 w-10 cursor-pointer rounded border border-border bg-background"
                    onBlur={(e) =>
                      e.target.value !== l.couleur &&
                      update.mutate({ id: l.id, patch: { couleur: e.target.value } })
                    }
                  />
                  <Input
                    defaultValue={l.libelle}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== l.libelle)
                        update.mutate({ id: l.id, patch: { libelle: v } });
                    }}
                  />
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-primary-foreground"
                    style={{ backgroundColor: l.couleur }}
                  >
                    {l.libelle}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ParametrageReferentiels() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <ListeReferentiel type="categorie_equipement" titre="Catégories d'équipements" />
        <ListeReferentiel type="zone" titre="Zones / localisations" />
      </div>
      <div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Priorités et statuts
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Personnalisez les libellés et couleurs. Les étapes des circuits de validation restent fixes.
        </p>
        <LibellesStatuts />
      </div>
    </div>
  );
}
