import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PERIODICITES, createPlan, type PeriodiciteType } from "@/lib/preventif";

export const Route = createFileRoute("/preventif/nouveau")({
  component: NouveauPlan,
  head: () => ({
    meta: [
      { title: "Nouveau plan préventif — SYGMA" },
      {
        name: "description",
        content:
          "Créez un plan de maintenance préventive par périodicité de temps ou de compteur.",
      },
      { property: "og:title", content: "Nouveau plan préventif — SYGMA" },
      {
        property: "og:description",
        content: "Définissez la périodicité et la gamme d'un plan préventif.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type EquipementLite = {
  id: string;
  reference: string;
  designation: string;
  categorie: string | null;
  etablissement_id: string;
};

function NouveauPlan() {
  const navigate = useNavigate();
  const { etablissements, currentEtablissementId, user } = useAuth();

  const [etab, setEtab] = useState(
    currentEtablissementId ?? etablissements[0]?.id ?? "",
  );
  const [cible, setCible] = useState<"equipement" | "categorie">("equipement");
  const [equipementId, setEquipementId] = useState("");
  const [categorie, setCategorie] = useState("");
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [periodicite, setPeriodicite] = useState<PeriodiciteType>("temps");
  const [valeur, setValeur] = useState("30");
  const [uniteCompteur, setUniteCompteur] = useState("heures");
  const [gamme, setGamme] = useState("");
  const [duree, setDuree] = useState("");
  const [dateDebut, setDateDebut] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  const equipementsQ = useQuery({
    queryKey: ["equipements-lite"],
    queryFn: async (): Promise<EquipementLite[]> => {
      const { data, error } = await supabase
        .from("equipements")
        .select("id, reference, designation, categorie, etablissement_id")
        .order("reference");
      if (error) throw error;
      return data ?? [];
    },
  });

  const equipements = useMemo(
    () => (equipementsQ.data ?? []).filter((e) => !etab || e.etablissement_id === etab),
    [equipementsQ.data, etab],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(equipements.map((e) => e.categorie).filter((c): c is string => !!c)),
      ).sort(),
    [equipements],
  );

  const save = useMutation({
    mutationFn: () =>
      createPlan({
        etablissement_id: etab,
        equipement_id: cible === "equipement" ? equipementId : null,
        categorie_equipement: cible === "categorie" ? categorie : null,
        libelle: libelle.trim(),
        description: description.trim() || null,
        periodicite,
        periodicite_valeur: Number(valeur),
        unite_compteur: periodicite === "compteur" ? uniteCompteur : null,
        checklist_categorie: gamme.trim() || null,
        duree_estimee_minutes: duree ? Number(duree) : null,
        date_debut: dateDebut,
        cree_par: user?.id ?? null,
      }),
    onSuccess: () => {
      toast.success("Plan préventif créé");
      void navigate({ to: "/preventif" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valide =
    etab &&
    libelle.trim() &&
    Number(valeur) > 0 &&
    (cible === "equipement" ? !!equipementId : !!categorie);

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/preventif">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au préventif
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Nouveau plan préventif
      </h1>

      <form
        className="mt-6 max-w-3xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (valide) save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Établissement *</Label>
            <Select value={etab} onValueChange={setEtab}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {etablissements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cible du plan</Label>
            <Select
              value={cible}
              onValueChange={(v) => setCible(v as "equipement" | "categorie")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equipement">Un équipement précis</SelectItem>
                <SelectItem value="categorie">
                  Une catégorie d'équipements
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cible === "equipement" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Équipement *</Label>
              <Select value={equipementId} onValueChange={setEquipementId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un équipement" />
                </SelectTrigger>
                <SelectContent>
                  {equipements.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.reference} — {e.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2 sm:col-span-2">
              <Label>Catégorie d'équipement *</Label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="libelle">Libellé du plan *</Label>
            <Input
              id="libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. Graissage périodique"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Type de périodicité</Label>
            <Select
              value={periodicite}
              onValueChange={(v) => setPeriodicite(v as PeriodiciteType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODICITES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valeur">
              {periodicite === "temps"
                ? "Tous les … jours *"
                : "Toutes les … unités *"}
            </Label>
            <Input
              id="valeur"
              type="number"
              min="1"
              step="any"
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
            />
          </div>

          {periodicite === "compteur" && (
            <div className="space-y-2">
              <Label htmlFor="unite">Unité du compteur</Label>
              <Input
                id="unite"
                value={uniteCompteur}
                onChange={(e) => setUniteCompteur(e.target.value)}
                placeholder="heures, cycles, km…"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="gamme">Gamme (catégorie de checklist)</Label>
            <Input
              id="gamme"
              value={gamme}
              onChange={(e) => setGamme(e.target.value)}
              placeholder="Catégorie utilisée dans la checklist"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duree">Durée estimée (minutes)</Label>
            <Input
              id="duree"
              type="number"
              min="0"
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debut">Première échéance</Label>
            <Input
              id="debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!valide || save.isPending}>
            {save.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Créer le plan
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/preventif">Annuler</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
