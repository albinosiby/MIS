import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { carryOperationalMasters } from "../src/features/settings/domain/rollover-masters.ts";
import { carryOpeningLedger } from "../src/features/settings/domain/rollover-ledger.ts";
import { rolloverBlockers } from "../src/features/settings/domain/rollover.ts";
import { prepareWorkspaceReplacement } from "../src/features/cloud/domain/workspace-replacement.ts";
import { applyCloudCommand } from "../src/features/cloud/domain/commands.ts";
import { balance } from "../src/features/workspace/domain/operations.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";

test("rollover carries actual masters and net stock without fabricated transactions", () => {
  const source = createWorkspace().years[0];
  const old = source.extensions.filter(
    (row) => row.kind === "stock-movements" && row.status === "posted",
  );
  const carry = carryOperationalMasters(source, "ay-next", "2027-04-01");
  assert.ok(
    carry.every(
      (row) => row.academicYearId === "ay-next" && row.date === "2027-04-01",
    ),
  );
  assert.ok(
    carry.every(
      (row) =>
        row.kind !== "purchase-orders" &&
        row.kind !== "payroll" &&
        row.kind !== "quiz-attempts",
    ),
  );
  for (const item of carry.filter((row) => row.kind === "items")) {
    const net = old
      .filter((row) => row.values.itemId === item.id)
      .reduce(
        (sum, row) =>
          sum +
          (row.values.direction === "Issue" ? -1 : 1) *
            Number(row.values.quantity),
        0,
      );
    assert.equal(
      carry
        .filter(
          (row) =>
            row.kind === "stock-movements" && row.values.itemId === item.id,
        )
        .reduce((sum, row) => sum + Number(row.values.quantity), 0),
      net,
    );
  }
  assert.equal(
    carryOperationalMasters(
      { ...source, extensions: [] },
      "ay-next",
      "2027-04-01",
    ).length,
    0,
  );
});
test("year opening journals carry net receivables and liabilities and reject unreconciled balances", () => {
  const source = createWorkspace().years[0];
  const entries = carryOpeningLedger(source, "2027-04-01"),
    receivable = entries
      .flatMap((e) => e.lines)
      .filter((l) => l.account === "Fee receivable")
      .reduce((sum, l) => sum + l.debitMinor - l.creditMinor, 0);
  assert.equal(
    receivable,
    source.records.invoices.reduce((sum, i) => sum + balance(source, i.id), 0),
  );
  assert.ok(
    entries.every(
      (e) =>
        e.lines.reduce((sum, l) => sum + l.debitMinor - l.creditMinor, 0) === 0,
    ),
  );
  source.workflows.counters["ledger-initialised"] = 1;
  assert.throws(() => carryOpeningLedger(source, "2027-04-01"), /Reconcile/);
});
test("rollover blocks live loans and void invoices never create dues", () => {
  const root = createWorkspace(),
    year = root.years[0];
  assert.ok(rolloverBlockers(root).some((issue) => issue.includes("library")));
  const invoice = year.records.invoices[0];
  invoice.status = "void";
  assert.equal(balance(year, invoice.id), 0);
});

test("whole-workspace replacement cannot create years or archive active records", () => {
  const root = createWorkspace(),
    admin = testAccounts.find((a) => a.role === "admin")!;
  const candidate = structuredClone(root);
  candidate.revision++;
  candidate.years[0].locked = true;
  assert.throws(
    () =>
      prepareWorkspaceReplacement(
        root,
        admin,
        candidate,
        root.revision,
        "Archive bypass",
      ),
    /rollover action/,
  );
  assert.throws(
    () =>
      applyCloudCommand(root, testAccounts.find((a) => a.role === "teacher")!, {
        expectedRevision: root.revision,
        yearId: root.activeYearId,
        command: {
          type: "year-rollover",
          input: {
            name: "2027-28",
            startDate: "2027-04-01",
            endDate: "2028-03-31",
            acknowledged: true,
          },
        },
      }),
    /administrator/,
  );
});

test("general saves preserve withheld publication history but reject altered snapshots", () => {
  const root = createWorkspace(),
    admin = testAccounts.find((a) => a.role === "admin")!,
    year = root.years[0];
  year.workflows.publications.push({
    id: "retained-publication",
    kind: "report",
    sourceId: "retained-source",
    ownerType: "school",
    ownerId: admin.schoolId,
    version: 1,
    reference: "RETAINED-1",
    title: "Retained report",
    issuedBy: admin.id,
    issuedAt: new Date().toISOString(),
    revokedAt: null,
    revocationReason: "",
    snapshot: { value: "immutable" },
  });
  const candidate = structuredClone(root);
  candidate.revision++;
  candidate.years[0].workflows.publications = [];
  assert.equal(
    prepareWorkspaceReplacement(
      root,
      admin,
      candidate,
      root.revision,
      "Change ordinary setting",
    ).years[0].workflows.publications.length,
    1,
  );
  const forged = structuredClone(root);
  forged.revision++;
  forged.years[0].workflows.publications[0].snapshot.value = "forged";
  assert.throws(
    () =>
      prepareWorkspaceReplacement(
        root,
        admin,
        forged,
        root.revision,
        "Alter snapshot",
      ),
    /publication actions/,
  );
});
