import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

// Run against a managed, authenticated preview session; never use an admin key.
const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const env = loadEnv("development", process.cwd(), "VITE_");
const session = sessionJson ? JSON.parse(sessionJson) : null;
const client = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} },
  },
);

describe.skipIf(!session)("demand creation with authenticated site isolation", () => {
  let siteId = "";
  let demandeId = "";

  beforeAll(async () => {
    const { data, error } = await client.from("utilisateur_etablissement_roles")
      .select("etablissement_id").eq("user_id", session.user.id).eq("role", "super_admin").limit(1);
    if (error || !data?.[0]) throw new Error("A site-scoped super admin session is required");
    siteId = data[0].etablissement_id;
  });

  afterAll(async () => {
    if (!demandeId) return;
    const { error } = await client.from("demandes_intervention").delete().eq("id", demandeId);
    if (error) throw error;
  });

  it("creates and immediately reads the requester's new demand at an assigned site", async () => {
    const { data, error } = await client.from("demandes_intervention").insert({
      etablissement_id: siteId, demandeur_id: session.user.id,
      description: "Audit automatisé SYGMA — création DI", priorite: "moyenne",
    }).select("id, statut, demandeur_id, etablissement_id").single();
    if (data) demandeId = data.id;
    expect(error).toBeNull();
    expect(data).toMatchObject({ statut: "nouvelle", demandeur_id: session.user.id, etablissement_id: siteId });
    const reread = await client.from("demandes_intervention").select("id").eq("id", demandeId).single();
    expect(reread.error).toBeNull();
    expect(reread.data?.id).toBe(demandeId);
  });

  it("logs creation and the allowed Nouvelle → Validée transition", async () => {
    expect(demandeId).not.toBe("");
    const updated = await client.from("demandes_intervention").update({ statut: "validee" }).eq("id", demandeId);
    expect(updated.error).toBeNull();
    const history = await client.from("demandes_intervention_historique")
      .select("ancien_statut, nouveau_statut, user_id").eq("demande_id", demandeId).order("created_at");
    expect(history.error).toBeNull();
    expect(history.data).toEqual([
      { ancien_statut: null, nouveau_statut: "nouvelle", user_id: session.user.id },
      { ancien_statut: "nouvelle", nouveau_statut: "validee", user_id: session.user.id },
    ]);
  });

  it("rejects Validée → Terminée and leaves the status unchanged", async () => {
    expect(demandeId).not.toBe("");
    const result = await client.from("demandes_intervention").update({ statut: "terminee" }).eq("id", demandeId);
    expect(result.error?.code).toBe("P0001");
    const reread = await client.from("demandes_intervention").select("statut").eq("id", demandeId).single();
    expect(reread.data?.statut).toBe("validee");
  });

  it("rejects a demand at an unassigned site even for super admin", async () => {
    const result = await client.from("demandes_intervention").insert({
      etablissement_id: "00000000-0000-0000-0000-000000000001",
      demandeur_id: session.user.id, description: "Must be rejected", priorite: "moyenne",
    }).select("id");
    expect(result.error?.code).toBe("42501");
  });

  it("does not allow direct history insertion", async () => {
    expect(demandeId).not.toBe("");
    const result = await client.from("demandes_intervention_historique").insert({
      demande_id: demandeId, user_id: session.user.id, nouveau_statut: "cloturee",
    });
    expect(result.error?.code).toBe("42501");
  });
});