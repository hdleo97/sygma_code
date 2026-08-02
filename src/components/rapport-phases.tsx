import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PHASES,
  ajouterOperationLibre,
  cocherOperation,
  fetchChecklist,
  fetchOperationsRealisees,
  supprimerOperation,
} from "@/lib/rapport-phases";

type Props = {
  interventionId: string;
  categorieEquipement: string | null;
  canEdit: boolean;
};

export function RapportPhases({
  interventionId,
  categorieEquipement,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const [libres, setLibres] = useState<Record<number, string>>({});

  const checklist = useQuery({
    queryKey: ["checklist-operations", categorieEquipement],
    queryFn: () => fetchChecklist(categorieEquipement),
  });

  const realisees = useQuery({
    queryKey: ["rapport-operations", interventionId],
    queryFn: () => fetchOperationsRealisees(interventionId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["rapport-operations", interventionId],
    });

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Opération impossible");

  const toggle = useMutation({
    mutationFn: async (args: {
      phase: number;
      operationId: string;
      existingId?: string;
    }) => {
      if (args.existingId) return supprimerOperation(args.existingId);
      return cocherOperation({
        interventionId,
        phase: args.phase,
        operationId: args.operationId,
      });
    },
    onSuccess: invalidate,
    onError,
  });

  const addLibre = useMutation({
    mutationFn: (args: { phase: number; libelle: string }) =>
      ajouterOperationLibre({ interventionId, ...args }),
    onSuccess: (_d, args) => {
      setLibres((p) => ({ ...p, [args.phase]: "" }));
      invalidate();
      toast.success("Opération ajoutée");
    },
    onError,
  });

  const removeLibre = useMutation({
    mutationFn: (id: string) => supprimerOperation(id),
    onSuccess: invalidate,
    onError,
  });

  if (checklist.isLoading || realisees.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du rapport…
      </div>
    );
  }

  const items = checklist.data ?? [];
  const done = realisees.data ?? [];

  return (
    <Tabs defaultValue="1" className="w-full">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        {PHASES.map((p) => {
          const count = done.filter((d) => d.phase === p.value).length;
          return (
            <TabsTrigger key={p.value} value={String(p.value)} className="text-xs">
              {p.value}. {p.label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                  {count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {PHASES.map((p) => {
        const ops = items.filter((o) => o.phase === p.value);
        const libresPhase = done.filter(
          (d) => d.phase === p.value && !d.operation_id,
        );
        return (
          <TabsContent key={p.value} value={String(p.value)}>
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-foreground">
                Phase {p.value} — {p.label}
              </h3>

              <ul className="mt-4 space-y-2">
                {ops.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Aucune opération standard pour cette phase.
                  </li>
                )}
                {ops.map((op) => {
                  const existing = done.find((d) => d.operation_id === op.id);
                  return (
                    <li key={op.id} className="flex items-start gap-3">
                      <Checkbox
                        id={op.id}
                        disabled={!canEdit || toggle.isPending}
                        checked={!!existing}
                        onCheckedChange={() =>
                          toggle.mutate({
                            phase: p.value,
                            operationId: op.id,
                            existingId: existing?.id,
                          })
                        }
                      />
                      <label
                        htmlFor={op.id}
                        className="text-sm leading-5 text-foreground"
                      >
                        {op.libelle}
                        {op.categorie_equipement && (
                          <span className="ml-2 rounded border border-border px-1 text-[10px] uppercase text-muted-foreground">
                            {op.categorie_equipement}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>

              {libresPhase.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-border pt-4">
                  {libresPhase.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 text-sm text-foreground"
                    >
                      <span>{d.libelle_libre}</span>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeLibre.mutate(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Supprimer</span>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canEdit && (
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                  <Input
                    placeholder="Ajouter une opération libre…"
                    value={libres[p.value] ?? ""}
                    onChange={(e) =>
                      setLibres((prev) => ({
                        ...prev,
                        [p.value]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    variant="outline"
                    disabled={
                      addLibre.isPending || !(libres[p.value] ?? "").trim()
                    }
                    onClick={() =>
                      addLibre.mutate({
                        phase: p.value,
                        libelle: libres[p.value] ?? "",
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
