/** Prepare idempotent synthetic-only seed SQL. Does not upload any browser data or identities. */
import { writeFileSync } from "node:fs";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
const root = workspaceSchema.parse(createWorkspace());
const q = (v: unknown) => "'" + String(v).replaceAll("'", "''") + "'";
const school = root.years[0].setup.school;
const sql = [
  "begin;",
  `insert into public.mis_schools(id,name) values(${q(school.id)},${q(school.name)}) on conflict do nothing;`,
];
for (const y of root.years) {
  const ay = y.setup.calendar.year;
  sql.push(
    `insert into public.mis_academic_years(school_id,id,name,starts_on,ends_on,locked) values(${q(school.id)},${q(ay.id)},${q(ay.name)},${q(ay.startDate)},${q(ay.endDate)},false) on conflict do nothing;`,
  );
  for (const [collection, kind] of [
    [y.setup.students, "student"],
    [y.setup.staff, "staff"],
    [y.setup.guardians, "guardian"],
  ] as const)
    for (const p of collection)
      sql.push(
        `insert into public.mis_people values(${q(school.id)},${q(p.id)},${q(kind)},${q(p.displayName)}) on conflict do nothing;`,
      );
}
sql.push(
  `insert into mis_private.workspace_documents(school_id,revision,document) values(${q(school.id)},${root.revision},${q(JSON.stringify(root))}::jsonb) on conflict do nothing;`,
  "commit;",
);
const file = process.argv[2] ?? "/tmp/mis-cloud-seed.sql";
writeFileSync(file, sql.join("\n"), { mode: 0o600 });
console.log(
  JSON.stringify({
    file,
    schoolId: school.id,
    students: root.years[0].setup.students.length,
    note: "Synthetic seed only; existing rows/documents are not overwritten.",
  }),
);
