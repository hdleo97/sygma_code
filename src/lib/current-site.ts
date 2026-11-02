/** A UI filter only. Database policies remain the authorization boundary. */
export function currentSiteId(): string {
  return typeof window === "undefined" ? "00000000-0000-0000-0000-000000000000"
    : window.localStorage.getItem("sygma.current_etablissement") ?? "00000000-0000-0000-0000-000000000000";
}