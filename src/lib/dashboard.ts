import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DashboardFilters = {
  from: string; // ISO date (yyyy-mm-dd)
  to: string; // ISO date (yyyy-mm-dd)
  etablissementId: string | null;
  categorie: string | null;
  technicienId: string | null;
};

export type EquipementLite = Pick<
  Tables<"equipements">,
  "id" | "reference" | "designation" | "categorie" | "statut" | "etablissement_id"
>;

export type DemandeLite = Pick<
  Tables<"demandes_intervention">,
  "id" | "statut" | "priorite" | "created_at" | "etablissement_id" | "equipement_id" | "technicien_id"
>;

export type InterventionLite = Pick<
  Tables<"interventions">,
  | "id"
  | "nature"
  | "statut"
  | "created_at"
  | "date_debut"
  | "date_fin"
  | "duree_minutes"
  | "date_planifiee"
  | "equipement_id"
  | "etablissement_id"
> & { intervention_techniciens: { technicien_id: string }[] | null };

export type DashboardData = {
  equipements: EquipementLite[];
  demandes: DemandeLite[];
  interventions: InterventionLite[];
  alertesStock: {
    piece_id: string;
    magasin_id: string;
    quantite: number;
    seuil: number;
    designation: string;
    code_article: string;
    magasin: string;
  }[];
};

function endOfDay(d: string): string {
  return new Date(`${d}T23:59:59.999`).toISOString();
}
function startOfDay(d: string): string {
  return new Date(`${d}T00:00:00.000`).toISOString();
}

export async function fetchDashboardData(
  filters: DashboardFilters,
): Promise<DashboardData> {
  const debut = startOfDay(filters.from);
  const fin = endOfDay(filters.to);

  let eqQuery = supabase
    .from("equipements")
    .select("id, reference, designation, categorie, statut, etablissement_id");
  if (filters.etablissementId)
    eqQuery = eqQuery.eq("etablissement_id", filters.etablissementId);
  if (filters.categorie) eqQuery = eqQuery.eq("categorie", filters.categorie);

  let diQuery = supabase
    .from("demandes_intervention")
    .select(
      "id, statut, priorite, created_at, etablissement_id, equipement_id, technicien_id",
    )
    .gte("created_at", debut)
    .lte("created_at", fin);
  if (filters.etablissementId)
    diQuery = diQuery.eq("etablissement_id", filters.etablissementId);
  if (filters.technicienId)
    diQuery = diQuery.eq("technicien_id", filters.technicienId);

  let itQuery = supabase
    .from("interventions")
    .select(
      "id, nature, statut, created_at, date_debut, date_fin, duree_minutes, date_planifiee, equipement_id, etablissement_id, intervention_techniciens(technicien_id)",
    )
    .gte("created_at", debut)
    .lte("created_at", fin);
  if (filters.etablissementId)
    itQuery = itQuery.eq("etablissement_id", filters.etablissementId);

  const [eqRes, diRes, itRes, stockRes, seuilRes, pieceRes, magRes] =
    await Promise.all([
      eqQuery,
      diQuery,
      itQuery,
      supabase.from("v_stock_actuel").select("piece_id, magasin_id, quantite"),
      supabase.from("stock_seuils").select("piece_id, magasin_id, seuil_alerte"),
      supabase.from("pieces").select("id, code_article, designation"),
      supabase.from("magasins").select("id, nom, etablissement_id"),
    ]);

  if (eqRes.error) throw eqRes.error;
  if (diRes.error) throw diRes.error;
  if (itRes.error) throw itRes.error;

  const equipements = (eqRes.data ?? []) as EquipementLite[];
  const eqIds = new Set(equipements.map((e) => e.id));

  const demandes = ((diRes.data ?? []) as DemandeLite[]).filter(
    (d) => !filters.categorie || (d.equipement_id && eqIds.has(d.equipement_id)),
  );

  let interventions = ((itRes.data ?? []) as unknown as InterventionLite[]).filter(
    (i) => !filters.categorie || (i.equipement_id && eqIds.has(i.equipement_id)),
  );
  if (filters.technicienId) {
    interventions = interventions.filter((i) =>
      (i.intervention_techniciens ?? []).some(
        (t) => t.technicien_id === filters.technicienId,
      ),
    );
  }

  const pieces = new Map(
    (pieceRes.data ?? []).map((p) => [p.id, p as { id: string; code_article: string; designation: string }]),
  );
  const magasins = new Map(
    (magRes.data ?? []).map((m) => [
      m.id,
      m as { id: string; nom: string; etablissement_id: string },
    ]),
  );
  const stockMap = new Map(
    (stockRes.data ?? []).map((s) => [
      `${s.piece_id}:${s.magasin_id}`,
      Number(s.quantite ?? 0),
    ]),
  );

  const alertesStock = (seuilRes.data ?? [])
    .map((s) => {
      const mag = magasins.get(s.magasin_id);
      const piece = pieces.get(s.piece_id);
      return {
        piece_id: s.piece_id,
        magasin_id: s.magasin_id,
        quantite: stockMap.get(`${s.piece_id}:${s.magasin_id}`) ?? 0,
        seuil: Number(s.seuil_alerte ?? 0),
        designation: piece?.designation ?? "—",
        code_article: piece?.code_article ?? "—",
        magasin: mag?.nom ?? "—",
        etablissement_id: mag?.etablissement_id ?? null,
      };
    })
    .filter(
      (a) =>
        a.quantite <= a.seuil &&
        (!filters.etablissementId ||
          a.etablissement_id === filters.etablissementId),
    )
    .map(({ etablissement_id: _e, ...rest }) => rest);

  return { equipements, demandes, interventions, alertesStock };
}

