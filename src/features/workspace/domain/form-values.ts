import type { AcademicYear } from "../../../shared/models/index.ts";
/** Keep fixed reference defaults valid for a custom academic-year range. */
export function academicReferenceDate(
  year: Pick<AcademicYear, "startDate" | "endDate">,
  monthDay = "10-14",
) {
  for (const prefix of [
    ...new Set([year.startDate.slice(0, 4), year.endDate.slice(0, 4)]),
  ]) {
    const candidate = `${prefix}-${monthDay}`;
    if (candidate >= year.startDate && candidate <= year.endDate)
      return candidate;
  }
  return year.startDate;
}
export function academicWeekdayDate(
  year: Pick<AcademicYear, "startDate" | "endDate">,
  weekday: string,
) {
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const initial = academicReferenceDate(year, "10-12"),
    date = new Date(initial + "T00:00:00Z");
  date.setUTCDate(
    date.getUTCDate() + ((names.indexOf(weekday) - date.getUTCDay() + 7) % 7),
  );
  if (date.toISOString().slice(0, 10) > year.endDate)
    date.setUTCDate(date.getUTCDate() - 7);
  const result = date.toISOString().slice(0, 10);
  return result >= year.startDate ? result : year.startDate;
}
/** Correct binary rounding noise, while leaving genuinely fractional minor units invalid. */
export function numberFromForm(raw: string, factor = 1) {
  if (raw === "") return NaN;
  const value = Number(raw) * factor,
    nearest = Math.round(value);
  return factor !== 1 && Math.abs(value - nearest) < 1e-6 ? nearest : value;
}
