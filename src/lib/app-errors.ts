/** Only allow intentional user messages through; never expose provider payloads. */
export function errorMessage(error: unknown): string {
  const item = error && typeof error === "object" ? error as { code?: string; message?: string; status?: number } : {};
  const message = item.message ?? "";
  if ([
    "Vous n’avez pas les droits nécessaires dans cet établissement.",
    "Cet élément existe déjà. Vérifiez la référence ou le code saisi.",
    "Un élément lié est absent ou encore utilisé. Actualisez la page.",
    "Vérifiez les champs obligatoires et les valeurs saisies.",
    "Votre session a expiré. Reconnectez-vous pour continuer.",
    "Connexion interrompue. Vérifiez votre connexion puis réessayez.",
    "Adresse e-mail ou mot de passe incorrect.",
    "Trop de tentatives. Patientez avant de réessayer.",
  ].includes(message)) return message;
  if (item.code === "42501" || /row.level security|permission denied|forbidden/i.test(message))
    return "Vous n’avez pas les droits nécessaires dans cet établissement.";
  if (item.code === "23505") return "Cet élément existe déjà. Vérifiez la référence ou le code saisi.";
  if (item.code === "23503") return "Un élément lié est absent ou encore utilisé. Actualisez la page.";
  if (item.code === "23502" || item.code === "23514") return "Vérifiez les champs obligatoires et les valeurs saisies.";
  if (item.status === 401 || /jwt|token.*expired|not authenticated|unauthorized/i.test(message))
    return "Votre session a expiré. Reconnectez-vous pour continuer.";
  if (/fetch|network|offline|failed to load|timeout/i.test(message))
    return "Connexion interrompue. Vérifiez votre connexion puis réessayez.";
  if (/invalid login credentials/i.test(message)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/rate limit|too many requests/i.test(message)) return "Trop de tentatives. Patientez avant de réessayer.";
  // Application-authored French validations, never SQL details or personal values.
  if (/^(Ce |Cette |Vous |Le rapport |Les cinq |Chaque phase |Transition |Impossible |Accès |Aucun |Une signature |Les signatures |Quantité |Stock |La demande |Le magasin |L’établissement )/.test(message)
    && !/[{}<>@]|https?:|\b(SELECT|INSERT|UPDATE|DELETE|DETAIL|CONTEXT)\b/i.test(message)) return message;
  return "L’action n’a pas abouti. Vérifiez les informations puis réessayez.";
}

/** Logging is deliberately payload-free: messages/stacks may contain credentials or user input. */
export function safeErrorSummary(_error: unknown): string {
  return "SYGMA: operation failed (details withheld)";
}