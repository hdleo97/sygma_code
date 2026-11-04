export const DEFAULT_INACTIVITY_MINUTES = 30;
export function inactivityMinutes(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 5 && value <= 480
    ? value : DEFAULT_INACTIVITY_MINUTES;
}
export function inactivityExpired(lastActivity: number, now: number, minutes: number) {
  return now - lastActivity >= inactivityMinutes(minutes) * 60_000;
}