export type SiteAssignment = { etablissement_id: string; role: string };

export function rolesForSite(assignments: SiteAssignment[], siteId: string | null): string[] {
  return [...new Set(assignments.filter((row) => row.etablissement_id === siteId).map((row) => row.role))];
}

export function assertSiteAssignments(assignments: SiteAssignment[], allowed: Map<string, boolean>) {
  if (!assignments.length) throw new Error("Choisissez un établissement et au moins un rôle");
  for (const row of assignments) {
    if (!allowed.has(row.etablissement_id)) throw new Error("Accès refusé à cet établissement");
    if (row.role === "super_admin" && !allowed.get(row.etablissement_id)) {
      throw new Error("Seul un super admin de cet établissement peut attribuer ce rôle");
    }
  }
}

export function assertWholeAccountScope(targetSites: string[], allowed: Map<string, boolean>) {
  if (!targetSites.length || targetSites.some((id) => !allowed.has(id))) {
    throw new Error("Ce compte est également rattaché à un établissement que vous ne gérez pas");
  }
}