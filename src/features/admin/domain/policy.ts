import type { SupportTicket } from "../models/administration.ts";
export function assertPlatformOperator(active: boolean) {
  if (!active) throw new Error("Platform administrator required.");
}
export function assertTicketTransition(
  current: SupportTicket["status"],
  next: SupportTicket["status"],
) {
  const allowed: Record<SupportTicket["status"], SupportTicket["status"][]> = {
    open: ["open", "in-progress", "resolved"],
    "in-progress": ["in-progress", "open", "resolved"],
    resolved: ["resolved", "open", "closed"],
    closed: ["closed", "open"],
  };
  if (!allowed[current].includes(next))
    throw new Error("Invalid support status transition.");
}
export function manualEmailHref(email: string, subject: string, id: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`[${id}] ${subject}`)}`;
}
