import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, PackageCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/demandes";
import { fetchMagasins } from "@/lib/stocks";
import {
  effectuerSortie,
  fetchDemandeSortie,
  nomComplet,
  numeroBon,
  refuserDemandeSortie,
  statutSortieClasses,
  statutSortieLabel,
  urgenceClasses,
  urgenceLabel,
  validerDemandeSortie,
} from "@/lib/sorties";

export const Route = createFileRoute("/sorties/$id")({
  component: FicheDemandeSortie,
  head: () => ({
    meta: [
      { title: "Demande de sortie de pièces — SYGMA" },
      {
        name: "description",
        content:
          "Suivi d'une demande de sortie : validation, ajustement des quantités, sortie de magasin et bon de sortie.",
      },
      { property: "og:title", content: "Demande de sortie de pièces — SYGMA" },
      {
        property: "og:description",
        content: "Détail et traitement d'une demande de sortie de pièces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

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

function FicheDemandeSortie() {
  const { id } = Route.useParams();
  const { user, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();

  const isResponsable = hasAnyRole([
    "super_admin",
    "responsable_maintenance",
    "responsable_etablissement",
  ]);
  const isGestionnaire = hasAnyRole([
    "super_admin",
    "responsable_maintenance",
    "gestionnaire_stock",
  ]);

  const [quantites, setQuantites] = useState<Record<string, string>>({});
  const [motif, setMotif] = useState("");
  const [magasinId, setMagasinId] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["demande-sortie", id],
    queryFn: () => fetchDemandeSortie(id),
  });

  const magasinsQ = useQuery({
    queryKey: ["magasins"],
    queryFn: fetchMagasins,
    enabled: isGestionnaire,
  });

  useEffect(() => {
    if (data) {
      setQuantites(
        Object.fromEntries(
          (data.demandes_sortie_lignes ?? []).map((l) => [
            l.id,
            String(l.quantite_sortie ?? l.quantite_demandee),
          ]),
        ),
      );
    }
  }, [data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["demande-sortie", id] });
    void queryClient.invalidateQueries({ queryKey: ["demandes-sortie"] });
    void queryClient.invalidateQueries({ queryKey: ["stock-actuel"] });
    void queryClient.invalidateQueries({ queryKey: ["bons-sortie"] });
  };

  const valider = useMutation({
    mutationFn: () =>
      validerDemandeSortie(
        id,
        Object.entries(quantites).map(([ligne_id, q]) => ({
          ligne_id,
          quantite: Number(q),
        })),
      ),
    onSuccess: () => {
      toast.success("Demande validée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refuser = useMutation({
    mutationFn: () => {
      if (!motif.trim()) throw new Error("Motif de refus obligatoire");
      return refuserDemandeSortie(id, motif.trim());
    },
    onSuccess: () => {
      toast.success("Demande refusée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sortir = useMutation({
    mutationFn: () => {
      if (!data) throw new Error("Demande introuvable");
      if (!magasinId) throw new Error("Sélectionnez le magasin d'origine");
      if (!user) throw new Error("Session expirée");
      return effectuerSortie({
        demande: data,
        magasin_id: magasinId,
        user_id: user.id,
        quantites: Object.entries(quantites).map(([ligne_id, q]) => ({
          ligne_id,
          quantite: Number(q),
        })),
      });
    },
    onSuccess: () => {
      toast.success("Sortie effectuée et bon de sortie généré");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
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
          <Link to="/sorties">Retour aux sorties de pièces</Link>
        </Button>
      </div>
    );
  }

  const bon = data.bons_sortie?.[0];
  const peutValider = isResponsable && data.statut === "demande_creee";
  const peutTraiter = isGestionnaire && data.statut === "validee";

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/sorties">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux sorties de pièces
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Demande de sortie de pièces
      </h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutSortieClasses(data.statut)}`}
        >
          {statutSortieLabel(data.statut)}
        </span>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${urgenceClasses(data.urgence)}`}
        >
          Urgence : {urgenceLabel(data.urgence)}
        </span>
        {bon && (
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Bon de sortie {numeroBon(bon.numero)}
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Demandeur" value={nomComplet(data.technicien)} />
            <Info label="Créée le" value={formatDateTime(data.created_at)} />
            <Info
              label="Équipement"
              value={
                data.equipements
                  ? `${data.equipements.reference} — ${data.equipements.designation}`
                  : "—"
              }
            />
            <Info
              label="Intervention"
              value={data.interventions?.description.slice(0, 60) ?? "—"}
            />
            <Info
              label="Validée par"
              value={
                data.valide_at
                  ? `${nomComplet(data.valideur)} — ${formatDateTime(data.valide_at)}`
                  : "—"
              }
            />
            <Info
              label="Traitée par"
              value={
                data.traite_at
                  ? `${nomComplet(data.gestionnaire)} — ${formatDateTime(data.traite_at)}`
                  : "—"
              }
            />
          </dl>
          {data.justification && (
            <div className="mt-6">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Justification
              </dt>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {data.justification}
              </p>
            </div>
          )}
          {data.motif_refus && (
            <p className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              Refusée : {data.motif_refus}
            </p>
          )}
          {data.interventions && (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link
                to="/interventions/$id"
                params={{ id: data.interventions.id }}
              >
                Voir l'intervention
              </Link>
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pièce</TableHead>
                <TableHead>Quantité demandée</TableHead>
                <TableHead>Quantité sortie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.demandes_sortie_lignes ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {l.pieces?.code_article}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.pieces?.designation}
                    </div>
                  </TableCell>
                  <TableCell>
                    {Number(l.quantite_demandee)} {l.pieces?.unite}
                  </TableCell>
                  <TableCell>
                    {peutValider || peutTraiter ? (
                      <Input
                        className="w-28"
                        type="number"
                        min="0"
                        step="0.01"
                        value={quantites[l.id] ?? ""}
                        onChange={(e) =>
                          setQuantites((prev) => ({
                            ...prev,
                            [l.id]: e.target.value,
                          }))
                        }
                      />
                    ) : l.quantite_sortie === null ? (
                      "—"
                    ) : (
                      `${Number(l.quantite_sortie)} ${l.pieces?.unite ?? ""}`
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {peutValider && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground">
              Validation responsable maintenance
            </h2>
            <p className="text-sm text-muted-foreground">
              Vous pouvez ajuster les quantités ci-dessus avant validation.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={valider.isPending}
                onClick={() => valider.mutate()}
              >
                <Check className="mr-2 h-4 w-4" />
                Valider la demande
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="motif">Motif de refus</Label>
              <Textarea
                id="motif"
                rows={2}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
              <Button
                variant="destructive"
                disabled={refuser.isPending}
                onClick={() => refuser.mutate()}
              >
                <X className="mr-2 h-4 w-4" />
                Refuser
              </Button>
            </div>
          </div>
        )}

        {peutTraiter && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground">
              Traitement gestionnaire de stock
            </h2>
            <div className="max-w-sm space-y-2">
              <Label>Magasin d'origine</Label>
              <Select value={magasinId} onValueChange={setMagasinId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un magasin" />
                </SelectTrigger>
                <SelectContent>
                  {(magasinsQ.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={sortir.isPending} onClick={() => sortir.mutate()}>
              <PackageCheck className="mr-2 h-4 w-4" />
              Effectuer la sortie
            </Button>
          </div>
        )}

        {bon && (
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground">
              Bon de sortie {numeroBon(bon.numero)}
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Date" value={formatDateTime(bon.date_sortie)} />
              <Info label="Magasin" value={bon.magasins?.nom ?? "—"} />
              <Info label="Demandeur" value={nomComplet(data.technicien)} />
              <Info label="Valideur" value={nomComplet(data.valideur)} />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
