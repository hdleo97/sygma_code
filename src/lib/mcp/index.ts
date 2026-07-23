import { auth, defineMcp } from "@lovable.dev/mcp-js";
import pingTool from "./tools/ping";

// The OAuth issuer MUST be the direct Supabase host — the .lovable.cloud proxy
// URL is rejected by mcp-js (RFC 8414 issuer mismatch). VITE_SUPABASE_PROJECT_ID
// is inlined at build time by Vite; the fallback keeps the issuer well-formed
// during the throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "sygma-mcp",
  title: "SYGMA MCP",
  version: "0.1.0",
  instructions:
    "Serveur MCP SYGMA (Gestion de Maintenance Assistée). Les outils agissent au nom de l'utilisateur SYGMA authentifié. Utilisez `ping` pour vérifier la connexion.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [pingTool],
});
