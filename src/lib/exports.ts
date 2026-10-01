import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ExportFormat = "xlsx" | "csv" | "pdf";
export type ExportRow = Record<string, string | number | null | undefined>;

const MIME: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8",
  pdf: "application/pdf",
};

function headersOf(rows: ExportRow[], columns?: string[]): string[] {
  return columns ?? (rows[0] ? Object.keys(rows[0]) : []);
}

/** Construit un fichier (Excel, CSV ou PDF) à partir d'une liste de lignes. */
export function buildExport(
  rows: ExportRow[],
  format: ExportFormat,
  titre: string,
  options: { columns?: string[]; sousTitre?: string } = {},
): Blob {
  const cols = headersOf(rows, options.columns);
  const clean = rows.map((r) =>
    Object.fromEntries(cols.map((c) => [c, r[c] ?? ""])),
  );

  if (format === "pdf") {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
    const largeur = doc.internal.pageSize.getWidth();
    doc.setFillColor(23, 37, 84);
    doc.rect(0, 0, largeur, 56, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SYGMA", 32, 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(titre, 32, 42);
    doc.text(
      `Édité le ${new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`,
      largeur - 32,
      42,
      { align: "right" },
    );
    doc.setTextColor(0, 0, 0);
    let y = 72;
    if (options.sousTitre) {
      doc.setFontSize(9);
      doc.text(options.sousTitre, 32, y);
      y += 10;
    }
    autoTable(doc, {
      startY: y,
      head: [cols],
      body: clean.length
        ? clean.map((r) => cols.map((c) => String(r[c] ?? "")))
        : [[{ content: "Aucune donnée", colSpan: Math.max(cols.length, 1) }]],
      theme: "grid",
      headStyles: { fillColor: [23, 37, 84], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 3 },
      margin: { left: 32, right: 32 },
    });
    return doc.output("blob");
  }

  const sheet = XLSX.utils.json_to_sheet(clean, { header: cols });
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
    return new Blob(["\uFEFF" + csv], { type: MIME.csv });
  }
  sheet["!cols"] = cols.map((c) => ({
    wch: Math.min(
      50,
      Math.max(c.length, ...clean.map((r) => String(r[c] ?? "").length)) + 2,
    ),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Données");
  const out = XLSX.write(book, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: MIME.xlsx });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .toLowerCase();
}

export function exportRows(
  rows: ExportRow[],
  format: ExportFormat,
  titre: string,
  options: { columns?: string[]; sousTitre?: string } = {},
): void {
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    buildExport(rows, format, titre, options),
    `${slug(titre)}-${date}.${format}`,
  );
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
