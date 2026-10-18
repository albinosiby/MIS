import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";
import { schoolRoles, personKindForRole } from "../src/features/identity/domain/permissions.ts";
import { canAccess } from "../src/features/identity/domain/access.ts";
import { projectCloudWorkspace } from "../src/features/cloud/domain/projection.ts";
import { applyCloudCommand } from "../src/features/cloud/domain/commands.ts";
import { canAccessDocument, canRevokeDocument } from "../src/features/documents/domain/document-access.ts";
import { validateDocumentBytes } from "../src/features/documents/domain/file-validation.ts";
import { documentUploadSchema } from "../src/features/documents/schemas/private-document.schema.ts";
import { saveOperation } from "../src/features/operations/domain/operations.ts";
const actor = (role: string) => testAccounts.find(a => a.role === role)!;
const request = (category: "academic" | "identity" | "finance" | "medical" | "counselling" = "academic") => ({ yearId: "", ownerType: "student" as const, ownerId: "student-1", category, replacesId: null });
test("all school roles have a private file route and scoped cloud projection; platform/group cannot obtain school data", () => {
  const root = createWorkspace();
  for (const role of schoolRoles) {
    assert.ok(canAccess(role, "/documents/files"), role);
    const projection = projectCloudWorkspace(root, actor(role)).years[0];
    if (["admin", "principal"].includes(role)) continue;
    assert.deepEqual(projection.setup.audit, [], role);
    assert.deepEqual(projection.setup.guardians, role === "parent" ? root.years[0].setup.guardians.filter(g => g.id === actor(role).personId) : [], role);
    if (!["hr", "staff", "teacher"].includes(role)) assert.equal(projection.records.staffProfiles.length, 0, role);
    if (!["accountant", "parent", "student"].includes(role)) assert.equal(projection.records.invoices.length, 0, role);
    for (const row of projection.extensions) {
      if (["clinic-visits", "health-records", "medication"].includes(row.kind)) assert.equal(role, "nurse");
      if (row.kind === "counselling") assert.equal(role, "counsellor");
    }
  }
  for (const role of ["platform", "group"]) { assert.throws(() => projectCloudWorkspace(root, actor(role))); assert.equal(canAccess(actor(role).role, "/documents/files"), false); }
  assert.equal(canAccess("accountant", "/reports"), false);
  assert.equal(canAccess("hr", "/staff/roles"), false);
  assert.equal(personKindForRole("nurse"), "staff");
  assert.equal(personKindForRole("parent"), "guardian");
});
test("document access follows owner, year, current custody permission and restricted category, never merely author", () => {
  const y = createWorkspace().years[0];
  const doc = { ...request(), yearId: y.setup.calendar.year.id };
  assert.ok(canAccessDocument(y, actor("parent"), doc, true));
  assert.ok(canAccessDocument(y, actor("student"), doc));
  assert.equal(canAccessDocument(y, actor("accountant"), doc), false);
  assert.ok(canAccessDocument(y, actor("accountant"), { ...doc, category: "finance" }, true));
  assert.equal(canAccessDocument(y, actor("parent"), { ...doc, category: "medical" }), false);
  assert.ok(canAccessDocument(y, actor("nurse"), { ...doc, category: "medical" }));
  assert.equal(canAccessDocument(y, actor("nurse"), { ...doc, category: "counselling" }), false);
  assert.equal(canAccessDocument(y, actor("parent"), { ...doc, ownerId: "student-999" }), false);
  assert.equal(canAccessDocument(y, { ...actor("admin"), schoolId: "another-school" }, doc), false);
  assert.equal(canAccessDocument(y, actor("admin"), { ...doc, yearId: "another-year" }), false);
  const revoked = { ...y, setup: { ...y.setup, relationships: y.setup.relationships.map(l => ({ ...l, canViewRecords: false })) } };
  assert.equal(canAccessDocument(revoked, actor("parent"), doc), false);
  assert.equal(canAccessDocument({ ...y, locked: true }, actor("admin"), doc, true), false);
  const file = { id: "d", school_id: y.setup.school.id, academic_year_id: doc.yearId, owner_type: doc.ownerType, owner_id: doc.ownerId, category: doc.category, filename: "report.pdf", mime_type: "application/pdf" as const, byte_size: 12, sha256: "0".repeat(64), object_path: "private", created_by: actor("admin").id, status: "ready" as const, version: 1, replaces_id: null, created_at: new Date().toISOString(), retain_until: new Date().toISOString() };
  assert.equal(canRevokeDocument(y, actor("student"), file), false);
  assert.equal(canRevokeDocument(y, actor("parent"), file), false);
  assert.equal(canRevokeDocument({ ...y, locked: true }, actor("admin"), file), true);
  assert.equal(canAccessDocument(y, actor("admin"), { ...doc, ownerType: "school", ownerId: actor("admin").schoolId }), false);
});
test("file signatures, empty/oversized files, unsafe names, active PDFs and mismatched declarations are rejected", () => {
  const bytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF");
  assert.equal(validateDocumentBytes("report.pdf", "application/pdf", bytes), "application/pdf");
  for (const name of ["../report.pdf", "a\\b.pdf", ".hidden.pdf", "a\n.pdf"]) assert.throws(() => validateDocumentBytes(name, "application/pdf", bytes));
  assert.throws(() => validateDocumentBytes("report.png", "image/png", bytes));
  assert.throws(() => validateDocumentBytes("report.pdf", "application/pdf", new Uint8Array()));
  assert.throws(() => validateDocumentBytes("report.pdf", "application/pdf", new Uint8Array(5_000_001)));
  assert.throws(() => validateDocumentBytes("report.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.4 /JavaScript %%EOF")));
  assert.throws(() => validateDocumentBytes("report.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.4 /#4AavaScript %%EOF")));
  assert.throws(() => documentUploadSchema.parse({ ...request(), yearId: "year-1", schoolId: "forged" }));
});
test("billing and HR server commands deny other roles, changed ownership and self approval", () => {
  const root = createWorkspace(); const y = root.years[0];
  const cmd = (command: unknown) => ({ expectedRevision: root.revision, yearId: root.activeYearId, command });
  const invoice = y.records.invoices[0];
  const p = { refundedMinor: 0, id: "receipt-test", schoolId: y.setup.school.id, academicYearId: root.activeYearId, invoiceId: invoice.id, amountMinor: 100, paidOn: y.setup.calendar.year.startDate, method: "Cash" as const, reference: "receipt-test", idempotencyKey: "receipt-key", status: "completed" as const, note: "" };
  y.records.payments.push(p);
  assert.throws(() => applyCloudCommand(root, actor("teacher"), cmd({ type: "billing-reverse", id: p.id, note: "Approved correction" })));
  const reversed = applyCloudCommand(root, actor("accountant"), cmd({ type: "billing-reverse", id: p.id, note: "Approved correction" }));
  assert.equal(reversed.years[0].records.payments.find(r => r.id === p.id)!.status, "reversed");
  assert.equal(reversed.years[0].records.invoices.length, y.records.invoices.length);
  assert.throws(() => applyCloudCommand(root, actor("hr"), cmd({ type: "hr-register", input: { schoolId: y.setup.school.id, academicYearId: root.activeYearId, personType: "student", classSectionId: y.setup.classes[0].id, periodId: null, date: y.setup.calendar.year.startDate, entries: [{ personId: "student-1", status: "present", note: "" }] } })));
  const profile = y.records.staffProfiles[0];
  assert.throws(() => applyCloudCommand(root, actor("hr"), cmd({ type: "staff-profile", input: { ...profile, staffId: "staff-2" } })));
  const projected = projectCloudWorkspace(root, actor("accountant"));
  assert.deepEqual(projected.years[0].records.marks, []);
  assert.deepEqual(projected.years[0].records.studentProfiles, []);
});
test("driver cannot create or reassign trips via collection commands", () => {
  const y = createWorkspace().years[0];
  const trip = y.extensions.find(r => r.kind === "trips")!;
  const driver = { ...actor("driver"), personId: trip.staffId };
  assert.throws(() => saveOperation(y, driver, { ...trip, id: "new-trip", status: "planned" }));
  assert.throws(() => saveOperation(y, driver, { ...trip, values: { ...trip.values, vehicleId: "other-vehicle" } }));
});

