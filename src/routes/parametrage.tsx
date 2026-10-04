import { createFileRoute } from "@tanstack/react-router";

import { ComptesUtilisateurs } from "@/components/comptes-utilisateurs";
import { JournalAudit } from "@/components/parametrage/audit";
import { ParametrageChecklists } from "@/components/parametrage/checklists";
import { ParametrageIdentite } from "@/components/parametrage/identite";
import { ParametrageNotifications } from "@/components/parametrage/notifications";
import { ParametrageReferentiels } from "@/components/parametrage/referentiels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/parametrage")({
  head: () => ({
    meta: [
      { title: "Paramétrage — SYGMA" },
      { name: "description", content: "Administration de SYGMA : utilisateurs, checklists, référentiels, notifications, identité et journal d'audit." },
      { property: "og:title", content: "Paramétrage — SYGMA" },
      { property: "og:description", content: "Espace d'administration de la GMAO SYGMA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParametragePage,
});

function ParametragePage() {
  const { loading, hasRole } = useAuth();
  const isSuper = hasRole("super_admin");
  const isResp = hasRole("responsable_maintenance");

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (!isSuper && !isResp) {
    return <div className="p-6 text-sm text-muted-foreground">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Paramétrage</h1>
        <p className="text-sm text-muted-foreground">
          {isSuper ? "Administration complète de l'application." : "Accès restreint : utilisateurs, checklists et référentiels."}
        </p>
      </div>
      <Tabs defaultValue="utilisateurs">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="referentiels">Référentiels</TabsTrigger>
          {isSuper && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
          {isSuper && <TabsTrigger value="identite">Identité visuelle</TabsTrigger>}
          {isSuper && <TabsTrigger value="audit">Journal d'audit</TabsTrigger>}
        </TabsList>
        <TabsContent value="utilisateurs" className="mt-4"><ComptesUtilisateurs /></TabsContent>
        <TabsContent value="checklists" className="mt-4"><ParametrageChecklists /></TabsContent>
        <TabsContent value="referentiels" className="mt-4"><ParametrageReferentiels /></TabsContent>
        {isSuper && <TabsContent value="notifications" className="mt-4"><ParametrageNotifications /></TabsContent>}
        {isSuper && <TabsContent value="identite" className="mt-4"><ParametrageIdentite /></TabsContent>}
        {isSuper && <TabsContent value="audit" className="mt-4"><JournalAudit /></TabsContent>}
      </Tabs>
    </div>
  );
}
