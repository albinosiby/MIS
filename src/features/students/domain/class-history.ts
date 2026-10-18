import type {StudentEvent} from "../models/index.ts";
export function classAtDate(
  currentClassId: string,
  events: StudentEvent[],
  studentId: string,
  date: string,
) {
  const changes = events
    .filter(
      (e) =>
        e.studentId === studentId &&
        e.kind === "class-changed" &&
        e.fromClassId &&
        e.toClassId,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = changes.filter((e) => e.date <= date).at(-1);
  return latest?.toClassId ?? changes[0]?.fromClassId ?? currentClassId;
}

/** Context for retained records; current mutation permissions are checked separately. */
export function hasClassMembership(currentClassId:string,events:StudentEvent[],studentId:string,classId:string){return currentClassId===classId||events.some(e=>e.studentId===studentId&&e.kind==="class-changed"&&(e.fromClassId===classId||e.toClassId===classId));}
