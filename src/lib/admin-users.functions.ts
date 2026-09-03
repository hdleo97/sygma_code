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

    const emails = new Map(
      (authRes.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );

    return (profils ?? [])
      .map((p) => ({
        id: p.id,
        email: emails.get(p.id) ?? null,
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
    await assertAdmin(context.supabase as never, context.userId);
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
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

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
    return { ok: true };
  });

export const setAppUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas désactiver votre propre compte");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { ban_duration: data.active ? "none" : "876000h" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
