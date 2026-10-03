import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAppUser,
  deleteAppUser,
  listAppUsers,
  resetAppUserPassword,
  setAppUserActive,
  updateAppUserAccess,
  type AppUserRow,
} from "@/lib/admin-users.functions";
import { useAuth, type AppRole } from "@/lib/auth-context";

const ROLE_LABELS: { value: AppRole; label: string }[] = [
  { value: "super_admin", label: "Super admin" },
  { value: "responsable_maintenance", label: "Responsable maintenance" },
  { value: "responsable_etablissement", label: "Responsable établissement" },
  { value: "technicien", label: "Technicien" },
  { value: "gestionnaire_stock", label: "Gestionnaire de stock" },
  { value: "demandeur", label: "Demandeur" },
  { value: "prestataire", label: "Prestataire" },
];

export function ComptesUtilisateurs() {
  const { etablissements } = useAuth();
  const queryClient = useQueryClient();
  const list = useServerFn(listAppUsers);
  const [creating, setCreating] = useState(false);
  const [edited, setEdited] = useState<AppUserRow | null>(null);
  const resetFn = useServerFn(resetAppUserPassword);
  const reset = useMutation({
    mutationFn: resetFn,
    onSuccess: () => {
      toast.success("Mot de passe réinitialisé");
      invalidateLog();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Réinitialisation impossible"),
  });
  const invalidateLog = () =>
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });

  const { data: users, isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => list(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["app-users"] });
    void queryClient.invalidateQueries({ queryKey: ["technicien-profils"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const toggleActive = useMutation({
    mutationFn: useServerFn(setAppUserActive),
    onSuccess: () => {
      toast.success("Compte mis à jour");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Action impossible"),
  });

  const remove = useMutation({
    mutationFn: useServerFn(deleteAppUser),
    onSuccess: () => {
      toast.success("Compte supprimé");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Suppression impossible"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau compte
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Rôles</th>
                <th className="px-4 py-3">Établissements</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {[u.prenom, u.nom].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        u.roles.map((r) => (
                          <span
                            key={r}
                            className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                          >
                            {ROLE_LABELS.find((x) => x.value === r)?.label ?? r}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.etablissements.length === 0
                      ? "—"
                      : u.etablissements
                          .map(
                            (id) =>
                              etablissements.find((e) => e.id === id)?.nom ?? id,
                          )
                          .join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        u.actif
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-destructive/20 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {u.actif ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEdited(u)}
                      >
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleActive.isPending}
                        onClick={() =>
                          toggleActive.mutate({
                            data: { userId: u.id, active: !u.actif },
                          })
                        }
                      >
                        {u.actif ? "Désactiver" : "Réactiver"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Réinitialiser le mot de passe"
                        disabled={reset.isPending}
                        onClick={() => {
                          const pwd = window.prompt(
                            "Nouveau mot de passe provisoire (8 caractères minimum) :",
                          );
                          if (!pwd) return;
                          if (pwd.length < 8) {
                            toast.error("8 caractères minimum");
                            return;
                          }
                          reset.mutate({ data: { userId: u.id, password: pwd } });
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Supprimer définitivement ce compte ?",
                            )
                          ) {
                            remove.mutate({ data: { userId: u.id } });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          invalidate();
        }}
      />
      <EditDialog
        user={edited}
        onClose={() => setEdited(null)}
        onSaved={() => {
          setEdited(null);
          invalidate();
        }}
      />
    </div>
  );
}

function RolesEtabsFields({
  roles,
  setRoles,
  etabs,
  setEtabs,
}: {
  roles: AppRole[];
  setRoles: (r: AppRole[]) => void;
  etabs: string[];
  setEtabs: (e: string[]) => void;
}) {
  const { etablissements, hasRole } = useAuth();
  const roleOptions = hasRole("super_admin")
    ? ROLE_LABELS
    : ROLE_LABELS.filter((r) => r.value !== "super_admin");
  const toggle = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <>
      <div className="space-y-2">
        <Label>Rôles</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {roleOptions.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={roles.includes(r.value)}
                onCheckedChange={() => setRoles(toggle(roles, r.value))}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Établissements rattachés</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {etablissements.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={etabs.includes(e.id)}
                onCheckedChange={() => setEtabs(toggle(etabs, e.id))}
              />
              {e.nom}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function CreateDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["technicien"]);
  const [etabs, setEtabs] = useState<string[]>([]);
  const create = useServerFn(createAppUser);

  const save = useMutation({
    mutationFn: () =>
      create({
        data: { email, password, nom, prenom, roles, etablissements: etabs },
      }),
    onSuccess: () => {
      toast.success("Compte créé");
      setEmail("");
      setPassword("");
      setNom("");
      setPrenom("");
      setRoles(["technicien"]);
      setEtabs([]);
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Création impossible"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau compte</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe provisoire</Label>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
            />
          </div>
          <RolesEtabsFields
            roles={roles}
            setRoles={setRoles}
            etabs={etabs}
            setEtabs={setEtabs}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={
              save.isPending ||
              !email ||
              password.length < 8 ||
              !nom ||
              !prenom ||
              roles.length === 0
            }
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AppUserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [initialised, setInitialised] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [etabs, setEtabs] = useState<string[]>([]);
  const update = useServerFn(updateAppUserAccess);

  if (user && initialised !== user.id) {
    setInitialised(user.id);
    setNom(user.nom ?? "");
    setPrenom(user.prenom ?? "");
    setRoles(user.roles as AppRole[]);
    setEtabs(user.etablissements);
  }

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          userId: user!.id,
          nom,
          prenom,
          roles,
          etablissements: etabs,
        },
      }),
    onSuccess: () => {
      toast.success("Accès mis à jour");
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible"),
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user?.email ?? "Compte"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-prenom">Prénom</Label>
              <Input
                id="e-prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-nom">Nom</Label>
              <Input
                id="e-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />
            </div>
          </div>
          <RolesEtabsFields
            roles={roles}
            setRoles={setRoles}
            etabs={etabs}
            setEtabs={setEtabs}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
