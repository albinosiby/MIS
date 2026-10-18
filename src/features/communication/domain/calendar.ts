import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { academicEventSchema } from "../schemas/communication.schema.ts";
import { putRecord, scope } from "../../workspace/domain/operations.ts";
function iso(value: string) {
  const raw = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!raw) throw new Error("Calendar dates must use YYYYMMDD.");
  return `${raw[1]}-${raw[2]}-${raw[3]}`;
}
export function importCalendar(y: SchoolYearWorkspace, text: string) {
  if (text.length > 1_000_000)
    throw new Error("Calendar file must be smaller than 1 MB.");
  if (!text.includes("BEGIN:VCALENDAR"))
    throw new Error("Choose a valid iCalendar (.ics) file.");
  if (text.includes("RRULE:"))
    throw new Error(
      "Expand recurring events before importing this calendar.",
    );
  const blocks =
    text.replace(/\r?\n[ \t]/g, "").match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ??
    [];
  if (!blocks.length || blocks.length > 250)
    throw new Error("Import between 1 and 250 calendar events.");
  let next = structuredClone(y);
  for (const block of blocks) {
    const get = (key: string) =>
      block.match(new RegExp("^" + key + "(?:;[^:]*)?:(.*)$", "m"))?.[1].trim();
    const start = get("DTSTART"),
      end = get("DTEND");
    if (!start) throw new Error("Every event must have a start date.");
    const startDate = iso(start);
    let endDate = end ? iso(end) : startDate;
    if (start.length === 8 && end?.length === 8) {
      const d = new Date(endDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      endDate = d.toISOString().slice(0, 10);
    }
    const uid = get("UID") ?? null;
    if (uid && next.records.events.some((e) => e.sourceUid === uid)) continue;
    const unescape = (v: string) =>
      v.replace(/\\[nN]/g, "\n").replace(/\\([,;\\])/g, "$1");
    const event = academicEventSchema.parse({
      ...scope(y),
      id: crypto.randomUUID(),
      title: unescape(get("SUMMARY") ?? "Imported event"),
      category: "Academic",
      dates: { startDate, endDate },
      description: unescape(get("DESCRIPTION") ?? ""),
      classSectionIds: [],
      venue: unescape(get("LOCATION") ?? ""),
      startTime:
        start
          .match(/T(\d{2})(\d{2})/)
          ?.slice(1)
          .join(":") ?? null,
      endTime:
        end
          ?.match(/T(\d{2})(\d{2})/)
          ?.slice(1)
          .join(":") ?? null,
      sourceUid: uid,
      status: "published",
    });
    next = putRecord(next, "events", event);
  }
  return next;
}
export function calendarIcs(y: SchoolYearWorkspace) {
  const escape = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const blocks = y.records.events
    .filter((e) => e.status === "published")
    .map((e) => {
      const end = new Date(e.dates.endDate + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() + 1);
      return [
        "BEGIN:VEVENT",
        `UID:${e.sourceUid ?? e.id + "@school-calendar"}`,
        e.startTime
          ? `DTSTART:${e.dates.startDate.replaceAll("-", "")}T${e.startTime.replace(":", "")}00`
          : `DTSTART;VALUE=DATE:${e.dates.startDate.replaceAll("-", "")}`,
        e.endTime
          ? `DTEND:${e.dates.endDate.replaceAll("-", "")}T${e.endTime.replace(":", "")}00`
          : `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll("-", "")}`,
        `SUMMARY:${escape(e.title)}`,
        `DESCRIPTION:${escape(e.description)}`,
        `LOCATION:${escape(e.venue)}`,
        "END:VEVENT",
      ].join("\r\n");
    });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//School MIS//EN",
    ...blocks,
    "END:VCALENDAR",
  ].join("\r\n");
}
