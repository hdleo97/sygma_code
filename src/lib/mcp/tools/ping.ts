import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "ping",
  title: "Ping SYGMA",
  description:
    "Vérifie la connexion au serveur MCP SYGMA et renvoie l'identité de l'utilisateur authentifié.",
  inputSchema: {
    message: z
      .string()
      .optional()
      .describe("Message facultatif à renvoyer tel quel pour tester l'aller-retour."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ message }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Non authentifié." }],
        isError: true,
      };
    }
    const email = ctx.getUserEmail() ?? "utilisateur SYGMA";
    const echo = message ? ` — écho : ${message}` : "";
    return {
      content: [
        {
          type: "text",
          text: `SYGMA MCP OK. Connecté en tant que ${email}.${echo}`,
        },
      ],
      structuredContent: {
        ok: true,
        userId: ctx.getUserId(),
        email: ctx.getUserEmail(),
      },
    };
  },
});
