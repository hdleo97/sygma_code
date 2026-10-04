import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/parametrage";

type Notif = {
  evenement: string;
  libelle: string;
  actif: boolean;
  destinataires: string;
  sujet: string;
  contenu: string;
};

export function ParametrageNotifications() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["param-notifs"],
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await db.from("parametres_notifications").select("*").order("libelle");
      if (error) throw error;
      return data ?? [];
    },
  });
  const save = useMutation({
    mutationFn: async (n: Notif) => {
      const { error } = await db
        .from("parametres_notifications")
        .update({ actif: n.actif, destinataires: n.destinataires, sujet: n.sujet, contenu: n.contenu })
        .eq("evenement", n.evenement);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification enregistrée");
      void qc.invalidateQueries({ queryKey: ["param-notifs"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
        Les e-mails partiront dès qu'un domaine d'envoi sera configuré. Destinataires : rôles
        (ex. responsable_maintenance, demandeur, superieur) ou adresses e-mail, séparés par des
        virgules. Variables possibles : {"{{description}}"}, {"{{statut}}"}, {"{{numero}}"}…
      </p>
      {(data ?? []).map((n) => (
        <NotifCard key={n.evenement} n={n} onSave={(x) => save.mutate(x)} />
      ))}
    </div>
  );
}

function NotifCard({ n, onSave }: { n: Notif; onSave: (n: Notif) => void }) {
  const id = n.evenement;
  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          ...n,
          actif: f.get("actif") === "on",
          destinataires: String(f.get("destinataires") ?? ""),
          sujet: String(f.get("sujet") ?? ""),
          contenu: String(f.get("contenu") ?? ""),
        });
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{n.libelle}</h3>
        <label className="flex items-center gap-2 text-sm">
          <Switch name="actif" defaultChecked={n.actif} /> Activée
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-d`}>Destinataires</Label>
          <Input id={`${id}-d`} name="destinataires" defaultValue={n.destinataires} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-s`}>Sujet</Label>
          <Input id={`${id}-s`} name="sujet" defaultValue={n.sujet} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-c`}>Contenu</Label>
        <Textarea id={`${id}-c`} name="contenu" rows={3} defaultValue={n.contenu} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">Enregistrer</Button>
      </div>
    </form>
  );
}
