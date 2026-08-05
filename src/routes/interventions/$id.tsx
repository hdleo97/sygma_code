import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FileDown, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RapportPhases } from "@/components/rapport-phases";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/demandes";
import { exporterRapportPdf } from "@/lib/rapport-pdf";
import { PHASES, fetchOperationsRealisees } from "@/lib/rapport-phases";
import {
  TRANSITIONS_INTERVENTION,
  computeDuree,
  formatDuree,
  fromLocalInput,
  natureInterventionLabel,
  statutInterventionClasses,
  statutInterventionLabel,
  toLocalInput,
  type Intervention,
  type InterventionStatut,
} from "@/lib/interventions";


export const Route = createFileRoute("/interventions/$id")({
  component: FicheIntervention,
  head: () => ({
    meta: [
      { title: "Rapport d'intervention — SYGMA" },
      {
        name: "description",
        content:
          "En-tête du rapport d'intervention : équipement, heures de début et de fin, durée calculée automatiquement.",
      },
      { property: "og:title", content: "Rapport d'intervention — SYGMA" },
      {
        property: "og:description",
        content: "Saisissez l'en-tête du rapport d'intervention SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = Intervention & {
  equipements: {
    reference: string;
    designation: string;
    marque: string | null;
    modele: string | null;
    numero_serie: string | null;
    zone: string | null;
    categorie: string | null;
  } | null;
  intervention_techniciens: {
    technicien_id: string;
    profils_utilisateurs: { nom: string | null; prenom: string | null } | null;
  }[];
};

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

function FicheIntervention() {
  const { id } = Route.useParams();
  const { user, profil, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [bonsSelectionnes, setBonsSelectionnes] = useState<string[]>([]);
  const [observations, setObservations] = useState("");
  const [complementaires, setComplementaires] = useState("");
  const [pdfPending, setPdfPending] = useState(false);


  const isResponsable = hasAnyRole([
    "super_admin",
    "responsable_maintenance",
    "responsable_etablissement",
  ]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["intervention", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interventions")
        .select(
          "*, equipements(reference, designation, marque, modele, numero_serie, zone, categorie), intervention_techniciens(technicien_id, profils_utilisateurs:profils_utilisateurs!intervention_techniciens_technicien_id_fkey(nom, prenom))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Row | null;
    },
  });

  useEffect(() => {
    if (data) {
      setDebut(toLocalInput(data.date_debut));
      setFin(toLocalInput(data.date_fin));
      setObservations(data.observations ?? "");
      setObservations(data.observations ?? "");
      setComplementaires(data.interventions_complementaires ?? "");
    }
  }, [data]);

  const operations = useQuery({
    queryKey: ["rapport-operations", id],
    queryFn: () => fetchOperationsRealisees(id),
  });

  const save = useMutation({
    mutationFn: async (patch: {
      date_debut?: string | null;
      date_fin?: string | null;
      statut?: InterventionStatut;
      pieces_utilisees?: string | null;
      observations?: string | null;
      interventions_complementaires?: string | null;
      signature_superviseur?: string;
      signature_superviseur_nom?: string;
      signature_superviseur_at?: string;
      signature_valideur?: string;
      signature_valideur_nom?: string;
      signature_valideur_at?: string;
    }) => {
      const { error } = await supabase
        .from("interventions")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention", id] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.success("Intervention mise à jour");
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
          Intervention introuvable ou inaccessible.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/interventions">Retour aux interventions</Link>
        </Button>
      </div>
    );
  }

  const isAffecte = data.intervention_techniciens.some(
    (t) => t.technicien_id === user?.id,
  );
  const verrouille = data.statut === "signee";
  const canEdit = (isResponsable || isAffecte) && !verrouille;
  const dureeSaisie = computeDuree(fromLocalInput(debut), fromLocalInput(fin));
  const suivants = TRANSITIONS_INTERVENTION[data.statut];

  const ops = operations.data ?? [];
  const phasesManquantes = PHASES.filter(
    (p) => !ops.some((o) => o.phase === p.value),
  );
  const phasesCompletes = phasesManquantes.length === 0;
  const signataire =
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    user?.email ||
    "Utilisateur";

  const signer = (role: "superviseur" | "valideur", dataUrl: string) => {
    const now = new Date().toISOString();
    const patch =
      role === "superviseur"
        ? {
            signature_superviseur: dataUrl,
            signature_superviseur_nom: signataire,
            signature_superviseur_at: now,
          }
        : {
            signature_valideur: dataUrl,
            signature_valideur_nom: signataire,
            signature_valideur_at: now,
          };
    const autreSignee =
      role === "superviseur" ? !!data.signature_valideur : !!data.signature_superviseur;
    save.mutate(
      autreSignee ? { ...patch, statut: "signee" as InterventionStatut } : patch,
    );
  };


  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/interventions">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux interventions
        </Link>
      </Button>

      <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-foreground">
        {data.description.slice(0, 90)}
        {data.description.length > 90 ? "…" : ""}
      </h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutInterventionClasses(data.statut)}`}
        >
          {statutInterventionLabel(data.statut)}
        </span>
        <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {natureInterventionLabel(data.nature)}
        </span>
        {data.demande_id && (
          <Link
            to="/demandes/$id"
            params={{ id: data.demande_id }}
            className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            Demande d'origine
          </Link>
        )}
      </div>

      {verrouille && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
          <Lock className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Rapport signé et verrouillé : aucune modification n'est possible.
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pdfPending}
            onClick={() => {
              setPdfPending(true);
              exporterRapportPdf(id)
                .catch((e: unknown) =>
                  toast.error(
                    e instanceof Error ? e.message : "Export PDF impossible",
                  ),
                )
                .finally(() => setPdfPending(false));
            }}
          >
            {pdfPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Exporter en PDF
          </Button>
        </div>
      )}


      <Tabs defaultValue="rapport" className="mt-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="rapport">En-tête du rapport</TabsTrigger>
          <TabsTrigger value="phases">Opérations (5 phases)</TabsTrigger>
          <TabsTrigger value="compte-rendu">Compte rendu</TabsTrigger>
          <TabsTrigger value="signature">Signatures</TabsTrigger>
          <TabsTrigger value="planification">Planification</TabsTrigger>
        </TabsList>



        <TabsContent value="rapport" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Équipement concerné
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info
                label="Désignation"
                value={
                  data.equipements
                    ? `${data.equipements.reference} — ${data.equipements.designation}`
                    : "—"
                }
              />
              <Info label="Marque" value={data.equipements?.marque ?? "—"} />
              <Info label="Modèle" value={data.equipements?.modele ?? "—"} />
              <Info
                label="Numéro de série"
                value={data.equipements?.numero_serie ?? "—"}
              />
              <Info
                label="Localisation"
                value={data.localisation ?? data.equipements?.zone ?? "—"}
              />
              <Info label="Date d'appel" value={formatDateTime(data.date_appel)} />
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground">
              Heures d'intervention
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="debut">Début</Label>
                <Input
                  id="debut"
                  type="datetime-local"
                  disabled={!canEdit}
                  value={debut}
                  onChange={(e) => setDebut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fin">Fin</Label>
                <Input
                  id="fin"
                  type="datetime-local"
                  disabled={!canEdit}
                  value={fin}
                  onChange={(e) => setFin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Durée calculée</Label>
                <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {formatDuree(dureeSaisie ?? data.duree_minutes)}
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate({
                      date_debut: fromLocalInput(debut),
                      date_fin: fromLocalInput(fin),
                    })
                  }
                >
                  Enregistrer les heures
                </Button>
                {suivants.includes("en_cours") && (
                  <Button
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({
                        statut: "en_cours",
                        date_debut:
                          fromLocalInput(debut) ?? new Date().toISOString(),
                      })
                    }
                  >
                    Démarrer
                  </Button>
                )}
                {suivants.includes("terminee") && (
                  <Button
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({
                        statut: "terminee",
                        date_fin:
                          fromLocalInput(fin) ?? new Date().toISOString(),
                      })
                    }
                  >
                    Terminer
                  </Button>
                )}
                {suivants.includes("signee") && (
                  <span className="self-center text-xs text-muted-foreground">
                    La signature du rapport s'effectue dans l'onglet
                    « Signatures ».
                  </span>
                )}

              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="phases">
          <RapportPhases
            interventionId={id}
            categorieEquipement={data.equipements?.categorie ?? null}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="compte-rendu">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
            <div className="space-y-3">
              <Label>Pièces utilisées (bons de sortie)</Label>
              {bonsQ.isLoading ? (
                <p className="text-xs text-muted-foreground">
                  Chargement des bons de sortie…
                </p>
              ) : bons.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun bon de sortie validé pour cette intervention. Les
                  pièces se rattachent depuis le module « Sorties de pièces ».
                </p>
              ) : (
                <div className="space-y-2">
                  {bons.map((b) => {
                    const coche = bonsSelectionnes.includes(b.id);
                    return (
                      <div
                        key={b.id}
                        className="rounded-md border border-border p-3"
                      >
                        <label className="flex items-start gap-3">
                          <Checkbox
                            checked={coche}
                            disabled={!canEdit}
                            onCheckedChange={(v) =>
                              setBonsSelectionnes((prev) =>
                                v === true
                                  ? [...new Set([...prev, b.id])]
                                  : prev.filter((x) => x !== b.id),
                              )
                            }
                          />
                          <span className="text-sm">
                            <span className="font-medium text-foreground">
                              {numeroBon(b.numero)}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              — {b.magasins?.nom ?? "Magasin"} •{" "}
                              {formatDateTime(b.date_sortie)}
                            </span>
                          </span>
                        </label>
                        <ul className="mt-2 space-y-1 pl-7 text-xs text-muted-foreground">
                          {(
                            b.demandes_sortie_pieces?.demandes_sortie_lignes ??
                            []
                          ).map((l) => (
                            <li key={l.id}>
                              {l.pieces?.code_article} — {l.pieces?.designation}{" "}
                              × {Number(l.quantite_sortie ?? l.quantite_demandee)}{" "}
                              {l.pieces?.unite ?? ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              {recapPieces && (
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground">
                  {recapPieces}
                </pre>
              )}
            </div>


            <div className="space-y-2">
              <Label htmlFor="observations">Observations</Label>
              <Textarea
                id="observations"
                rows={4}
                disabled={!canEdit}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complementaires">
                Interventions complémentaires à réaliser prochainement
              </Label>
              <Textarea
                id="complementaires"
                rows={4}
                disabled={!canEdit}
                value={complementaires}
                onChange={(e) => setComplementaires(e.target.value)}
              />
            </div>

            {canEdit && (
              <Button
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    pieces_utilisees: recapPieces || null,
                    observations: observations.trim() || null,
                    interventions_complementaires:
                      complementaires.trim() || null,
                  })
                }
              >
                Enregistrer le compte rendu
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="signature">
          {!phasesCompletes && !verrouille ? (
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Signatures indisponibles
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Chaque phase doit comporter au moins une opération traitée avant
                de pouvoir signer le rapport. Phases incomplètes :
              </p>
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                {phasesManquantes.map((p) => (
                  <li key={p.value}>
                    Phase {p.value} — {p.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <SignaturePad
                label="Superviseur technique"
                value={data.signature_superviseur}
                signedAt={data.signature_superviseur_at}
                signedBy={data.signature_superviseur_nom}
                disabled={!canEdit}
                isPending={save.isPending}
                onSign={(url) => signer("superviseur", url)}
              />
              <SignaturePad
                label="Valideur"
                value={data.signature_valideur}
                signedAt={data.signature_valideur_at}
                signedBy={data.signature_valideur_nom}
                disabled={!canEdit || !isResponsable}
                isPending={save.isPending}
                onSign={(url) => signer("valideur", url)}
              />
            </div>
          )}
        </TabsContent>


        <TabsContent value="planification">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info
                label="Date planifiée"
                value={formatDateTime(data.date_planifiee)}
              />
              <Info
                label="Durée estimée"
                value={formatDuree(data.duree_estimee_minutes)}
              />
              <Info
                label="Techniciens affectés"
                value={
                  data.intervention_techniciens.length === 0
                    ? "—"
                    : data.intervention_techniciens
                        .map(
                          (t) =>
                            [
                              t.profils_utilisateurs?.prenom,
                              t.profils_utilisateurs?.nom,
                            ]
                              .filter(Boolean)
                              .join(" ") || "—",
                        )
                        .join(", ")
                }
              />
              <Info label="Créée le" value={formatDateTime(data.created_at)} />
            </dl>
            <div className="mt-6">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Description
              </dt>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {data.description}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
