import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { inactivityExpired, inactivityMinutes } from "@/lib/inactivity";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";

export function InactivitySession() {
  const { user, currentEtablissementId, signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [warning, setWarning] = useState(false);
  const exiting = useRef(false);
  const resume = useRef<() => void>(() => {});
  const { data } = useQuery({
    queryKey: ["inactivity-settings", currentEtablissementId],
    enabled: Boolean(user && currentEtablissementId),
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!currentEtablissementId) return null;
      const { data, error } = await supabase.from("parametres_site").select("inactivite_minutes").eq("etablissement_id", currentEtablissementId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const minutes = inactivityMinutes(data?.inactivite_minutes);

  useEffect(() => {
    if (!user) return;
    const key = `sygma.activity.${user.id}`;
    const readLast = () => {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value > 0 ? Math.min(value, Date.now()) : Date.now();
    };
    let last = readLast();
    let lastWrite = 0;
    exiting.current = false;
    if (!localStorage.getItem(key)) localStorage.setItem(key, String(last));
    const exit = async () => {
      if (exiting.current) return;
      exiting.current = true;
      setWarning(false);
      await qc.cancelQueries();
      qc.clear();
      // Remove local session even if revocation is unavailable/offline.
      try { await signOut(); } finally {
        toast.info("Vous avez été déconnecté après une période d’inactivité.");
        await navigate({ to: "/auth", search: { next: "" }, replace: true });
      }
    };
    const check = () => {
      const now = Date.now();
      last = Math.max(last, readLast());
      if (inactivityExpired(last, now, minutes)) { void exit(); return; }
      setWarning(now - last >= minutes * 60_000 - 60_000);
    };
    const activity = () => {
      if (exiting.current) return;
      // An input arriving after suspension cannot revive an expired session.
      if (inactivityExpired(Math.max(last, readLast()), Date.now(), minutes)) { void exit(); return; }
      last = Date.now();
      if (last - lastWrite > 1000) { localStorage.setItem(key, String(last)); lastWrite = last; }
      setWarning(false);
    };
    resume.current = () => { lastWrite = 0; activity(); };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 1000);
    check();
    return () => {
      events.forEach(event => window.removeEventListener(event, activity));
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [user?.id, minutes, qc, navigate, signOut]);

  return <AlertDialog open={warning}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Votre session va expirer</AlertDialogTitle>
        <AlertDialogDescription>Déconnexion dans moins d’une minute en raison de votre inactivité.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter><Button onClick={() => resume.current()}>Rester connecté</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}