test("specialists can save their own module workflow while other specialists and foreign schools are denied", () => {
  const roots = createWorkspace();
  const cases = [["accountant", "fees"], ["hr", "hr"], ["librarian", "library"], ["nurse", "health"], ["counsellor", "wellbeing"], ["transport", "transport"], ["inventory", "inventory"], ["warden", "hostel"]];
  for (const [role, area] of cases) {
    const y = roots.years[0];
    const view = projectCloudWorkspace(roots, actor(role)).years[0];
    const sample = view.extensions.find(r => r.kind !== "messages");
    assert.ok(sample, `${area} has a permitted module projection`);
    const request = { ...sample, id: crypto.randomUUID(), createdBy: actor(role).id, history: [] };
    const saved = saveOperation(y, actor(role), request);
    assert.ok(saved.extensions.some(r => r.id === request.id), `${role} can save`);
    assert.throws(() => saveOperation(y, { ...actor(role), schoolId: "foreign-school" }, request));
    const other = role === "inventory" ? actor("nurse") : actor("inventory");
    assert.throws(() => saveOperation(y, other, request), `${other.role} cannot save ${role}'s collection`);
  }
});

test("private guardian messages are not exposed to another guardian sharing the same child", () => {
  const y = createWorkspace().years[0];
  const parent = actor("parent");
  const source = y.extensions.find(r => r.kind === "messages")!;
  const privateMessage = { ...source, id: "private-guardian-thread", studentId: "student-1", createdBy: "other-guardian-account" };
  y.extensions.push(privateMessage);
  const root = { ...createWorkspace(), years: [y] };
  assert.equal(projectCloudWorkspace(root, parent).years[0].extensions.some(r => r.id === privateMessage.id), false);
});
