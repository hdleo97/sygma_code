/** Mise en forme partagée (navigateur + serveur) des rapports. */

export type VisiteRow = {
  date_visite: string;
  observations: string | null;
  signature_nom: string | null;
  signature_at: string | null;
  equipements: { reference: string; designation: string } | null;
  etablissements?: { nom: string } | null;
  profils_utilisateurs: { nom: string | null; prenom: string | null } | null;
  visites_quotidiennes_operations: { conforme: boolean }[] | null;
};

export const VISITES_SELECT =
  "date_visite, observations, signature_nom, signature_at, equipements(reference, designation), etablissements(nom), profils_utilisateurs(nom, prenom), visites_quotidiennes_operations(conforme)";

function d(v: string | null): string {
  if (!v) return "";
  const x = new Date(v);
  return Number.isNaN(x.getTime())
    ? ""
    : x.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
}

export function visitesToRows(rows: VisiteRow[]) {
  return rows.map((v) => {
    const ops = v.visites_quotidiennes_operations ?? [];
    const nc = ops.filter((o) => !o.conforme).length;
    return {
      Date: d(v.date_visite),
      Établissement: v.etablissements?.nom ?? "",
      Équipement: v.equipements
        ? `${v.equipements.reference} — ${v.equipements.designation}`
        : "",
      Technicien: [v.profils_utilisateurs?.prenom, v.profils_utilisateurs?.nom]
        .filter(Boolean)
        .join(" "),
      "Points contrôlés": ops.length,
      "Non conformes": nc,
      Observations: v.observations ?? "",
      Signée: v.signature_at ? `Oui (${v.signature_nom ?? ""})` : "Non",
    };
  });
}

/** Bornes (YYYY-MM-DD) du mois précédant la date donnée. */
export function moisPrecedent(ref = new Date()): { debut: string; fin: string; label: string } {
  const debut = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
  const fin = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0));
  return {
    debut: debut.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10),
    label: debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}
