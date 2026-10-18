import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { isInstructionDay } from "./eligibility.ts";
export function leaveWorkingDates(
  y: SchoolYearWorkspace,
  start: string,
  end: string,
) {
  const result: string[] = [];
  for (
    let date = new Date(start + "T00:00:00Z");
    date.toISOString().slice(0, 10) <= end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const day = date.toISOString().slice(0, 10);
    if (isInstructionDay(y, day, "")) result.push(day);
    if (result.length > 366) throw new Error("Leave range is too long.");
  }
  return result;
}
export function staffLeaveEntitlement(
  y: SchoolYearWorkspace,
  staffId: string,
  type: string,
) {
  const policy = y.workflows.payrollPolicy.leaveTypes.find(
    (t) => t.name === type,
  );
  if (!policy) throw new Error("Choose a configured staff leave type.");
  const used = new Set(
    y.records.leaves
      .filter(
        (l) =>
          l.personType === "staff" &&
          l.personId === staffId &&
          l.status === "approved" &&
          (l.leaveType ?? "Casual leave") === type,
      )
      .flatMap((l) => leaveWorkingDates(y, l.dates.startDate, l.dates.endDate)),
  ).size;
  return {
    ...policy,
    usedDays: used,
    remainingDays: Math.max(0, policy.annualDays - used),
  };
}
