import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspace,
  createYearSeed,
} from "../src/features/workspace/data/workspace-seed.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";
import {
  visibleOperations,
  saveOperation,
} from "../src/features/operations/domain/operations.ts";
import { projectCloudWorkspace } from "../src/features/cloud/domain/projection.ts";
import { acknowledgePortalNotice } from "../src/features/portals/domain/portal-operations.ts";
const actor = (role: string) => testAccounts.find((a) => a.role === role)!;
test("staff conversations are not exposed to another assigned teacher or impersonated through staffId", () => {
  const y = createWorkspace().years[0];
  const source = y.extensions.find((r) => r.kind === "messages")!;
  const other = {
    ...source,
    id: "another-teacher-conversation",
    staffId: "staff-2",
    createdBy: "demo-staff",
    studentId: "student-1",
  };
  y.extensions.push(other);
  assert.equal(
    visibleOperations(y, actor("teacher"), "messages").some(
      (r) => r.id === other.id,
    ),
    false,
  );
  assert.throws(() =>
    saveOperation(y, actor("teacher"), {
      ...other,
      id: "forged-message",
      createdBy: actor("teacher").id,
    }),
  );
  assert.throws(() =>
    saveOperation(y, actor("staff"), {
      ...source,
      id: "forged-staff-message",
      staffId: "staff-1",
      createdBy: actor("staff").id,
    }),
  );
});
test("revoked notice consent is enforced at read and acknowledgement time", () => {
  const root = createWorkspace();
  const y = root.years[0];
  const parent = actor("parent");
  const n = y.records.notices.find((n) => n.status === "published")!;
  n.recipientIds = [parent.personId!];
  assert.ok(
    projectCloudWorkspace(root, parent).years[0].records.notices.some(
      (v) => v.id === n.id,
    ),
  );
  y.setup.relationships = y.setup.relationships.map((l) =>
    l.guardianId === parent.personId ? { ...l, canReceiveNotices: false } : l,
  );
  assert.equal(
    projectCloudWorkspace(root, parent).years[0].records.notices.length,
    0,
  );
  assert.throws(() => acknowledgePortalNotice(y, parent, n.id));
});
test("workspace replacement cannot omit or change archived academic years", async () => {
  const { prepareWorkspaceReplacement } = await import(
    "../src/features/cloud/domain/workspace-replacement.ts"
  );
  const root = createWorkspace();
  root.years[0].locked = true;
  const setup = JSON.parse(
    JSON.stringify(root.years[0].setup).replaceAll(
      root.activeYearId,
      "academic-year-new",
    ),
  );
  setup.completed = [];
  const current = createYearSeed(setup);
  root.years.push(current);
  root.activeYearId = current.setup.calendar.year.id;
  assert.throws(
    () =>
      prepareWorkspaceReplacement(
        root,
        actor("admin"),
        { ...root, revision: root.revision + 1, years: [current] },
        root.revision,
        "Omit archive",
      ),
    /Archived/,
  );
  const candidate = structuredClone(root);
  candidate.revision++;
  candidate.years[0].records.preferences.principalBio = "Changed archive";
  assert.throws(
    () =>
      prepareWorkspaceReplacement(
        root,
        actor("admin"),
        candidate,
        root.revision,
        "Edit archive",
      ),
    /Archived/,
  );
  const next = prepareWorkspaceReplacement(
    root,
    actor("admin"),
    { ...root, revision: root.revision + 1 },
    root.revision,
    "Save current year",
  );
  assert.deepEqual(next.years[0], root.years[0]);
});

test("known synthetic identities require explicit test access even with a valid Auth session", async () => {
  const { mayUseSyntheticIdentity } = await import(
    "../src/features/identity/domain/test-access.ts"
  );
  assert.equal(mayUseSyntheticIdentity("admin@greenfield.demo", false), false);
  assert.equal(mayUseSyntheticIdentity("ADMIN@GREENFIELD.DEMO", false), false);
  assert.equal(mayUseSyntheticIdentity("parent@greenfield.demo", true), true);
  for (const role of ["admin", "teacher", "staff", "parent", "student"]) {
    assert.equal(
      mayUseSyntheticIdentity(`${role}@greenfield.test`, false),
      false,
    );
    assert.equal(
      mayUseSyntheticIdentity(`${role}@greenfield.test`.toUpperCase(), false),
      false,
    );
    assert.equal(
      mayUseSyntheticIdentity(`${role}@greenfield.test`, true),
      true,
    );
  }
  assert.equal(
    mayUseSyntheticIdentity("school.admin@example.test", false),
    true,
  );
});

test("all-school notices reach eligible students and accept acknowledgement without leaking guardian-only notices", async () => {
  const { publishNotice } = await import(
    "../src/features/workspace/domain/operations.ts"
  );
  const root = createWorkspace();
  const y = root.years[0];
  const student = actor("student");
  const notice = y.records.notices[0];
  notice.audience = "all";
  notice.status = "draft";
  notice.recipientIds = [];
  notice.acknowledgedIds = [];
  const published = publishNotice(y, notice.id);
  assert.ok(
    published.records.notices
      .find((n) => n.id === notice.id)!
      .recipientIds.includes(student.personId!),
  );
  const projected = projectCloudWorkspace(
    { ...root, years: [published] },
    student,
  );
  assert.ok(projected.years[0].records.notices.some((n) => n.id === notice.id));
  const ack = acknowledgePortalNotice(published, student, notice.id);
  assert.ok(
    ack.records.notices
      .find((n) => n.id === notice.id)!
      .acknowledgedIds.includes(student.personId!),
  );
  const restricted = structuredClone(published);
  restricted.records.notices.find((n) => n.id === notice.id)!.audience =
    "guardians";
  assert.equal(
    projectCloudWorkspace(
      { ...root, years: [restricted] },
      student,
    ).years[0].records.notices.some((n) => n.id === notice.id),
    false,
  );
  assert.throws(() => acknowledgePortalNotice(restricted, student, notice.id));
});

test("form action buttons explicitly submit despite the shared button's safe default", async () => {
  const ts = await import("typescript"),
    fs = await import("node:fs/promises"),
    path = await import("node:path");
  const failures: string[] = [];
  async function scan(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(filename);
      else if (filename.endsWith(".tsx")) {
        const source = ts.createSourceFile(
          filename,
          await fs.readFile(filename, "utf8"),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        function visit(node: import("typescript").Node, inForm = false) {
          if (ts.isJsxElement(node)) {
            const name = node.openingElement.tagName.getText(source);
            if (name === "form") inForm = true;
            if (name === "Button" && inForm) {
              const attributes = node.openingElement.attributes.properties.map(
                (attribute) => attribute.name?.getText(source),
              );
              if (
                !["type", "onClick", "asChild"].some((attribute) =>
                  attributes.includes(attribute),
                )
              )
                failures.push(
                  `${filename}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
                );
            }
          }
          ts.forEachChild(node, (child) => visit(child, inForm));
        }
        visit(source);
      }
    }
  }
  await scan("src");
  assert.deepEqual(
    failures,
    [],
    "Every form button must declare its submit or click behavior",
  );
});
