import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppUserRow = {
  id: string;
  email: string | null;
  nom: string | null;
  prenom: string | null;
  roles: string[];
  etablissements: string[];
  actif: boolean;
};

const ROLES = [
  "super_admin",
  "responsable_maintenance",
  "technicien",
  "demandeur",
  "gestionnaire_stock",
  "prestataire",
  "responsable_etablissement",
] as const;

async function assertAdmin(supabase: {
  rpc: (
    fn: "has_role",
    args: { _user_id: string; _role: (typeof ROLES)[number] },
  ) => PromiseLike<{ data: boolean | null }>;
}, userId: string) {
  const [a, b] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    supabase.rpc("has_role", {
      _user_id: userId,
      _role: "responsable_maintenance",
    }),
  ]);
  if (!a.data && !b.data) throw new Error("Accès refusé");
  return { isSuper: !!a.data };
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function assertTargetAllowed(
  admin: AdminClient,
  isSuper: boolean,
  targetId: string,
) {
  if (isSuper) return;
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetId)
    .eq("role", "super_admin");
  if (data && data.length > 0) {
    throw new Error("Seul un super admin peut modifier ce compte");
  }
}

async function audit(
  admin: AdminClient,
  userId: string,
  action: string,
  recordId: string,
  details: Record<string, unknown> = {},
) {
  await admin.from("audit_logs" as never).insert({
    user_id: userId,
    action,
    table_name: "comptes",
    record_id: recordId,
    details,
  } as never);
}

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUserRow[]> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const [{ data: profils }, { data: roles }, { data: liens }, authRes] =
      await Promise.all([
        supabaseAdmin.from("profils_utilisateurs").select("id, nom, prenom"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin
          .from("utilisateur_etablissements")
          .select("user_id, etablissement_id"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

    const authUsers = new Map(
      (authRes.data?.users ?? []).map((u) => [
        u.id,
        {
          email: u.email ?? null,
          actif: !(u as { banned_until?: string | null }).banned_until,
        },
      ]),
    );

    return (profils ?? [])
      .map((p) => ({
        id: p.id,
        email: authUsers.get(p.id)?.email ?? null,
        actif: authUsers.get(p.id)?.actif ?? true,
        nom: p.nom,
        prenom: p.prenom,
        roles: (roles ?? [])
          .filter((r) => r.user_id === p.id)
          .map((r) => r.role as string),
        etablissements: (liens ?? [])
          .filter((l) => l.user_id === p.id)
          .map((l) => l.etablissement_id),
      }))
      .sort((a, b) =>
        `${a.prenom ?? ""} ${a.nom ?? ""}`.localeCompare(
          `${b.prenom ?? ""} ${b.nom ?? ""}`,
        ),
      );
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        nom: z.string().min(1),
        prenom: z.string().min(1),
        roles: z.array(z.enum(ROLES)).min(1),
        etablissements: z.array(z.string().uuid()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase as never, context.userId);
    if (!isSuper && data.roles.includes("super_admin")) {
      throw new Error("Seul un super admin peut attribuer ce rôle");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nom: data.nom, prenom: data.prenom },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Création du compte impossible");
    }
    const uid = created.user.id;

    await supabaseAdmin
      .from("profils_utilisateurs")
      .upsert({ id: uid, nom: data.nom, prenom: data.prenom });

    if (data.roles.length) {
      await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: uid, role })));
    }
    if (data.etablissements.length) {
      await supabaseAdmin.from("utilisateur_etablissements").insert(
        data.etablissements.map((etablissement_id) => ({
          user_id: uid,
          etablissement_id,
        })),
      );
    }
    await audit(supabaseAdmin, context.userId, "creation_compte", uid, {
      email: data.email,
      roles: data.roles,
      etablissements: data.etablissements,
    });
    return { id: uid };
  });

export const updateAppUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        nom: z.string().nullable().optional(),
        prenom: z.string().nullable().optional(),
        roles: z.array(z.enum(ROLES)),
        etablissements: z.array(z.string().uuid()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase as never, context.userId);
    if (!isSuper && data.roles.includes("super_admin")) {
      throw new Error("Seul un super admin peut attribuer ce rôle");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await assertTargetAllowed(supabaseAdmin, isSuper, data.userId);

    if (data.nom !== undefined || data.prenom !== undefined) {
      await supabaseAdmin
        .from("profils_utilisateurs")
        .update({ nom: data.nom ?? null, prenom: data.prenom ?? null })
        .eq("id", data.userId);
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (data.roles.length) {
      await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: data.userId, role })));
    }

    await supabaseAdmin
      .from("utilisateur_etablissements")
      .delete()
      .eq("user_id", data.userId);
    if (data.etablissements.length) {
      await supabaseAdmin.from("utilisateur_etablissements").insert(
        data.etablissements.map((etablissement_id) => ({
          user_id: data.userId,
          etablissement_id,
        })),
      );
    }
    await audit(supabaseAdmin, context.userId, "modification_droits", data.userId, {
      roles: data.roles,
      etablissements: data.etablissements,
    });
    return { ok: true };
  });

export const setAppUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas désactiver votre propre compte");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await assertTargetAllowed(supabaseAdmin, isSuper, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { ban_duration: data.active ? "none" : "876000h" },
    );
    if (error) throw new Error(error.message);
    await audit(
      supabaseAdmin,
      context.userId,
      data.active ? "reactivation_compte" : "desactivation_compte",
      data.userId,
    );
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await assertTargetAllowed(supabaseAdmin, isSuper, data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, context.userId, "suppression_compte", data.userId);
    return { ok: true };
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), password: z.string().min(8) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await assertTargetAllowed(supabaseAdmin, isSuper, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { password: data.password },
    );
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, context.userId, "reinitialisation_mot_de_passe", data.userId);
    return { ok: true };
  });
