import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSiteAssignments, assertWholeAccountScope, type SiteAssignment } from "@/lib/site-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppUserRow = {
  id: string; email: string | null; nom: string | null; prenom: string | null;
  roles: string[]; etablissements: string[]; affectations: SiteAssignment[]; actif: boolean;
};
const ROLES = ["super_admin", "responsable_maintenance", "technicien", "demandeur", "gestionnaire_stock", "prestataire", "responsable_etablissement"] as const;
const assignmentSchema = z.array(z.object({ etablissement_id: z.string().uuid(), role: z.enum(ROLES) })).min(1);

async function auditAction(userId: string, targetId: string, action: string, scope: Map<string, boolean>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("audit_logs").insert({ user_id: userId, record_id: targetId, action,
    table_name: "comptes", details: { etablissements: [...scope.keys()] } });
  if (error) throw error;
}

async function managementScope(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.from("utilisateur_etablissement_roles").select("etablissement_id, role").eq("user_id", userId);
  if (error) throw error;
  const scope = new Map<string, boolean>();
  for (const row of data ?? []) {
    if (row.role === "super_admin" || row.role === "responsable_maintenance") {
      scope.set(row.etablissement_id, scope.get(row.etablissement_id) === true || row.role === "super_admin");
    }
  }
  if (!scope.size) throw new Error("Accès refusé");
  return scope;
}
async function targetScope(client: SupabaseClient<Database>, userId: string, scope: Map<string, boolean>, whole = false) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: links, error } = await supabaseAdmin.from("utilisateur_etablissements").select("etablissement_id").eq("user_id", userId);
  if (error) throw error;
  const sites = (links ?? []).map(r => r.etablissement_id);
  if (!sites.some(id => scope.has(id))) throw new Error("Compte inaccessible");
  if (whole) assertWholeAccountScope(sites, scope);
  const { data: roles } = await client.from("utilisateur_etablissement_roles").select("etablissement_id, role").eq("user_id", userId);
  if ((roles ?? []).some(r => scope.has(r.etablissement_id) && r.role === "super_admin" && !scope.get(r.etablissement_id))) {
    throw new Error("Seul un super admin de cet établissement peut modifier ce compte");
  }
  return supabaseAdmin;
}
export const listAppUsers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<AppUserRow[]> => {
  const scope = await managementScope(context.supabase, context.userId);
  const { data: assignments, error } = await context.supabase.from("utilisateur_etablissement_roles").select("user_id, etablissement_id, role").in("etablissement_id", [...scope.keys()]);
  if (error) throw error;
  const ids = [...new Set((assignments ?? []).map(r => r.user_id))];
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await context.supabase.from("profils_utilisateurs").select("id, nom, prenom").in("id", ids);
  if (profileError) throw profileError;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return Promise.all((profiles ?? []).map(async p => {
    const { data, error: authError } = await supabaseAdmin.auth.admin.getUserById(p.id);
    if (authError) throw authError;
    const rows = (assignments ?? []).filter(r => r.user_id === p.id).map(({ etablissement_id, role }) => ({ etablissement_id, role }));
    const banned = (data.user as { banned_until?: string } | null)?.banned_until;
    return { ...p, email: data.user?.email ?? null, actif: !banned || new Date(banned).getTime() <= Date.now(),
      affectations: rows, roles: [...new Set(rows.map(r => r.role))], etablissements: [...new Set(rows.map(r => r.etablissement_id))] };
  }));
});
export const createAppUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({
  email: z.string().email(), password: z.string().min(8), nom: z.string().min(1), prenom: z.string().min(1),
  roles: z.array(z.enum(ROLES)), etablissements: z.array(z.string().uuid()), affectations: assignmentSchema,
}).parse(input)).handler(async ({ data, context }) => {
  const scope = await managementScope(context.supabase, context.userId);
  assertSiteAssignments(data.affectations, scope);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true, user_metadata: { nom: data.nom, prenom: data.prenom } });
  if (error || !created.user) throw new Error(error?.message ?? "Création impossible");
  const id = created.user.id;
  try {
    const { error: profileError } = await supabaseAdmin.from("profils_utilisateurs").upsert({ id, nom: data.nom, prenom: data.prenom });
    if (profileError) throw profileError;
    const { error: accessError } = await context.supabase.rpc("set_user_site_access", { _target: id, _assignments: data.affectations });
    if (accessError) throw accessError;
  } catch (e) { await supabaseAdmin.auth.admin.deleteUser(id); throw e; }
  await auditAction(context.userId, id, "creation_compte", scope);
  return { id };
});
export const updateAppUserAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({
  userId: z.string().uuid(), nom: z.string().nullable(), prenom: z.string().nullable(),
  roles: z.array(z.enum(ROLES)), etablissements: z.array(z.string().uuid()), affectations: assignmentSchema,
}).parse(input)).handler(async ({ data, context }) => {
  const scope = await managementScope(context.supabase, context.userId);
  assertSiteAssignments(data.affectations, scope);
  const admin = await targetScope(context.supabase, data.userId, scope);
  const { error } = await context.supabase.rpc("set_user_site_access", { _target: data.userId, _assignments: data.affectations });
  if (error) throw error;
  const { error: profileError } = await admin.from("profils_utilisateurs").update({ nom: data.nom, prenom: data.prenom }).eq("id", data.userId);
  if (profileError) throw profileError;
  return { ok: true };
});
export const setAppUserActive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
  const scope = await managementScope(context.supabase, context.userId);
  if (data.userId === context.userId) throw new Error("Vous ne pouvez pas désactiver votre propre compte");
  const admin = await targetScope(context.supabase, data.userId, scope, true);
  const { error } = await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
  if (error) throw error;
  await auditAction(context.userId, data.userId, data.active ? "reactivation_compte" : "desactivation_compte", scope);
  return { ok: true };
});
export const deleteAppUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ userId: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
  const scope = await managementScope(context.supabase, context.userId);
  if (data.userId === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
  const admin = await targetScope(context.supabase, data.userId, scope, true);
  const { error } = await admin.auth.admin.deleteUser(data.userId);
  if (error) throw error;
  return { ok: true };
});
export const resetAppUserPassword = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ userId: z.string().uuid(), password: z.string().min(8) }).parse(input)).handler(async ({ data, context }) => {
  const scope = await managementScope(context.supabase, context.userId);
  const admin = await targetScope(context.supabase, data.userId, scope, true);
  const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
  if (error) throw error;
  return { ok: true };
});
