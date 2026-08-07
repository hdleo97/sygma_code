import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getDocumentUrl,
  isPdf,
  uploadDocumentEquipement,
  type DocumentKind,
} from "@/lib/preventif";

function Viewer({ path, title }: { path: string | null; title: string }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["equipement-doc", path],
    queryFn: () => getDocumentUrl(path),
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
  });

  if (!path) {
    return (
      <p className="text-sm text-muted-foreground">Aucun document importé.</p>
    );
  }
  if (isLoading || !url) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du document…
      </div>
    );
  }
  if (isPdf(path)) {
    return (
      <iframe
        src={url}
        title={title}
        className="h-[70vh] w-full rounded-md border border-border bg-muted/20"
      />
    );
  }
  return (
    <img
      src={url}
      alt={title}
      className="max-h-[70vh] w-full rounded-md border border-border object-contain"
    />
  );
}

function DocumentBloc({
  equipementId,
  kind,
  path,
  titre,
  onUploaded,
}: {
  equipementId: string;
  kind: DocumentKind;
  path: string | null;
  titre: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4" />
          {titre}
        </h3>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              try {
                await uploadDocumentEquipement(equipementId, kind, file);
                toast.success("Document importé");
                onUploaded();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Import impossible",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {path ? "Remplacer" : "Importer"}
          </Button>
        </div>
      </div>
      <Viewer path={path} title={titre} />
    </section>
  );
}

export function EquipementDocuments({
  equipementId,
  manuelPath,
  gammePath,
  onUploaded,
}: {
  equipementId: string;
  manuelPath: string | null;
  gammePath: string | null;
  onUploaded: () => void;
}) {
  return (
    <div className="grid gap-4">
      <DocumentBloc
        equipementId={equipementId}
        kind="manuel_path"
        path={manuelPath}
        titre="Manuel technique"
        onUploaded={onUploaded}
      />
      <DocumentBloc
        equipementId={equipementId}
        kind="gamme_path"
        path={gammePath}
        titre="Gamme de maintenance préventive"
        onUploaded={onUploaded}
      />
    </div>
  );
}
