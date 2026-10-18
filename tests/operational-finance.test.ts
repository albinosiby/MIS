import { projectCloudWorkspace } from "../src/features/cloud/domain/projection.ts";
import { jsonEqual } from "../src/shared/domain/json-equality.ts";
import { takePayment } from "../src/features/workspace/domain/operations.ts";
import { applyCloudCommand } from "../src/features/cloud/domain/commands.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";
import type { OperationRecord } from "../src/features/operations/models/index.ts";
import {
  canEditOperation,
  saveOperation,
  renewLoan,
  visibleOperations,
  respondOperation,
} from "../src/features/operations/domain/operations.ts";
import { applyOperationalEffects } from "../src/features/operations/domain/connected-effects.ts";
import { guardCirculation } from "../src/features/library/domain/circulation.ts";
import { guardResidence } from "../src/features/hostel/domain/residence.ts";
import { guardDispatch } from "../src/features/transport/domain/dispatch.ts";
import {
  guardStock,
  stockBalance,
} from "../src/features/inventory/domain/stock.ts";
import {
  bankCsvImport,
  bankMinor,
} from "../src/features/fees/domain/bank-import.ts";
import {
  importBankStatement,
  matchBankLine,
  closeBankStatement,
  issueServiceCharge,
  unmatchBankLine,
  voidBankStatement,
} from "../src/features/fees/domain/bank-reconciliation.ts";
import { postJournal } from "../src/features/fees/domain/ledger.ts";
import { assertYearIntegrity } from "../src/features/workspace/domain/record-integrity.ts";
import { projectWorkflowState } from "../src/features/workspace/domain/workflow-projection.ts";
import { schoolYearWorkspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import { scope } from "../src/features/workspace/domain/operations.ts";
const admin = testAccounts.find((a) => a.role === "admin")!,
  parent = testAccounts.find((a) => a.role === "parent")!,
  reviewer = {
    ...admin,
    id: "independent-finance-reviewer",
    role: "accountant" as const,
  };
function fixture() {
  const y = createWorkspace().years[0];
  y.extensions = [];
  return y;
}
type Year = ReturnType<typeof fixture>;
function row(
  y: Year,
  kind: string,
  values: OperationRecord["values"],
  status: string,
  studentId: string | null = null,
): OperationRecord {
  return {
    ...scope(y),
    id: crypto.randomUUID(),
    kind,
    values,
    status,
    studentId,
    staffId: null,
    date: y.setup.calendar.year.startDate,
    title: `Verification ${kind}`,
    createdBy: admin.id,
    history: [],
  };
}
function library(y: Year) {
  const book = row(
      y,
      "books",
      { isbn: "LIB-QA", author: "Author", category: "School" },
      "active",
    ),
    copy = row(
      y,
      "copies",
      { bookId: book.id, barcode: "COPY-QA", shelf: "A1" },
      "available",
    );
  y.extensions.push(book, copy);
  return { book, copy };
}
function transport(y: Year) {
  const date = y.setup.calendar.year.startDate,
    route = y.records.routes[0],
    student = y.setup.students[0],
    staff = y.setup.staff[0];
  const vehicle = row(
      y,
      "vehicles",
      {
        registration: "QA-TRANSPORT",
        capacity: 1,
        insuranceUntil: y.setup.calendar.year.endDate,
      },
      "active",
    ),
    stop = row(
      y,
      "stops",
      {
        routeId: route.id,
        location: "School stop",
        sequence: 1,
        pickupTime: "08:00",
      },
      "active",
    ),
    driver = {
      ...row(
        y,
        "drivers",
        {
          vehicleId: vehicle.id,
          licence: "QA-LICENCE",
          validUntil: y.setup.calendar.year.endDate,
        },
        "active",
      ),
      staffId: staff.id,
    },
    allocation = row(
      y,
      "transport-allocations",
      {
        routeId: route.id,
        stopId: stop.id,
        startDate: date,
        endDate: y.setup.calendar.year.endDate,
      },
      "active",
      student.id,
    ),
    trip = {
      ...row(
        y,
        "trips",
        { routeId: route.id, vehicleId: vehicle.id, direction: "Pickup" },
        "planned",
      ),
      staffId: staff.id,
    };
  y.extensions.push(vehicle, stop, driver, allocation, trip);
  return { vehicle, stop, driver, allocation, trip, student, staff };
}
test("circulation enforces queue priority, ownership, duplicate reservations and collection after issue", () => {
  let y = fixture();
  const { book, copy } = library(y),
    [a, b] = y.setup.students;
  const reservation = row(
    y,
    "reservations",
    { bookId: book.id },
    "requested",
    a.id,
  );
  y = saveOperation(y, admin, reservation);
  assert.throws(
    () => saveOperation(y, admin, { ...reservation, id: crypto.randomUUID() }),
    /already/,
  );
  const loan = row(
    y,
    "loans",
    { copyId: copy.id, dueDate: y.setup.calendar.year.endDate },
    "issued",
    b.id,
  );
  assert.throws(() => saveOperation(y, admin, loan), /priority/);
  y = saveOperation(y, admin, { ...reservation, status: "ready" });
  assert.throws(
    () => saveOperation(y, admin, { ...reservation, status: "collected" }),
    /Issue/,
  );
  y = saveOperation(y, admin, { ...loan, studentId: a.id });
  y = saveOperation(y, admin, { ...reservation, status: "collected" });
  assert.throws(
    () =>
      saveOperation(y, admin, {
        ...loan,
        id: crypto.randomUUID(),
        studentId: a.id,
      }),
    /already on loan/,
  );
  assert.throws(
    () => saveOperation(y, admin, { ...copy, status: "lost" }),
    /Return/,
  );
  assert.throws(
    () =>
      saveOperation(y, admin, {
        ...loan,
        studentId: a.id,
        status: "cancelled",
      }),
    /physical return/,
  );
  y = saveOperation(y, admin, { ...loan, studentId: a.id, status: "returned" });
  schoolYearWorkspaceSchema.parse(y);
  const fine = row(
    y,
    "library-fines",
    { loanId: loan.id, amountMinor: 500, reason: "Damage assessment" },
    "outstanding",
    b.id,
  );
  assert.throws(() => saveOperation(y, admin, fine), /student's loan/);
});
test("loan renewal cannot jump a reservation queue or leave the academic year", () => {
  let y = fixture();
  const { book, copy } = library(y),
    [a, b] = y.setup.students,
    loan = row(
      y,
      "loans",
      { copyId: copy.id, dueDate: y.setup.calendar.year.startDate },
      "issued",
      a.id,
    );
  y = saveOperation(y, admin, loan);
  y.extensions.push(
    row(y, "reservations", { bookId: book.id }, "requested", b.id),
  );
  assert.throws(
    () => renewLoan(y, admin, loan.id, y.setup.calendar.year.endDate),
    /queue/,
  );
  y.extensions.pop();
  assert.throws(() => renewLoan(y, admin, loan.id, "2099-01-01"), /academic/);
  assert.equal(
    renewLoan(y, admin, loan.id, y.setup.calendar.year.endDate).extensions.at(
      -1,
    )!.values.dueDate,
    y.setup.calendar.year.endDate,
  );
});
test("residence prevents simultaneous beds and keeps roll call, outpass and checkout connected", () => {
  const y = fixture(),
    [student] = y.setup.students,
    bed = row(y, "beds", { building: "A", room: "101", bed: "1" }, "available"),
    allocation = row(
      y,
      "hostel-allocations",
      {
        bedId: bed.id,
        startDate: y.setup.calendar.year.startDate,
        endDate: y.setup.calendar.year.endDate,
      },
      "active",
      student.id,
    );
  y.extensions.push(bed, allocation);
  assert.throws(
    () =>
      guardResidence(y, {
        ...allocation,
        id: crypto.randomUUID(),
        values: { ...allocation.values, bedId: "second-bed" },
      }),
    /overlapping/,
  );
  const pass = row(
    y,
    "outpasses",
    {
      startDate: y.setup.calendar.year.startDate,
      endDate: y.setup.calendar.year.endDate,
      destination: "Guardian home",
      guardianApproval: "Granted",
    },
    "out",
    student.id,
  );
  y.extensions.push(pass);
  assert.throws(
    () => guardResidence(y, { ...allocation, status: "ended" }, allocation),
    /outstanding/,
  );
  assert.throws(
    () =>
      guardResidence(
        y,
        row(
          y,
          "roll-call",
          { status: "Present", note: "Daily register" },
          "recorded",
          student.id,
        ),
      ),
    /agree/,
  );
  guardResidence(
    y,
    row(
      y,
      "roll-call",
      { status: "On approved outpass", note: "Guardian collection" },
      "recorded",
      student.id,
    ),
  );
  assert.throws(
    () => guardResidence(y, { ...pass, status: "cancelled" }, pass),
    /return/,
  );
  y.extensions = y.extensions.map((r) =>
    r.id === pass.id ? { ...r, status: "returned" } : r,
  );
  guardResidence(y, { ...allocation, status: "ended" }, allocation);
});
test("transport dispatch validates capacity and licence; generates roster and requires safe alighting", () => {
  let y = fixture();
  const f = transport(y),
    start = { ...f.trip, status: "started" };
  guardDispatch(y, start, f.trip);
  f.driver.values.validUntil = "2020-01-01";
  assert.throws(() => guardDispatch(y, start, f.trip), /licence/);
  f.driver.values.validUntil = y.setup.calendar.year.endDate;
  y.extensions.push({
    ...f.allocation,
    id: crypto.randomUUID(),
    studentId: y.setup.students[1].id,
  });
  assert.throws(() => guardDispatch(y, start, f.trip), /capacity/);
  y.extensions.pop();
  const next = saveOperation(y, admin, start);
  y = applyOperationalEffects(y, next, admin);
  const passenger = y.extensions.find((r) => r.kind === "boarding")!;
  assert.equal(passenger.status, "waiting");
  assert.throws(
    () => saveOperation(y, admin, { ...start, status: "completed" }),
    /waiting/,
  );
  y = saveOperation(y, admin, { ...passenger, status: "boarded" });
  assert.throws(
    () => saveOperation(y, admin, { ...passenger, status: "cancelled" }),
    /alighting/,
  );
  y = saveOperation(y, admin, { ...passenger, status: "alighted" });
  y = saveOperation(y, admin, { ...start, status: "completed" });
  schoolYearWorkspaceSchema.parse(y);
});
test("boarding rejects a wrong stop and driver projection includes assigned route relations", () => {
  const y = fixture(),
    f = transport(y),
    passenger = row(
      y,
      "boarding",
      { tripId: f.trip.id, stopId: "foreign-stop" },
      "waiting",
      f.student.id,
    );
  assert.throws(() => guardDispatch(y, passenger), /allocation/);
  y.records.studentProfiles = y.records.studentProfiles.filter(
    (p) => p.studentId !== f.student.id,
  );
  const driver = {
    ...admin,
    id: "driver-account",
    role: "driver" as const,
    personId: f.staff.id,
  };
  const root = createWorkspace();
  root.years[0] = y;
  assert.ok(
    projectCloudWorkspace(root, driver).years[0].records.routes.some(
      (r) => r.id === f.trip.values.routeId,
    ),
  );
  assert.equal(visibleOperations(y, driver, "stops").length, 1);
  assert.equal(visibleOperations(y, driver, "transport-allocations").length, 1);
  assert.throws(() => saveOperation(y, driver, f.vehicle), /cannot change/);
});
test("procurement receipt creates stock and balanced journal once; departmental returns are bounded", () => {
  let y = fixture();
  const vendor = row(
      y,
      "vendors",
      { contact: "Stores", email: "stores@example.test", address: "School" },
      "active",
    ),
    item = row(
      y,
      "items",
      { sku: "QA-STOCK", unit: "Each", reorderLevel: 2 },
      "active",
    ),
    po = row(
      y,
      "purchase-orders",
      {
        vendorId: vendor.id,
        itemId: item.id,
        quantity: 10,
        amountMinor: 10000,
      },
      "approved",
    );
  y.extensions.push(vendor, item, po);
  const next = saveOperation(y, admin, { ...po, status: "received" });
  y = applyOperationalEffects(y, next, admin);
  assert.equal(stockBalance(y.extensions, item.id), 10);
  assert.equal(y.workflows.ledger.at(-1)?.lines[0].debitMinor, 10000);
  assert.equal(
    applyOperationalEffects(next, y, admin).extensions.length,
    y.extensions.length,
  );
  const issue = row(
    y,
    "stock-movements",
    {
      itemId: item.id,
      direction: "Issue",
      quantity: 11,
      department: "Science",
    },
    "posted",
  );
  assert.throws(() => guardStock(y, issue), /available/);
  issue.values.quantity = 4;
  y.extensions.push(issue);
  assert.throws(
    () =>
      guardStock(
        y,
        row(
          y,
          "stock-movements",
          {
            itemId: item.id,
            direction: "Return",
            quantity: 5,
            department: "Science",
          },
          "posted",
        ),
      ),
    /outstanding/,
  );
  const returned = row(
    y,
    "stock-movements",
    {
      itemId: item.id,
      direction: "Return",
      quantity: 4,
      department: "Science",
    },
    "posted",
  );
  guardStock(y, returned);
  y.extensions.push(returned);
  assert.equal(stockBalance(y.extensions, item.id), 10);
  assert.throws(
    () =>
      saveOperation(y, admin, {
        ...issue,
        values: { ...issue.values, quantity: 1 },
      }),
    /Finalised/,
  );
});
function bankFixture() {
  let y = fixture();
  const date = y.setup.calendar.year.startDate;
  y = postJournal(y, admin, {
    sourceKey: "qa-bank-entry",
    date,
    memo: "Verified bank collection",
    reversesId: null,
    lines: [
      { account: "Bank", debitMinor: 150000, creditMinor: 0 },
      { account: "Fee receivable", debitMinor: 0, creditMinor: 150000 },
    ],
  });
  const input = {
    account: "QA school bank",
    from: date,
    to: date,
    openingMinor: 0,
    closingMinor: 150000,
    lines: [{ date, reference: "BANK-QA", amountMinor: 150000 }],
  };
  return { y, input, journalId: y.workflows.ledger.at(-1)!.id };
}
test("bank statement import validates signed decimals, complete CSV and arithmetic without creating money", () => {
  const { y, input } = bankFixture();
  assert.equal(bankMinor("-100.01"), -10001);
  assert.throws(() => bankMinor("1.001"));
  assert.throws(() => bankMinor("1e3"));
  const parsed = bankCsvImport({
    account: input.account,
    from: input.from,
    to: input.to,
    opening: "0",
    closing: "1500.00",
    csv: `date,reference,amount\n${input.from},BANK-QA,1500.00`,
  });
  assert.deepEqual(parsed, input);
  assert.throws(
    () =>
      bankCsvImport({
        account: input.account,
        from: input.from,
        to: input.to,
        opening: "0",
        closing: "15",
        csv: `date,reference,amount\n${input.from},BANK-QA,15,extra`,
      }),
    /three/,
  );
  assert.throws(
    () => importBankStatement(y, admin, { ...input, closingMinor: 1 }),
    /balance/,
  );
  const next = importBankStatement(y, admin, input);
  assert.deepEqual(next.records, y.records);
  assert.deepEqual(next.workflows.ledger, y.workflows.ledger);
  assert.throws(
    () => importBankStatement(next, admin, input),
    /already covers/,
  );
  assert.throws(() => importBankStatement(y, parent, input), /permission/);
});
test("bank reconciliation enforces exact matching, independent closure, privacy and immutable snapshots", () => {
  const f = bankFixture();
  let y = importBankStatement(f.y, admin, f.input);
  const s = y.workflows.bankStatements[0],
    line = s.lines[0],
    request = { statementId: s.id, lineId: line.id, journalId: f.journalId };
  assert.throws(
    () => closeBankStatement(y, reviewer, { statementId: s.id }),
    /every/,
  );
  assert.throws(
    () => matchBankLine(y, admin, { ...request, journalId: "foreign" }),
    /journal/,
  );
  y = matchBankLine(y, admin, request);
  assert.throws(() => matchBankLine(y, admin, request), /already/);
  assert.throws(
    () => closeBankStatement(y, admin, { statementId: s.id }),
    /separate/,
  );
  const closed = closeBankStatement(y, reviewer, { statementId: s.id });
  schoolYearWorkspaceSchema.parse(closed);
  assertYearIntegrity(y, closed);
  assert.equal(projectWorkflowState(closed, parent).bankStatements.length, 0);
  assert.equal(projectWorkflowState(closed, reviewer).bankStatements.length, 1);
  const corrupt = structuredClone(closed);
  corrupt.workflows.bankStatements[0].lines[0].amountMinor = 1;
  assert.throws(() => assertYearIntegrity(closed, corrupt), /history/);
  assert.throws(
    () => closeBankStatement(closed, reviewer, { statementId: s.id }),
    /open statement/,
  );
});
test("service invoices require active allocation, correct month, finance authority and prevent duplicate charges", () => {
  const y = fixture(),
    f = transport(y),
    input = {
      allocationId: f.allocation.id,
      month: y.setup.calendar.year.startDate.slice(0, 7),
      amountMinor: 200000,
      issuedOn: y.setup.calendar.year.startDate,
      dueDate: y.setup.calendar.year.startDate,
    };
  const next = issueServiceCharge(y, admin, input);
  assert.equal(next.records.invoices.at(-1)?.studentId, f.student.id);
  assert.throws(() => issueServiceCharge(next, admin, input), /already/);
  assert.throws(() => issueServiceCharge(y, parent, input), /permission/);
  assert.throws(
    () => issueServiceCharge(y, admin, { ...input, month: "2099-01" }),
    /overlap/,
  );
  assert.throws(
    () => issueServiceCharge(y, admin, { ...input, allocationId: "foreign" }),
    /allocation/,
  );
  schoolYearWorkspaceSchema.parse(next);
});

test("bank match corrections and voids retain original audit history and permit corrected imports", () => {
  const f = bankFixture();
  let y = importBankStatement(f.y, admin, f.input);
  const s = y.workflows.bankStatements[0],
    r = { statementId: s.id, lineId: s.lines[0].id, journalId: f.journalId };
  y = matchBankLine(y, admin, r);
  const matched = structuredClone(y);
  assert.throws(
    () =>
      voidBankStatement(y, admin, {
        statementId: s.id,
        reason: "Incorrect import account label",
      }),
    /active matches/,
  );
  y = unmatchBankLine(y, admin, {
    statementId: s.id,
    lineId: r.lineId,
    reason: "Wrong supporting journal selected",
  });
  assertYearIntegrity(matched, y);
  schoolYearWorkspaceSchema.parse(y);
  assert.equal(y.workflows.bankStatements[0].matches[0].journalId, f.journalId);
  assert.ok(y.workflows.bankStatements[0].matches[0].voidedAt);
  assert.throws(
    () => closeBankStatement(y, reviewer, { statementId: s.id }),
    /every/,
  );
  const rematched = matchBankLine(y, admin, r);
  assert.equal(rematched.workflows.bankStatements[0].matches.length, 2);
  schoolYearWorkspaceSchema.parse(rematched);
  const voided = voidBankStatement(y, admin, {
    statementId: s.id,
    reason: "Incorrect import account label",
  });
  assertYearIntegrity(y, voided);
  schoolYearWorkspaceSchema.parse(voided);
  assert.equal(
    importBankStatement(voided, admin, f.input).workflows.bankStatements.length,
    2,
  );
  assert.throws(() => matchBankLine(voided, admin, r), /open/);
});
test("new assignments reject inactive or foreign students and another school", () => {
  const y = fixture(),
    f = transport(y);
  y.records.studentProfiles.find((p) => p.studentId === f.student.id)!.status =
    "transferred";
  const fresh = { ...f.allocation, id: crypto.randomUUID(), status: "draft" };
  assert.throws(() => saveOperation(y, admin, fresh), /active enrolled/);
  assert.throws(
    () => saveOperation(y, { ...admin, schoolId: "other-school" }, fresh),
    /role/,
  );
  assert.throws(
    () => saveOperation(y, admin, { ...fresh, studentId: "foreign" }),
    /scope/,
  );
});

test("partial purchase receipts retain delivery history, prevent over-receipt and allocate every minor unit", () => {
  let y = fixture();
  const vendor = row(
      y,
      "vendors",
      { contact: "Purchasing", email: "stock@example.test", address: "Stores" },
      "active",
    ),
    item = row(
      y,
      "items",
      { sku: "PARTIAL", unit: "Each", reorderLevel: 1 },
      "active",
    ),
    po = row(
      y,
      "purchase-orders",
      { vendorId: vendor.id, itemId: item.id, quantity: 3, amountMinor: 10000 },
      "approved",
    );
  y.extensions.push(vendor, item, po);
  function receive(quantity: number, reference: string) {
    const draft = row(
      y,
      "purchase-receipts",
      { purchaseOrderId: po.id, quantity, deliveryReference: reference },
      "draft",
    );
    y = saveOperation(y, admin, draft);
    const next = saveOperation(y, admin, { ...draft, status: "posted" });
    y = applyOperationalEffects(y, next, admin);
  }
  receive(1, "DELIVERY-1");
  assert.equal(stockBalance(y.extensions, item.id), 1);
  assert.equal(y.workflows.ledger.at(-1)?.lines[0].debitMinor, 3333);
  assert.equal(y.extensions.find((r) => r.id === po.id)?.status, "approved");
  assert.throws(
    () => saveOperation(y, admin, { ...po, status: "received" }),
    /outstanding delivery/,
  );
  assert.throws(
    () => saveOperation(y, admin, { ...po, status: "cancelled" }),
    /partially/,
  );
  const excess = row(
    y,
    "purchase-receipts",
    { purchaseOrderId: po.id, quantity: 3, deliveryReference: "TOO-MUCH" },
    "posted",
  );
  assert.throws(() => guardStock(y, excess), /ordered quantity/);
  assert.throws(
    () =>
      guardStock(y, {
        ...excess,
        values: {
          ...excess.values,
          quantity: 1,
          deliveryReference: "DELIVERY-1",
        },
      }),
    /already received/,
  );
  receive(2, "DELIVERY-2");
  assert.equal(stockBalance(y.extensions, item.id), 3);
  assert.equal(y.extensions.find((r) => r.id === po.id)?.status, "received");
  assert.equal(
    y.workflows.ledger.reduce((sum, j) => sum + j.lines[0].debitMinor, 0),
    10000,
  );
  schoolYearWorkspaceSchema.parse(y);
});
test("reconciliation requires matching every book movement and freezes the opening balance", () => {
  const f = bankFixture();
  let y = importBankStatement(f.y, admin, f.input),
    s = y.workflows.bankStatements[0];
  y = matchBankLine(y, admin, {
    statementId: s.id,
    lineId: s.lines[0].id,
    journalId: f.journalId,
  });
  const extra = postJournal(y, admin, {
    sourceKey: "extra-bank-movement",
    date: f.input.from,
    memo: "Unmatched bank debit",
    reversesId: null,
    lines: [
      { account: "Bank", debitMinor: 1, creditMinor: 0 },
      { account: "Opening balance", debitMinor: 0, creditMinor: 1 },
    ],
  });
  assert.throws(
    () => closeBankStatement(extra, reviewer, { statementId: s.id }),
    /unmatched bank ledger/,
  );
  const closed = closeBankStatement(y, reviewer, { statementId: s.id });
  assert.throws(
    () =>
      schoolYearWorkspaceSchema.parse({
        ...extra,
        workflows: {
          ...extra.workflows,
          bankStatements: closed.workflows.bankStatements,
        },
      }),
    /unmatched or newly backdated/,
  );
});

test("guardian outpass responses preserve school details and cannot be sent by students or unrelated parents", () => {
  const y = fixture(),
    link = y.setup.relationships.find(
      (r) =>
        r.guardianId === parent.personId &&
        r.canViewRecords &&
        ["parent", "guardian"].includes(r.relationship),
    )!;
  const pass = row(
    y,
    "outpasses",
    {
      startDate: y.setup.calendar.year.startDate,
      endDate: y.setup.calendar.year.endDate,
      destination: "Guardian home",
      guardianApproval: "Pending",
    },
    "requested",
    link.studentId,
  );
  y.extensions.push(pass);
  const next = respondOperation(y, parent, pass.id, { response: "Granted" });
  assert.equal(next.extensions[0].values.guardianApproval, "Granted");
  assert.equal(next.extensions[0].status, "requested");
  assert.equal(next.extensions[0].values.destination, pass.values.destination);
  assert.throws(
    () => respondOperation(next, parent, pass.id, { response: "Declined" }),
    /not open/,
  );
  assert.throws(
    () =>
      respondOperation(
        y,
        { ...parent, personId: "unrelated-guardian" },
        pass.id,
        { response: "Granted" },
      ),
    /linked/,
  );
  assert.throws(
    () =>
      respondOperation(
        y,
        { ...parent, role: "student", personId: link.studentId },
        pass.id,
        { response: "Granted" },
      ),
    /not open/,
  );
});

test("vendor payments settle only received liabilities and create reconcilable bank debits", () => {
  let y = fixture();
  const po = row(
    y,
    "purchase-orders",
    { vendorId: "vendor", itemId: "item", quantity: 1, amountMinor: 10000 },
    "received",
  );
  y.extensions.push(po);
  y = postJournal(y, admin, {
    sourceKey: `purchase:${po.id}`,
    date: po.date,
    memo: "Received approved order",
    reversesId: null,
    lines: [
      { account: "Inventory expense", debitMinor: 10000, creditMinor: 0 },
      { account: "Trade payable", debitMinor: 0, creditMinor: 10000 },
    ],
  });
  let payment = row(
    y,
    "purchase-payments",
    {
      purchaseOrderId: po.id,
      amountMinor: 10001,
      bankReference: "QA-VENDOR-BANK",
    },
    "draft",
  );
  y = saveOperation(y, admin, payment);
  assert.throws(
    () => saveOperation(y, admin, { ...payment, status: "posted" }),
    /liability/,
  );
  payment = { ...payment, values: { ...payment.values, amountMinor: 10000 } };
  y = saveOperation(y, admin, payment);
  const next = saveOperation(y, admin, { ...payment, status: "posted" });
  y = applyOperationalEffects(y, next, admin);
  assert.equal(
    y.workflows.ledger.at(-1)?.lines.find((l) => l.account === "Bank")
      ?.creditMinor,
    10000,
  );
  const duplicate = { ...payment, id: crypto.randomUUID() };
  y = saveOperation(y, admin, duplicate);
  assert.throws(
    () => saveOperation(y, admin, { ...duplicate, status: "posted" }),
    /liability/,
  );
  assert.throws(
    () => saveOperation(y, { ...admin, role: "inventory" }, payment),
    /cannot change/,
  );
});

test("finance workflows use billing permission through the actual cloud command boundary", () => {
  const f = bankFixture(),
    root = createWorkspace();
  root.years[0] = f.y;
  const request = {
    expectedRevision: root.revision,
    yearId: root.activeYearId,
    command: {
      type: "workflow",
      input: { action: "bank-import", input: f.input },
    },
  };
  const imported = applyCloudCommand(root, reviewer, request);
  assert.equal(imported.years[0].workflows.bankStatements.length, 1);
  const statement = imported.years[0].workflows.bankStatements[0],
    matched = applyCloudCommand(imported, reviewer, {
      expectedRevision: imported.revision,
      yearId: imported.activeYearId,
      command: {
        type: "workflow",
        input: {
          action: "bank-match",
          input: {
            statementId: statement.id,
            lineId: statement.lines[0].id,
            journalId: f.journalId,
          },
        },
      },
    });
  const closed = applyCloudCommand(matched, admin, {
    expectedRevision: matched.revision,
    yearId: matched.activeYearId,
    command: {
      type: "workflow",
      input: { action: "bank-close", input: { statementId: statement.id } },
    },
  });
  assert.equal(closed.years[0].workflows.bankStatements[0].closedBy, admin.id);
  assert.throws(
    () => applyCloudCommand(root, parent, request),
    /permission|Finance/,
  );
});

test("reservation priority follows server creation order rather than backdated client dates", () => {
  const y = fixture(),
    { book, copy } = library(y),
    [a, b] = y.setup.students;
  y.extensions.push(
    {
      ...row(y, "reservations", { bookId: book.id }, "requested", a.id),
      date: y.setup.calendar.year.endDate,
    },
    row(y, "reservations", { bookId: book.id }, "requested", b.id),
  );
  const loan = row(
    y,
    "loans",
    { copyId: copy.id, dueDate: y.setup.calendar.year.endDate },
    "issued",
    b.id,
  );
  assert.throws(() => guardCirculation(y, loan), /priority/);
  guardCirculation(y, { ...loan, studentId: a.id });
});

test("family transport projection follows dated assignments and withholds unrelated stops", async () => {
  const y = fixture(),
    f = transport(y),
    link = y.setup.relationships.find(
      (r) => r.studentId === f.student.id && r.canViewRecords,
    )!,
    actor = { ...parent, personId: link.guardianId };
  y.records.studentProfiles = y.records.studentProfiles.filter(
    (p) => p.studentId !== f.student.id,
  );
  y.extensions.push({
    ...f.stop,
    id: crypto.randomUUID(),
    title: "Unrelated route stop",
    values: { ...f.stop.values, sequence: 2 },
  });
  const { projectCloudWorkspace } = await import(
      "../src/features/cloud/domain/projection.ts"
    ),
    root = createWorkspace();
  root.years[0] = y;
  const projection = projectCloudWorkspace(root, actor).years[0];
  assert.ok(
    projection.records.routes.some((r) => r.id === f.trip.values.routeId),
  );
  assert.equal(
    projection.extensions.filter((r) => r.kind === "stops").length,
    1,
  );
  assert.equal(
    projection.extensions.find((r) => r.kind === "stops")?.id,
    f.stop.id,
  );
});

test("JSONB field reordering cannot block paid fine settlement or disguise changed reviewed details", () => {
  let y = fixture();
  const { copy } = library(y),
    student = y.setup.students[0],
    loan = row(
      y,
      "loans",
      { copyId: copy.id, dueDate: y.setup.calendar.year.endDate },
      "returned",
      student.id,
    );
  y.extensions.push(loan);
  const fine = row(
      y,
      "library-fines",
      { loanId: loan.id, amountMinor: 500, reason: "Verified damage fine" },
      "outstanding",
      student.id,
    ),
    created = saveOperation(y, admin, fine);
  y = applyOperationalEffects(y, created, admin);
  const invoice = y.records.invoices.at(-1)!;
  y = takePayment(y, {
    ...scope(y),
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    amountMinor: 500,
    refundedMinor: 0,
    paidOn: y.setup.calendar.year.startDate,
    method: "Cash",
    reference: "QA-JSONB-PAID",
    idempotencyKey: crypto.randomUUID(),
    status: "completed",
    note: "Synthetic verification",
  });
  const stored = y.extensions.find((r) => r.id === fine.id)!;
  stored.values = Object.fromEntries(Object.entries(stored.values).reverse());
  const next = saveOperation(y, admin, { ...fine, status: "settled" }),
    settled = applyOperationalEffects(y, next, admin);
  assert.equal(
    settled.extensions.find((r) => r.id === fine.id)?.status,
    "settled",
  );
  assertYearIntegrity(y, settled);
  assert.throws(
    () =>
      saveOperation(y, admin, {
        ...fine,
        status: "settled",
        values: { ...fine.values, amountMinor: 1 },
      }),
    /approved details/,
  );
  assert.ok(
    jsonEqual({ a: 1, b: [{ c: 2, d: 3 }] }, { b: [{ d: 3, c: 2 }], a: 1 }),
  );
  assert.equal(jsonEqual([1, 2], [2, 1]), false);
  assert.equal(jsonEqual({ a: 1 }, { b: 1 }), false);
});

test("immutable operational details do not advertise editing and families can cancel their own reservations", () => {
  let y = fixture();
  const { book } = library(y),
    student = y.setup.students[0],
    actor = {
      ...parent,
      personId: y.setup.relationships.find(
        (r) => r.studentId === student.id && r.canViewRecords,
      )!.guardianId,
    };
  const reservation = {
    ...row(y, "reservations", { bookId: book.id }, "requested", student.id),
    createdBy: actor.id,
  };
  y = saveOperation(y, actor, reservation);
  assert.equal(canEditOperation(actor, reservation), false);
  const next = saveOperation(y, actor, { ...reservation, status: "cancelled" });
  assert.equal(next.extensions.at(-1)?.status, "cancelled");
  assert.equal(
    canEditOperation(
      admin,
      row(
        y,
        "library-fines",
        { loanId: "loan", amountMinor: 500, reason: "Issued invoice" },
        "outstanding",
        student.id,
      ),
    ),
    false,
  );
});
