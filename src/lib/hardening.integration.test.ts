import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
const env = loadEnv("development", process.cwd(), "VITE_");
const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON
  ? JSON.parse(process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON) : null;
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} },
});
describe.skipIf(!session)("production isolation", () => {
  it("denies direct legacy global role mutations", async () => {
    const result = await client.from("user_roles").insert({ user_id: session.user.id, role: "super_admin" });
    expect(result.error?.code).toBe("42501");
  });
  it("denies site configuration outside membership", async () => {
    const result = await client.from("parametres_site").insert({ etablissement_id: "00000000-0000-0000-0000-000000000001", inactivite_minutes: 30 });
    expect(result.error?.code).toBe("42501");
  });
  it("denies direct site membership mutation", async () => {
    const result = await client.from("utilisateur_etablissements").insert({ user_id: session.user.id, etablissement_id: "00000000-0000-0000-0000-000000000001" });
    expect(result.error?.code).toBe("42501");
  });
  it("rejects processing an inaccessible stock request", async () => {
    const result = await client.rpc("traiter_sortie", { _demande_id: "00000000-0000-0000-0000-000000000001", _magasin_id: "00000000-0000-0000-0000-000000000002", _quantites: [] });
    expect(result.error?.code).toBe("P0001");
  });
});