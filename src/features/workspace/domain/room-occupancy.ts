import type { ModuleRecords } from "../models/index.ts";
type RoomRecords = Pick<ModuleRecords, "slots" | "papers" | "reservations">;
/** One date/period resource ledger for weekly classes, exam papers and facility bookings. */
export function roomOccupied(
  records: RoomRecords,
  date: string,
  periodId: string,
  room: string,
  ignore: { paperId?: string; reservationId?: string } = {},
) {
  const weekday = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][new Date(date + "T00:00:00Z").getUTCDay()];
  return (
    records.slots.some(
      (s) =>
        s.weekday === weekday && s.periodId === periodId && s.room === room,
    ) ||
    records.papers.some(
      (p) =>
        p.id !== ignore.paperId &&
        p.date === date &&
        p.periodId === periodId &&
        p.room === room,
    ) ||
    records.reservations.some(
      (r) =>
        r.id !== ignore.reservationId &&
        r.date === date &&
        r.periodId === periodId &&
        r.room === room,
    )
  );
}
