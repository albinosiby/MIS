import type {EmploymentEvent} from "../models/index.ts";
export function employedOn(
  events: EmploymentEvent[],
  staffId: string,
  date: string,
) {
  const lifecycle = events
    .filter(
      (e) => e.staffId === staffId && ["joined", "exited"].includes(e.kind),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = lifecycle.filter((e) => e.date <= date).at(-1);
  return latest
    ? latest.kind !== "exited"
    : !lifecycle.some((e) => e.kind === "joined");
}
