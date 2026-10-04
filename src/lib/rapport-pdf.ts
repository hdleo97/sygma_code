import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { formatDuree, natureInterventionLabel, statutInterventionLabel } from "@/lib/interventions";
import { PHASES } from "@/lib/rapport-phases";
import { fetchLogoDataUrl, fetchOrganisation } from "@/lib/parametrage";

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

type RapportRow = {
  id: string;
  description: string;
  nature: "curative" | "preventive";
  statut: "planifiee" | "en_cours" | "terminee" | "signee";
  localisation: string | null;
  date_appel: string | null;
  date_debut: string | null;
  date_fin: string | null;
  duree_minutes: number | null;
  pieces_utilisees: string | null;
  observations: string | null;
  interventions_complementaires: string | null;
  signature_superviseur: string | null;
  signature_superviseur_nom: string | null;
  signature_superviseur_at: string | null;
  signature_valideur: string | null;
  signature_valideur_nom: string | null;
  signature_valideur_at: string | null;
  equipements: {
    reference: string;
    designation: string;
    marque: string | null;
    modele: string | null;
    numero_serie: string | null;
    zone: string | null;
  } | null;
  intervention_techniciens: {
    profils_utilisateurs: { nom: string | null; prenom: string | null } | null;
  }[];
};

type OpRow = {
  phase: number;
  libelle_libre: string | null;
  commentaire: string | null;
  checklist_operations: { libelle: string } | null;
};

/** Génère et télécharge le rapport d'intervention au format PDF. */
export async function exporterRapportPdf(interventionId: string): Promise<void> {
  const { data, error } = await supabase
    .from("interventions")
    .select(
      "*, equipements(reference, designation, marque, modele, numero_serie, zone), intervention_techniciens(profils_utilisateurs:profils_utilisateurs!intervention_techniciens_technicien_id_fkey(nom, prenom))",
    )
    .eq("id", interventionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Intervention introuvable");
  const row = data as unknown as RapportRow;

  const { data: opsData, error: opsError } = await supabase
    .from("rapport_operations_realisees")
    .select("phase, libelle_libre, commentaire, checklist_operations(libelle)")
    .eq("intervention_id", interventionId)
    .order("phase")
    .order("created_at");
  if (opsError) throw opsError;
  const ops = (opsData ?? []) as unknown as OpRow[];

  const org = await fetchOrganisation();
  const logo = await fetchLogoDataUrl(org.logo_path);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marge = 40;
  const largeur = doc.internal.pageSize.getWidth();

  // En-tête (logo générique)
  doc.setFillColor(23, 37, 84);
  doc.rect(0, 0, largeur, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  let xTitre = marge;
  if (logo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.rect(marge - 4, 8, 56, 48, "F");
      doc.addImage(logo, marge, 12, 48, 40, undefined, "FAST");
      xTitre = marge + 62;
    } catch {
      /* logo illisible : on l'ignore */
    }
  }
  doc.text(org.nom_organisation, xTitre, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Rapport d'intervention", xTitre, 46);
  doc.text(
    `Édité le ${new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`,
    largeur - marge,
    46,
    { align: "right" },
  );
  doc.setTextColor(0, 0, 0);

  const techs =
    row.intervention_techniciens
      .map((t) =>
        [t.profils_utilisateurs?.prenom, t.profils_utilisateurs?.nom]
          .filter(Boolean)
          .join(" "),
      )
      .filter(Boolean)
      .join(", ") || "—";

  autoTable(doc, {
    startY: 84,
    head: [["Équipement", ""]],
    body: [
      [
        "Désignation",
        row.equipements
          ? `${row.equipements.reference} — ${row.equipements.designation}`
          : "—",
      ],
      ["Marque / Modèle", `${row.equipements?.marque ?? "—"} / ${row.equipements?.modele ?? "—"}`],
      ["Numéro de série", row.equipements?.numero_serie ?? "—"],
      ["Localisation", row.localisation ?? row.equipements?.zone ?? "—"],
      ["Nature", natureInterventionLabel(row.nature)],
      ["Statut", statutInterventionLabel(row.statut)],
    ],
    theme: "grid",
    headStyles: { fillColor: [23, 37, 84] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } },
    margin: { left: marge, right: marge },
  });

  autoTable(doc, {
    head: [["Dates et durée", ""]],
    body: [
      ["Appel", fmt(row.date_appel)],
      ["Début", fmt(row.date_debut)],
      ["Fin", fmt(row.date_fin)],
      ["Durée", formatDuree(row.duree_minutes)],
      ["Technicien(s)", techs],
    ],
    theme: "grid",
    headStyles: { fillColor: [23, 37, 84] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } },
    margin: { left: marge, right: marge },
  });

  for (const p of PHASES) {
    const phaseOps = ops.filter((o) => o.phase === p.value);
    autoTable(doc, {
      head: [[`Phase ${p.value} — ${p.label}`]],
      body:
        phaseOps.length > 0
          ? phaseOps.map((o) => [
              `• ${o.checklist_operations?.libelle ?? o.libelle_libre ?? "—"}${o.commentaire ? ` (${o.commentaire})` : ""}`,
            ])
          : [["Aucune opération enregistrée"]],
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: marge, right: marge },
    });
  }

  autoTable(doc, {
    head: [["Compte rendu", ""]],
    body: [
      ["Pièces utilisées", row.pieces_utilisees || "—"],
      ["Observations", row.observations || "—"],
      ["Interventions complémentaires", row.interventions_complementaires || "—"],
    ],
    theme: "grid",
    headStyles: { fillColor: [23, 37, 84] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } },
    margin: { left: marge, right: marge },
  });

  // Signatures
  type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };
  let y = ((doc as DocWithTable).lastAutoTable?.finalY ?? 400) + 24;
  if (y > doc.internal.pageSize.getHeight() - 150) {
    doc.addPage();
    y = marge;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Signatures", marge, y);
  y += 12;

  const colW = (largeur - marge * 2 - 20) / 2;
  const blocs: [string, string | null, string | null, string | null][] = [
    [
      "Superviseur technique",
      row.signature_superviseur,
      row.signature_superviseur_nom,
      row.signature_superviseur_at,
    ],
    [
      "Valideur",
      row.signature_valideur,
      row.signature_valideur_nom,
      row.signature_valideur_at,
    ],
  ];

  blocs.forEach(([titre, image, nom, date], i) => {
    const x = marge + i * (colW + 20);
    doc.setDrawColor(200);
    doc.rect(x, y, colW, 110);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(titre, x + 6, y + 14);
    doc.setFont("helvetica", "normal");
    if (image) {
      try {
        doc.addImage(image, "PNG", x + 6, y + 20, colW - 12, 60);
      } catch {
        doc.text("Signature non affichable", x + 6, y + 40);
      }
    }
    doc.text(nom || "—", x + 6, y + 92);
    doc.text(fmt(date), x + 6, y + 104);
  });

  const ref = row.equipements?.reference ?? "intervention";
  doc.save(`rapport-${ref}-${interventionId.slice(0, 8)}.pdf`);
}
