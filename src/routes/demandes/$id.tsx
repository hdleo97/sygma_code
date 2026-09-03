import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Paperclip, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  TRANSITIONS,
  formatDateTime,
  getPieceJointeUrl,
  prioriteDiClasses,
  prioriteDiLabel,
  statutDiClasses,
  statutDiLabel,
  type Demande,
  type DemandeHistorique,
  type DemandeStatut,
} from "@/lib/demandes";
import { fetchPrestataires } from "@/lib/prestataires";

export const Route = createFileRoute("/demandes/$id")({
  component: FicheDemande,
  head: () => ({
    meta: [
      { title: "Demande d'intervention — SYGMA" },
      {
        name: "description",
        content:
          "Détail d'une demande d'intervention : description, priorité, statut, technicien affecté et historique.",
      },
      { property: "og:title", content: "Demande d'intervention — SYGMA" },
      {
        property: "og:description",
        content: "Consultez et traitez une demande d'intervention SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = Demande & {
  equipements: { id: string; reference: string; designation: string } | null;
  demandeur: { nom: string | null; prenom: string | null } | null;
  technicien: { nom: string | null; prenom: string | null } | null;
};

function personName(p: { nom: string | null; prenom: string | null } | null) {
  if (!p) return "—";
  return [p.prenom, p.nom].filter(Boolean).join(" ") || "—";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function PieceJointe({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ["di-piece", path],
    queryFn: () => getPieceJointeUrl(path),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
    >
      <Paperclip className="h-3 w-3" />
      {path.slice(0, 8)}…{path.slice(path.lastIndexOf("."))}
    </a>
  );
}

function FicheDemande() {
  const { id } = Route.useParams();
  const { user, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const [technicienId, setTechnicienId] = useState("");
  const [prestataireId, setPrestataireId] = useState("none");

  const isResponsable = hasAnyRole(["super_admin", "responsable_maintenance"]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["demande", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes_intervention")
        .select(
          "*, equipements(id, reference, designation), demandeur:profils_utilisateurs!demandes_intervention_demandeur_id_fkey(nom, prenom), technicien:profils_utilisateurs!demandes_intervention_technicien_id_fkey(nom, prenom)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Row | null;
    },
  });

  const { data: historique } = useQuery({
    queryKey: ["demande-historique", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes_intervention_historique")
        .select("*")
        .eq("demande_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as DemandeHistorique[];
    },
  });

  const { data: techniciens } = useQuery({
    queryKey: ["techniciens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profils_utilisateurs(id, nom, prenom)")
        .in("role", ["technicien", "prestataire"]);
      if (error) throw error;
      return (data ?? [])
        .map(
          (r) =>
            r.profils_utilisateurs as unknown as {
              id: string;
              nom: string | null;
              prenom: string | null;
            } | null,
        )
        .filter((p): p is { id: string; nom: string | null; prenom: string | null } => !!p);
    },
    enabled: isResponsable,
  });

  const { data: prestataires } = useQuery({
    queryKey: ["prestataires-di"],
    queryFn: () => fetchPrestataires(),
  });

  const changeStatut = useMutation({
    mutationFn: async ({
      statut,
      technicien,
      prestataire,
    }: {
      statut: DemandeStatut;
      technicien?: string | null;
      prestataire?: string | null;
    }) => {
      const payload: {
        statut: DemandeStatut;
        technicien_id?: string | null;
        prestataire_id?: string | null;
      } = { statut };
      if (technicien !== undefined) payload.technicien_id = technicien;
      if (prestataire !== undefined) payload.prestataire_id = prestataire;
      const { error } = await supabase
        .from("demandes_intervention")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demande", id] });
      queryClient.invalidateQueries({ queryKey: ["demande-historique", id] });
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast.success("Demande mise à jour");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          Demande introuvable ou inaccessible.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/demandes">Retour aux demandes</Link>
        </Button>
      </div>
    );
  }

  const isTechnicienAffecte = data.technicien_id === user?.id;
  const suivants = TRANSITIONS[data.statut];

  const canDo = (s: DemandeStatut) => {
    if (!suivants.includes(s)) return false;
    if (s === "validee" || s === "refusee" || s === "affectee" || s === "cloturee")
      return isResponsable;
    if (s === "en_cours" || s === "terminee")
      return isResponsable || isTechnicienAffecte;
    return false;
  };

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/demandes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux demandes
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-foreground">
            {data.description.slice(0, 90)}
            {data.description.length > 90 ? "…" : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Créée le {formatDateTime(data.created_at)} par{" "}
            {personName(data.demandeur)}
          </p>
          <div className="mt-2 flex gap-2">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutDiClasses(data.statut)}`}
            >
              {statutDiLabel(data.statut)}
            </span>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${prioriteDiClasses(data.priorite)}`}
            >
              Priorité {prioriteDiLabel(data.priorite)}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="fiche" className="mt-6">
        <TabsList>
          <TabsTrigger value="fiche">Fiche</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="fiche" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info
                label="Équipement"
                value={
                  data.equipements
                    ? `${data.equipements.reference} — ${data.equipements.designation}`
                    : "—"
                }
              />
              <Info label="Localisation" value={data.localisation ?? "—"} />
              <Info label="Demandeur" value={personName(data.demandeur)} />
              <Info
                label="Technicien affecté"
                value={personName(data.technicien)}
              />
              <Info
                label="Prestataire externe"
                value={
                  (prestataires ?? []).find(
                    (p) => p.id === data.prestataire_id,
                  )?.raison_sociale ?? "—"
                }
              />
              <Info
                label="Dernière mise à jour"
                value={formatDateTime(data.updated_at)}
              />
            </dl>

            <div className="mt-6">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Description
              </dt>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {data.description}
              </p>
            </div>

            {data.pieces_jointes.length > 0 && (
              <div className="mt-6">
                <dt className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Pièces jointes
                </dt>
                <div className="flex flex-wrap gap-2">
                  {data.pieces_jointes.map((p) => (
                    <PieceJointe key={p} path={p} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {isResponsable && data.statut === "validee" && (
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Intervention
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez une intervention pré-remplie à partir de cette demande
                validée.
              </p>
              <Button asChild className="mt-4">
                <Link
                  to="/interventions/nouvelle"
                  search={{
                    demande: data.id,
                    equipement: data.equipement_id ?? undefined,
                    description: data.description,
                  }}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  Transformer en intervention
                </Link>
              </Button>
            </div>
          )}



          {(isResponsable || isTechnicienAffecte) && suivants.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Traitement de la demande
              </h2>

              {data.statut === "validee" && isResponsable && (
                <div className="mt-4 grid gap-3 sm:max-w-md">
                  <div className="space-y-2">
                    <Label>Technicien à affecter</Label>
                    <Select
                      value={technicienId}
                      onValueChange={setTechnicienId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un technicien" />
                      </SelectTrigger>
                      <SelectContent>
                        {(techniciens ?? []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {[t.prenom, t.nom].filter(Boolean).join(" ") ||
                              t.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prestataire externe (au lieu ou en plus)</Label>
                    <Select
                      value={prestataireId}
                      onValueChange={setPrestataireId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Aucun (équipe interne)
                        </SelectItem>
                        {(prestataires ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.raison_sociale}
                            {p.specialite ? ` — ${p.specialite}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {canDo("validee") && (
                  <Button
                    disabled={changeStatut.isPending}
                    onClick={() => changeStatut.mutate({ statut: "validee" })}
                  >
                    Valider
                  </Button>
                )}
                {canDo("affectee") && (
                  <Button
                    disabled={changeStatut.isPending || !technicienId}
                    onClick={() =>
                      changeStatut.mutate({
                        statut: "affectee",
                        technicien: technicienId,
                      })
                    }
                  >
                    Affecter
                  </Button>
                )}
                {canDo("en_cours") && (
                  <Button
                    disabled={changeStatut.isPending}
                    onClick={() => changeStatut.mutate({ statut: "en_cours" })}
                  >
                    Démarrer l'intervention
                  </Button>
                )}
                {canDo("terminee") && (
                  <Button
                    disabled={changeStatut.isPending}
                    onClick={() => changeStatut.mutate({ statut: "terminee" })}
                  >
                    Terminer
                  </Button>
                )}
                {canDo("cloturee") && (
                  <Button
                    disabled={changeStatut.isPending}
                    onClick={() => changeStatut.mutate({ statut: "cloturee" })}
                  >
                    Clôturer
                  </Button>
                )}
                {canDo("refusee") && (
                  <Button
                    variant="destructive"
                    disabled={changeStatut.isPending}
                    onClick={() => changeStatut.mutate({ statut: "refusee" })}
                  >
                    Refuser
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historique">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            {!historique || historique.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun changement enregistré.
              </p>
            ) : (
              <ol className="space-y-3">
                {historique.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center gap-2 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <span className="text-muted-foreground">
                      {formatDateTime(h.created_at)}
                    </span>
                    <span className="text-foreground">
                      {h.ancien_statut
                        ? `${statutDiLabel(h.ancien_statut)} → ${statutDiLabel(h.nouveau_statut)}`
                        : `Création (${statutDiLabel(h.nouveau_statut)})`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
