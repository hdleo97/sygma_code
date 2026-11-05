import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { db, fetchLogoDataUrl, fetchOrganisation } from "@/lib/parametrage";
import { currentSiteId } from "@/lib/current-site";

export function ParametrageIdentite() {
  const qc = useQueryClient();
  const { data: org } = useQuery({ queryKey: ["organisation"], queryFn: () => fetchOrganisation() });
  const { data: logo } = useQuery({
    queryKey: ["organisation-logo", org?.logo_path],
    queryFn: () => fetchLogoDataUrl(org?.logo_path ?? null),
    enabled: !!org,
  });
  const [nom, setNom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (org) setNom(org.nom_organisation);
  }, [org]);

  const save = useMutation({
    mutationFn: async () => {
      let logo_path = org?.logo_path ?? null;
      if (file) {
        if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(file.type)) throw new Error("Vous devez choisir une image PNG ou JPG de 2 Mo maximum.");
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
        logo_path = `${currentSiteId()}/logo-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("branding").upload(logo_path, file);
        if (error) throw error;
      }
      const { error } = await db
        .from("parametres_site")
        .upsert({ etablissement_id: currentSiteId(), nom_organisation: nom.trim() || "SYGMA", logo_path });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Identité enregistrée");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["organisation"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Le nom et le logo apparaissent dans l'en-tête des rapports PDF.
      </p>
      <div className="space-y-1">
        <Label htmlFor="org-nom">Nom de l'organisation</Label>
        <Input id="org-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="org-logo">Logo (PNG ou JPG, 2 Mo max)</Label>
        <Input
          id="org-logo"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {logo && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <img src={logo} alt="Logo actuel" className="h-16 object-contain" />
        </div>
      )}
      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </div>
  );
}
