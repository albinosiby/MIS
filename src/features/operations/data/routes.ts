import { moduleDefinitions } from "./module-definitions.ts";
export const areaTitles: Record<string, string> = {
  fees: "Finance & billing",
  exams: "Examinations",
  communication: "Communication",
  hr: "Human resources",
  transport: "Transport operations",
  library: "Library",
  inventory: "Inventory & procurement",
  hostel: "Hostel & boarding",
  wellbeing: "Behaviour & wellbeing",
  health: "Health & clinic",
  activities: "Activities & achievements",
  documents: "Documents & certificates",
  learning: "Learning resources",
  "front-office": "Front office",
  reports: "Reports & analytics",
  settings: "Administration",
  website: "Website & CMS",
  platform: "Platform administration",
  group: "School group",
  alumni: "Alumni",
};
export const portalSections: Record<string, string[]> = {
  teacher: [
    "overview",
    "classes",
    "attendance",
    "timetable",
    "homework",
    "submissions",
    "lessons",
    "marks",
    "resources",
    "learning-progress",
    "messages",
    "leave",
    "profile",
  ],
  parent: [
    "overview",
    "attendance",
    "timetable",
    "homework",
    "learning",
    "results",
    "fees",
    "messages",
    "notices",
    "leave",
    "transport",
    "events",
    "ptm",
    "consents",
    "documents",
    "profile",
  ],
  student: [
    "overview",
    "attendance",
    "timetable",
    "homework",
    "results",
    "fees",
    "notices",
    "library",
    "activities",
    "requests",
    "learning",
    "profile",
  ],
  "staff-portal": [
    "overview",
    "attendance",
    "leave",
    "documents",
    "payroll",
    "expenses",
    "training",
    "messages",
    "profile",
  ],
  driver: ["overview", "trips", "boarding", "vehicles", "alerts", "profile"],
};
export function operationRoute(path: string) {
  const [area, kind, ...extra] = path.split("/").filter(Boolean);
  if (extra.length) return null;
  if (portalSections[area]) {
    const section = kind ?? "overview";
    return portalSections[area].includes(section)
      ? { area, kind: null, section }
      : null;
  }
  if (
    areaTitles[area] &&
    (!kind || moduleDefinitions.some((x) => x.area === area && x.kind === kind))
  )
    return { area, kind: kind ?? null, section: null };
  return null;
}
export const operationRoutes = [
  ...Object.keys(areaTitles).map((a) => `/${a}`),
  ...moduleDefinitions.map((d) => `/${d.area}/${d.kind}`),
  ...Object.entries(portalSections).flatMap(([area, sections]) => [
    `/${area}`,
    ...sections.filter((s) => s !== "overview").map((s) => `/${area}/${s}`),
  ]),
];
