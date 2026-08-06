import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  FileText,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import {
  cloturerCommande,
  confirmerCommande,
  enregistrerReception,
  exporterCommandeExcel,
  exporterCommandePdf,
  fetchCommande,
  formatDateTime,
  getPieceJointeCommandeUrl,
  nomComplet,
  numeroCommande,
  statutCommandeClasses,
  statutCommandeLabel,
} from "@/lib/commandes";
import { fetchMagasins } from "@/lib/stocks";

export const Route = createFileRoute("/commandes/$id")({
  component: CommandeDetailPage,
  head: () => ({
    meta: [
      { title: "Détail de la commande — SYGMA" },
      {
        name: "description",
        content:
          "Détail d'une commande d'achat : lignes, confirmation, réceptions partielles et exports PDF/Excel.",
      },
      { property: "og:title", content: "Détail de la commande — SYGMA" },
      {
        property: "og:description",
        content: "Suivi d'une commande d'achat de pièces détachées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CommandeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const commandeQ = useQuery({
    queryKey: ["commande", id],
    queryFn: () => fetchCommande(id),
  });
  const magasinsQ = useQuery({ queryKey: ["magasins"], queryFn: fetchMagasins });

  const commande = commandeQ.data;
  const [magasinReception, setMagasinReception] = useState("");
  const [receptions, setReceptions] = useState<Record<string, string>>({});

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["commande", id] });
    void queryClient.invalidateQueries({ queryKey: ["commandes"] });
    void queryClient.invalidateQueries({ queryKey: ["stock-actuel"] });
  };

  const confirmer = useMutation({
    mutationFn: () => confirmerCommande(id),
    onSuccess: () => {
      toast.success("Commande confirmée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloturer = useMutation({
    mutationFn: () => cloturerCommande(id),
    onSuccess: () => {
      toast.success("Commande clôturée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receptionner = useMutation({
    mutationFn: () => {
      const magasinId = magasinReception || commande?.magasin_id || "";
      if (!magasinId) throw new Error("Magasin de destination obligatoire");
      return enregistrerReception(
        id,
        magasinId,
        Object.entries(receptions).map(([ligne_id, q]) => ({
          ligne_id,
          quantite: Number(q) || 0,
        })),
      );
    },
    onSuccess: () => {
      toast.success("Réception enregistrée, stock mis à jour");
      setReceptions({});
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (commandeQ.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  if (!commande) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Commande introuvable.</p>
      </div>
    );
  }

  const peutRecevoir =
    commande.statut === "commandee" || commande.statut === "recue_partiellement";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate({ to: "/commandes" })}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour aux commandes
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {numeroCommande(commande.numero)}
            </h1>
            <Badge
              variant="outline"
              className={statutCommandeClasses(commande.statut)}
            >
              {statutCommandeLabel(commande.statut)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {commande.fournisseur} · {commande.magasins?.nom ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exporterCommandePdf(commande)}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => exporterCommandeExcel(commande)}>
            <FileDown className="mr-2 h-4 w-4" />
            Excel
          </Button>
          {commande.statut === "a_commander" && (
            <Button
              onClick={() => confirmer.mutate()}
              disabled={confirmer.isPending}
            >
              {confirmer.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmer la commande passée
            </Button>
          )}
          {commande.statut === "recue" && (
            <Button onClick={() => cloturer.mutate()} disabled={cloturer.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Clôturer
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Établissement" value={commande.etablissements?.nom ?? "—"} />
        <Info label="Demandeur" value={nomComplet(commande.demandeur)} />
        <Info
          label="Date de commande"
          value={formatDateTime(commande.date_commande)}
        />
        <Info
          label="Montant estimé"
          value={
            commande.montant_estime != null
              ? Number(commande.montant_estime).toFixed(2)
              : "—"
          }
        />
        <Info label="Référence" value={commande.reference ?? "—"} />
        <Info label="Créée le" value={formatDateTime(commande.created_at)} />
      </div>

      {commande.notes && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{commande.notes}</p>
        </div>
      )}

      {commande.pieces_jointes.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Pièces jointes
          </p>
          <div className="flex flex-wrap gap-2">
            {commande.pieces_jointes.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                onClick={async () => {
                  const url = await getPieceJointeCommandeUrl(p);
                  if (url) window.open(url, "_blank", "noopener");
                  else toast.error("Impossible d'ouvrir le fichier");
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                {p.slice(0, 12)}…
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead>Commandée</TableHead>
              <TableHead>Reçue</TableHead>
              <TableHead>Reste</TableHead>
              {peutRecevoir && <TableHead className="w-40">À réceptionner</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {commande.commandes_achat_lignes.map((l) => {
              const reste =
                Number(l.quantite_commandee) - Number(l.quantite_recue);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    {l.pieces?.code_article ?? "—"}
                  </TableCell>
                  <TableCell>{l.pieces?.designation ?? "—"}</TableCell>
                  <TableCell>
                    {Number(l.quantite_commandee)} {l.pieces?.unite ?? ""}
                  </TableCell>
                  <TableCell>
                    {Number(l.quantite_recue)} {l.pieces?.unite ?? ""}
                  </TableCell>
                  <TableCell className={reste > 0 ? "text-amber-700" : ""}>
                    {reste}
                  </TableCell>
                  {peutRecevoir && (
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={reste}
                        step="0.01"
                        disabled={reste <= 0}
                        value={receptions[l.id] ?? ""}
                        onChange={(e) =>
                          setReceptions((p) => ({ ...p, [l.id]: e.target.value }))
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {peutRecevoir && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <div className="w-64 space-y-2">
            <Label>Magasin de réception</Label>
            <Select
              value={magasinReception || commande.magasin_id || ""}
              onValueChange={setMagasinReception}
            >
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
          <Button
            onClick={() => receptionner.mutate()}
            disabled={receptionner.isPending}
          >
            {receptionner.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PackageCheck className="mr-2 h-4 w-4" />
            )}
            Valider la réception
          </Button>
          <p className="text-xs text-muted-foreground">
            Les quantités saisies génèrent automatiquement une entrée de stock.
          </p>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-foreground">{value}</p>
    </div>
  );
}
