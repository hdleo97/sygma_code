import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inactivityMinutes } from "@/lib/inactivity";

export function ParametrageSecurite() {
  const { currentEtablissementId } = useAuth();
  const qc = useQueryClient();
  const [minutes, setMinutes] = useState("30");
  const { data } = useQuery({ queryKey: ["inactivity-settings", currentEtablissementId], queryFn: async () => {
    if (!currentEtablissementId) return null;
    const { data, error } = await supabase.from("parametres_site").select("inactivite_minutes").eq("etablissement_id", currentEtablissementId).maybeSingle();
    if (error) throw error;
    return data;
  } });
  useEffect(() => { setMinutes(String(inactivityMinutes(data?.inactivite_minutes))); }, [data]);
  const save = useMutation({ mutationFn: async () => {
    if (!currentEtablissementId) throw new Error("Établissement obligatoire");
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 5 || value > 480) throw new Error("Vous devez choisir entre 5 et 480 minutes.");
    const { error } = await supabase.from("parametres_site").upsert({ etablissement_id: currentEtablissementId, inactivite_minutes: value });
    if (error) throw error;
  }, onSuccess: () => { toast.success("Durée d’inactivité enregistrée"); void qc.invalidateQueries({ queryKey: ["inactivity-settings"] }); } });
  return <form className="max-w-lg space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <h2 className="text-lg font-semibold">Sécurité des sessions</h2>
    <div className="space-y-2"><Label htmlFor="idle-minutes">Déconnexion après inactivité (minutes)</Label>
      <Input id="idle-minutes" type="number" required min={5} max={480} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} />
    </div>
    <Button type="submit" disabled={save.isPending || !currentEtablissementId}>Enregistrer</Button>
  </form>;
}