export type Kpis = {
  diParStatut: { name: string; value: number }[];
  totalDi: number;
  tauxDisponibilite: number;
  equipementsEnService: number;
  equipementsTotal: number;
  mttrMinutes: number | null;
  mtbfHeures: number | null;
  parNature: { name: string; value: number }[];
  parStatutIntervention: { name: string; value: number }[];
  parTechnicien: { name: string; value: number }[];
  parEquipement: { name: string; value: number }[];
  tauxPreventif: number;
  preventifRealisees: number;
  preventifTotal: number;
  topPannes: { name: string; value: number }[];
  evolution: { mois: string; curative: number; preventive: number }[];
};

const DI_STATUT_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  validee: "Validée",
  affectee: "Affectée",
  en_cours: "En cours",
  terminee: "Terminée",
  cloturee: "Clôturée",
  refusee: "Refusée",
};

const IT_STATUT_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  terminee: "Terminée",
  signee: "Signée",
};

export function computeKpis(
  data: DashboardData,
  filters: DashboardFilters,
  technicienNames: Map<string, string>,
): Kpis {
  const { equipements, demandes, interventions } = data;

  const countBy = <T>(items: T[], key: (x: T) => string | null) => {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = key(it);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const diMap = countBy(demandes, (d) => d.statut);
  const diParStatut = Object.keys(DI_STATUT_LABELS).map((k) => ({
    name: DI_STATUT_LABELS[k],
    value: diMap.get(k) ?? 0,
  }));

  const actifs = equipements.filter((e) => e.statut !== "reforme");
  const enService = actifs.filter((e) => e.statut === "en_service").length;
  const tauxDisponibilite = actifs.length
    ? Math.round((enService / actifs.length) * 1000) / 10
    : 0;

  const curatives = interventions.filter((i) => i.nature === "curative");
  const durees = curatives
    .map((i) => i.duree_minutes)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const mttrMinutes = durees.length
    ? Math.round(durees.reduce((a, b) => a + b, 0) / durees.length)
    : null;

  const jours = Math.max(
    1,
    Math.round(
      (new Date(filters.to).getTime() - new Date(filters.from).getTime()) /
        86400000,
    ) + 1,
  );
  const heuresService = jours * 24 * Math.max(1, actifs.length);
  const mtbfHeures = curatives.length
    ? Math.round(heuresService / curatives.length)
    : null;

  const natureMap = countBy(interventions, (i) => i.nature);
  const parNature = [
    { name: "Curative", value: natureMap.get("curative") ?? 0 },
    { name: "Préventive", value: natureMap.get("preventive") ?? 0 },
  ];

  const itStatutMap = countBy(interventions, (i) => i.statut);
  const parStatutIntervention = Object.keys(IT_STATUT_LABELS).map((k) => ({
    name: IT_STATUT_LABELS[k],
    value: itStatutMap.get(k) ?? 0,
  }));

  const techMap = new Map<string, number>();
  for (const i of interventions) {
    for (const t of i.intervention_techniciens ?? []) {
      techMap.set(t.technicien_id, (techMap.get(t.technicien_id) ?? 0) + 1);
    }
  }
  const parTechnicien = [...techMap.entries()]
    .map(([id, value]) => ({ name: technicienNames.get(id) ?? "Technicien", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const eqLabel = new Map(
    equipements.map((e) => [e.id, `${e.reference} — ${e.designation}`]),
  );
  const eqMap = countBy(interventions, (i) => i.equipement_id);
  const parEquipement = [...eqMap.entries()]
    .map(([id, value]) => ({ name: eqLabel.get(id) ?? "Équipement", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const preventives = interventions.filter((i) => i.nature === "preventive");
  const preventifRealisees = preventives.filter(
    (i) => i.statut === "terminee" || i.statut === "signee",
  ).length;
  const tauxPreventif = preventives.length
    ? Math.round((preventifRealisees / preventives.length) * 1000) / 10
    : 0;

  const pannesMap = countBy(curatives, (i) => i.equipement_id);
  const topPannes = [...pannesMap.entries()]
    .map(([id, value]) => ({ name: eqLabel.get(id) ?? "Équipement", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const evoMap = new Map<string, { curative: number; preventive: number }>();
  for (const i of interventions) {
    const d = new Date(i.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = evoMap.get(key) ?? { curative: 0, preventive: 0 };
    if (i.nature === "curative") cur.curative += 1;
    else cur.preventive += 1;
    evoMap.set(key, cur);
  }
  const evolution = [...evoMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mois, v]) => ({ mois, ...v }));

  return {
    diParStatut,
    totalDi: demandes.length,
    tauxDisponibilite,
    equipementsEnService: enService,
    equipementsTotal: actifs.length,
    mttrMinutes,
    mtbfHeures,
    parNature,
    parStatutIntervention,
    parTechnicien,
    parEquipement,
    tauxPreventif,
    preventifRealisees,
    preventifTotal: preventives.length,
    topPannes,
    evolution,
  };
}
