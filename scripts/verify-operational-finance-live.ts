/** Append labelled synthetic workflow records; preserve all existing identities and memberships. */
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { writeFile } from "node:fs/promises";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { TEST_ACCOUNT_PASSWORD } from "../src/features/identity/data/test-accounts.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import type { OperationRecord } from "../src/features/operations/models/index.ts";
nextEnv.loadEnvConfig(process.cwd());
const c = getSupabaseConfig(),
  secret = process.env.SUPABASE_SERVER_SECRET_KEY,
  base = "http://127.0.0.1:3000";
if (
  !secret ||
  process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true" ||
  c.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co"
)
  throw new Error("Expected synthetic school project.");
const bounded: typeof fetch = (url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(60000) }),
  sdk = createClient(c.url, secret, {
    global: { fetch: bounded },
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  sessions = new Map<
    string,
    {
      client: SupabaseClient;
      cookies: Map<string, string>;
      id: string;
      personId: string | null;
    }
  >(),
  checks: { case: string; passed: boolean }[] = [];
function check(label: string, value: unknown): asserts value {
  checks.push({ case: label, passed: Boolean(value) });
  if (checks.length % 10 === 0)
    console.log(JSON.stringify({ checked: checks.length, last: label }));
  if (!value) throw new Error(label);
}
async function read() {
  const { data, error } = await sdk.rpc("mis_read_workspace", {
    p_school_id: "school-greenfield",
  });
  if (error) throw new Error("Workspace read failed.");
  return workspaceSchema.parse(data);
}
async function year() {
  const root = await read();
  return root.years.find(
    (y) => y.setup.calendar.year.id === root.activeYearId,
  )!;
}
async function globalCommand(
  role: string,
  command: unknown,
  attempt = 0,
): Promise<Response> {
  const root = await read();
  const response = await bounded(base + "/api/workflows", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: [...sessions.get(role)!.cookies]
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    },
    body: JSON.stringify({
      expectedRevision: root.revision,
      yearId: root.activeYearId,
      command,
    }),
  });
  return response.status === 409 && attempt < 3
    ? globalCommand(role, command, attempt + 1)
    : response;
}
async function save(
  row: OperationRecord,
  label: string,
  expected = 200,
  role = "admin",
) {
  const res = await globalCommand(role, { type: "operation-save", input: row });
  if (res.status !== expected)
    console.log(JSON.stringify({ label, status: res.status, expected }));
  check(label, res.status === expected);
}
async function workflow(
  action: string,
  input: unknown,
  label: string,
  expected = 200,
  role = "admin",
) {
  const res = await globalCommand(role, {
    type: "workflow",
    input: { action, input },
  });
  if (res.status !== expected)
    console.log(JSON.stringify({ label, status: res.status, expected }));
  check(label, res.status === expected);
}
try {
  for (const role of ["admin", "teacher", "staff", "parent", "student"]) {
    const cookies = new Map<string, string>(),
      client: SupabaseClient = createServerClient(c.url, c.publishableKey, {
        global: { fetch: bounded },
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (values) => {
            for (const v of values)
              v.value ? cookies.set(v.name, v.value) : cookies.delete(v.name);
          },
        },
      });
    const { data, error } = await client.auth.signInWithPassword({
      email: `${role}@greenfield.test`,
      password: TEST_ACCOUNT_PASSWORD,
    });
    check(`${role} sign-in`, !error && data.user);
    const { data: member, error: membershipError } = await client
      .from("mis_memberships")
      .select("person_id,role")
      .single();
    check(
      `${role} original role unchanged`,
      !membershipError && member.role === role,
    );
    sessions.set(role, {
      client,
      cookies,
      id: data.user.id,
      personId: member.person_id,
    });
  }
  const root = await read(),
    y = root.years.find((v) => v.setup.calendar.year.id === root.activeYearId)!,
    next = structuredClone(root),
    v = next.years.find((v) => v.setup.calendar.year.id === root.activeYearId)!,
    prefix = `QA Ops ${crypto.randomUUID().slice(0, 8)}`,
    scope = {
      schoolId: y.setup.school.id,
      academicYearId: y.setup.calendar.year.id,
    },
    classId = crypto.randomUUID(),
    students = [crypto.randomUUID(), crypto.randomUUID()],
    profile = y.records.studentProfiles.find((p) => p.status === "active")!;
  const beforeStudentIds = y.setup.students.map((s) => s.id),
    beforeStaff = y.setup.staff.map((s) => s.id);
  v.setup.classes.push({
    ...scope,
    id: classId,
    grade: "QA Operations",
    section: prefix.slice(-8),
    capacity: 2,
  });
  v.setup.allocations.push({
    id: crypto.randomUUID(),
    staffId: sessions.get("teacher")!.personId!,
    classSectionId: classId,
    subject: y.setup.allocations[0].subject,
  });
  for (const [i, id] of students.entries()) {
    v.setup.students.push({
      ...y.setup.students[0],
      id,
      classSectionId: classId,
      displayName: `${prefix} Student ${i + 1}`,
      admissionNumber: `OPS-${id}`,
    });
    v.records.studentProfiles.push({
      ...profile,
      ...scope,
      id: crypto.randomUUID(),
      studentId: id,
      status: "active",
      routeId: null,
      documents: [],
    });
  }
  const guardian = sessions.get("parent")!.personId!;
  v.setup.relationships.push({
    schoolId: scope.schoolId,
    guardianId: guardian,
    studentId: students[0],
    relationship: "parent",
    canViewRecords: true,
    canReceiveNotices: false,
  });
  next.revision++;
  const { error: fixtureError } = await sdk.rpc("mis_commit_workspace", {
    p_school_id: scope.schoolId,
    p_expected_revision: root.revision,
    p_document: workspaceSchema.parse(next),
    p_actor_id: sessions.get("admin")!.id,
    p_action: "QA: append isolated operational students and class",
  });
  check("Isolated QA fixture appended", !fixtureError);
  const date = y.setup.calendar.year.startDate,
    end = y.setup.calendar.year.endDate;
  function row(
    kind: string,
    values: OperationRecord["values"],
    status: string,
    studentId: string | null = null,
  ): OperationRecord {
    return {
      ...scope,
      id: crypto.randomUUID(),
      kind,
      values,
      status,
      studentId,
      staffId: null,
      date,
      title: `${prefix} ${kind}`,
      createdBy: sessions.get("admin")!.id,
      history: [],
    };
  }
  const book = row(
    "books",
    { isbn: prefix, author: "Verification author", category: "School" },
    "active",
  );
  const conflictResponse = await bounded(base + "/api/workflows", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: [...sessions.get("admin")!.cookies]
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    },
    body: JSON.stringify({
      expectedRevision: root.revision,
      yearId: root.activeYearId,
      command: { type: "operation-save", input: book },
    }),
  });
  check(
    "Stale saves return an explicit conflict",
    conflictResponse.status === 409,
  );
  await save(book, "Catalogue title created");
  const copy = row(
    "copies",
    { bookId: book.id, barcode: `COPY-${book.id}`, shelf: "QA" },
    "available",
  );
  await save(copy, "Physical copy registered");
  const reservation = row(
    "reservations",
    { bookId: book.id },
    "requested",
    students[0],
  );
  await save(reservation, "Parent reserves own linked student", 200, "parent");
  await save(
    { ...reservation, id: crypto.randomUUID(), studentId: students[1] },
    "Parent cannot reserve unrelated student",
    403,
    "parent",
  );
  const loan = row(
    "loans",
    { copyId: copy.id, dueDate: end },
    "issued",
    students[1],
  );
  await save(loan, "Queue priority enforced", 403);
  await save({ ...reservation, status: "ready" }, "Reservation marked ready");
  await save(
    { ...reservation, status: "collected" },
    "Reservation cannot collect before issue",
    403,
  );
  loan.studentId = students[0];
  await save(loan, "Reserved copy issued");
  await save(
    { ...reservation, status: "collected" },
    "Reservation linked to collected loan",
  );
  const cancelReservation = { ...reservation, id: crypto.randomUUID() };
  await save(
    cancelReservation,
    "Family creates cancellable reservation",
    200,
    "parent",
  );
  await save(
    { ...cancelReservation, status: "cancelled" },
    "Family cancels its own reservation",
    200,
    "parent",
  );
  await save(
    { ...loan, id: crypto.randomUUID() },
    "Duplicate issue rejected",
    403,
  );
  await save({ ...copy, status: "lost" }, "Cannot lose an issued copy", 403);
  await save({ ...loan, status: "returned" }, "Physical return recorded");
  const fine = row(
    "library-fines",
    { loanId: loan.id, amountMinor: 500, reason: "Verified synthetic damage" },
    "outstanding",
    students[0],
  );
  await save(fine, "Fine creates linked invoice");
  await save({ ...fine, status: "settled" }, "Unpaid fine cannot settle", 403);
  const fineInvoice = (await year()).records.invoices.find(
    (i) => i.period === `Library fine ${fine.id}`,
  )!;
  check("Linked fine invoice exists", fineInvoice?.studentId === students[0]);
  const payment = {
    ...scope,
    id: crypto.randomUUID(),
    invoiceId: fineInvoice.id,
    refundedMinor: 0,
    amountMinor: 500,
    paidOn: date,
    method: "Cash",
    reference: `QA-${crypto.randomUUID()}`,
    idempotencyKey: crypto.randomUUID(),
    status: "completed",
    note: "Synthetic cash verification",
  };
  check(
    "Fine collection recorded",
    (await globalCommand("admin", { type: "billing-collect", input: payment }))
      .status === 200,
  );
  await save({ ...fine, status: "settled" }, "Paid fine settles");
  const bed = row(
    "beds",
    { building: prefix, room: "101", bed: "1" },
    "available",
  );
  await save(bed, "Hostel bed created");
  const residence = row(
    "hostel-allocations",
    { bedId: bed.id, startDate: date, endDate: end },
    "draft",
    students[0],
  );
  await save(residence, "Hostel allocation drafted");
  await save({ ...residence, status: "active" }, "Hostel check-in activated");
  const duplicate = {
    ...residence,
    id: crypto.randomUUID(),
    studentId: students[1],
  };
  await save(duplicate, "Second hostel draft saved");
  await save(
    { ...duplicate, status: "active" },
    "Overlapping bed rejected",
    403,
  );
  await save(
    { ...duplicate, status: "cancelled" },
    "Unused hostel draft cancelled",
  );
  const pass = row(
    "outpasses",
    {
      startDate: date,
      endDate: end,
      destination: "Verification guardian home",
      guardianApproval: "Pending",
    },
    "requested",
    students[0],
  );
  await save(pass, "Outpass requested");
  await save(
    { ...pass, status: "approved" },
    "Pending guardian approval blocks school approval",
    400,
  );
  check(
    "Student cannot give guardian approval",
    (
      await globalCommand("student", {
        type: "operation-respond",
        id: pass.id,
        input: { response: "Granted" },
      })
    ).status === 403,
  );
  check(
    "Linked guardian responds to outpass",
    (
      await globalCommand("parent", {
        type: "operation-respond",
        id: pass.id,
        input: { response: "Granted" },
      })
    ).status === 200,
  );
  pass.values.guardianApproval = "Granted";
  await save({ ...pass, status: "approved" }, "Outpass approved");
  await save({ ...pass, status: "out" }, "Departure recorded");
  await save(
    { ...pass, status: "cancelled" },
    "Departed outpass cannot cancel",
    403,
  );
  await save(
    { ...residence, status: "ended" },
    "Checkout blocked while student out",
    403,
  );
  const roll = row(
    "roll-call",
    { status: "Present", note: "Daily residence register" },
    "recorded",
    students[0],
  );
  await save(roll, "Contradictory residence attendance rejected", 403);
  roll.values.status = "On approved outpass";
  await save(roll, "Outpass-linked residence attendance saved");
  await save({ ...pass, status: "returned" }, "Return recorded");
  await workflow(
    "service-charge",
    {
      allocationId: residence.id,
      month: date.slice(0, 7),
      amountMinor: 120000,
      issuedOn: date,
      dueDate: end,
    },
    "Hostel monthly invoice issued",
  );
  await workflow(
    "service-charge",
    {
      allocationId: residence.id,
      month: date.slice(0, 7),
      amountMinor: 120000,
      issuedOn: date,
      dueDate: end,
    },
    "Duplicate monthly charge rejected",
    403,
  );
  await save({ ...residence, status: "ended" }, "Hostel checkout completed");
  const route = y.records.routes[0],
    vehicle = row(
      "vehicles",
      {
        registration: `QA-${book.id.slice(0, 8)}`,
        capacity: 1,
        insuranceUntil: end,
      },
      "active",
    ),
    stop = row(
      "stops",
      {
        routeId: route.id,
        location: "Verification stop",
        sequence:
          Math.max(
            0,
            ...y.extensions
              .filter(
                (r) =>
                  r.kind === "stops" &&
                  r.status === "active" &&
                  r.values.routeId === route.id,
              )
              .map((r) => Number(r.values.sequence)),
          ) + 1,
        pickupTime: "08:00",
      },
      "active",
    );
  await save(vehicle, "Transport vehicle created");
  await save(stop, "Transport stop created");
  const driver = {
    ...row(
      "drivers",
      { vehicleId: vehicle.id, licence: `QA-${vehicle.id}`, validUntil: end },
      "active",
    ),
    staffId: sessions.get("staff")!.personId,
  };
  await save(driver, "Driver assigned");
  const allocation = row(
    "transport-allocations",
    { routeId: route.id, stopId: stop.id, startDate: date, endDate: end },
    "draft",
    students[0],
  );
  await save(allocation, "Passenger assignment drafted");
  await save(
    { ...allocation, status: "active" },
    "Passenger assignment activated",
  );
  check(
    "Transport allocation updates family route",
    (await year()).records.studentProfiles.find(
      (p) => p.studentId === students[0],
    )?.routeId === route.id,
  );
  const trip = {
    ...row(
      "trips",
      { routeId: route.id, vehicleId: vehicle.id, direction: "Pickup" },
      "planned",
    ),
    staffId: driver.staffId,
  };
  await save(trip, "Trip planned");
  await save({ ...trip, status: "started" }, "Safe dispatch succeeds");
  const passenger = (await year()).extensions.find(
    (r) => r.kind === "boarding" && r.values.tripId === trip.id,
  )!;
  check(
    "Dispatch generated waiting roster",
    passenger?.studentId === students[0],
  );
  await save(
    { ...trip, status: "completed" },
    "Trip completion blocked while waiting",
    403,
  );
  await save({ ...passenger, status: "boarded" }, "Student boarded");
  await save(
    { ...passenger, status: "cancelled" },
    "On-board passenger cannot cancel",
    403,
  );
  await save({ ...passenger, status: "alighted" }, "Student alighted");
  await save({ ...trip, status: "completed" }, "Trip completed");
  const vendor = row(
      "vendors",
      {
        contact: "QA Storekeeper",
        email: "stores@example.test",
        address: "School stores",
      },
      "active",
    ),
    item = row(
      "items",
      { sku: `QA-${crypto.randomUUID()}`, unit: "Each", reorderLevel: 2 },
      "active",
    );
  await save(vendor, "Vendor created");
  await save(item, "Inventory item created");
  const po = row(
    "purchase-orders",
    { vendorId: vendor.id, itemId: item.id, quantity: 10, amountMinor: 20000 },
    "draft",
  );
  await save(po, "Purchase drafted");
  await save({ ...po, status: "submitted" }, "Purchase submitted");
  await save({ ...po, status: "approved" }, "Purchase approved");
  await save({ ...po, status: "received" }, "Purchase received");
  const receiptYear = await year();
  check(
    "Stock receipt generated once",
    receiptYear.extensions.filter(
      (r) =>
        r.kind === "stock-movements" &&
        r.values.itemId === item.id &&
        r.status === "posted",
    ).length === 1,
  );
  check(
    "Purchase linked to payable journal",
    receiptYear.workflows.ledger.some(
      (j) => j.sourceKey === `purchase:${po.id}`,
    ),
  );
  const issue = row(
    "stock-movements",
    { itemId: item.id, direction: "Issue", quantity: 11, department: prefix },
    "draft",
  );
  await save(issue, "Stock issue draft");
  await save(
    { ...issue, status: "posted" },
    "Excess stock issue rejected",
    403,
  );
  issue.values.quantity = 4;
  await save(issue, "Issue quantity corrected before posting");
  await save({ ...issue, status: "posted" }, "Stock issued");
  const returned = row(
    "stock-movements",
    { itemId: item.id, direction: "Return", quantity: 5, department: prefix },
    "draft",
  );
  await save(returned, "Stock return draft");
  await save(
    { ...returned, status: "posted" },
    "Excess department return rejected",
    403,
  );
  returned.values.quantity = 4;
  await save(returned, "Return corrected before posting");
  await save({ ...returned, status: "posted" }, "Stock returned");
  const partial = {
    ...po,
    id: crypto.randomUUID(),
    title: `${prefix} partial order`,
    values: { ...po.values, quantity: 3, amountMinor: 10000 },
  };
  await save(partial, "Partial order drafted");
  await save({ ...partial, status: "submitted" }, "Partial order submitted");
  await save({ ...partial, status: "approved" }, "Partial order approved");
  const receipt1 = row(
    "purchase-receipts",
    {
      purchaseOrderId: partial.id,
      quantity: 1,
      deliveryReference: `${prefix}-DEL-1`,
    },
    "draft",
  );
  await save(receipt1, "First partial delivery drafted");
  await save(
    { ...receipt1, status: "posted" },
    "First partial delivery posted",
  );
  await save(
    { ...partial, status: "received" },
    "Partial order cannot bypass remaining delivery",
    403,
  );
  const receipt2 = row(
    "purchase-receipts",
    {
      purchaseOrderId: partial.id,
      quantity: 2,
      deliveryReference: `${prefix}-DEL-2`,
    },
    "draft",
  );
  await save(receipt2, "Final partial delivery drafted");
  await save(
    { ...receipt2, status: "posted" },
    "Final partial delivery posted",
  );
  const partialYear = await year();
  check(
    "Final partial delivery completes order",
    partialYear.extensions.find((r) => r.id === partial.id)?.status ===
      "received",
  );
  check(
    "Partial receipts allocate exact order cost",
    partialYear.workflows.ledger
      .filter((j) =>
        [
          `purchase-receipt:${receipt1.id}`,
          `purchase-receipt:${receipt2.id}`,
        ].includes(j.sourceKey),
      )
      .reduce((sum, j) => sum + j.lines[0].debitMinor, 0) === 10000,
  );
  const vendorPayment = row(
    "purchase-payments",
    {
      purchaseOrderId: po.id,
      amountMinor: 21000,
      bankReference: `${prefix}-VENDOR-PAY`,
    },
    "draft",
  );
  await save(vendorPayment, "Vendor payment drafted");
  await save(
    { ...vendorPayment, status: "posted" },
    "Overpayment against received stock rejected",
    403,
  );
  vendorPayment.values.amountMinor = 20000;
  await save(vendorPayment, "Vendor payment corrected before posting");
  await save(
    { ...vendorPayment, status: "posted" },
    "Vendor bank payment recorded against liability",
  );
  check(
    "Vendor payment posts bank debit movement",
    (await year()).workflows.ledger.some(
      (j) =>
        j.sourceKey === `purchase-payment:${vendorPayment.id}` &&
        j.lines.some((l) => l.account === "Bank" && l.creditMinor === 20000),
    ),
  );
  let bankDate = date;
  const currentYear = await year();
  for (let day = 1; day < 350; day++) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + day);
    const candidate = d.toISOString().slice(0, 10);
    if (
      candidate <= end &&
      !currentYear.workflows.ledger.some(
        (j) =>
          j.date === candidate && j.lines.some((l) => l.account === "Bank"),
      ) &&
      !currentYear.workflows.bankStatements.some(
        (s) => !s.voidedAt && s.from <= candidate && s.to >= candidate,
      )
    ) {
      bankDate = candidate;
      break;
    }
  }
  const journal = row(
    "journals",
    {
      debitAccount: "Bank",
      creditAccount: "Opening balance",
      amountMinor: 12345,
      memo: `${prefix} bank statement check`,
    },
    "draft",
  );
  journal.date = bankDate;
  await save(journal, "Bank journal drafted");
  await save({ ...journal, status: "posted" }, "Balanced bank journal posted");
  const posted = (await year()).workflows.ledger.find(
    (j) => j.sourceKey === `journal:${journal.id}`,
  )!;
  const prior = (await year()).workflows.bankStatements.filter(
      (s) => !s.voidedAt,
    ),
    account = prior[0]?.account ?? "School bank",
    earlier = prior
      .filter((s) => s.to < bankDate)
      .sort((a, b) => b.to.localeCompare(a.to))[0],
    later = prior
      .filter((s) => s.from > bankDate)
      .sort((a, b) => a.from.localeCompare(b.from))[0];
  const opening = (await year()).workflows.ledger
      .filter((j) => j.date < bankDate)
      .flatMap((j) => j.lines)
      .filter((l) => l.account === "Bank")
      .reduce((sum, l) => sum + l.debitMinor - l.creditMinor, 0),
    bankInput = {
      account,
      from: bankDate,
      to: bankDate,
      openingMinor: opening,
      closingMinor: opening + 12345,
      lines: [
        {
          date: bankDate,
          reference: `QA-BANK-${journal.id}`,
          amountMinor: 12345,
        },
      ],
    };
  await workflow(
    "bank-import",
    { ...bankInput, closingMinor: 1 },
    "Unbalanced bank statement rejected",
    400,
  );
  await workflow("bank-import", bankInput, "Balanced bank statement imported");
  await workflow(
    "bank-import",
    bankInput,
    "Duplicate bank statement rejected",
    403,
  );
  const statement = (await year()).workflows.bankStatements.at(-1)!,
    match = {
      statementId: statement.id,
      lineId: statement.lines[0].id,
      journalId: posted.id,
    };
  await workflow(
    "bank-close",
    { statementId: statement.id },
    "Unmatched statement cannot close",
    403,
  );
  await workflow("bank-match", match, "Exact bank journal matched");
  await workflow("bank-match", match, "Duplicate match rejected", 403);
  await workflow(
    "bank-close",
    { statementId: statement.id },
    "Importer cannot independently reconcile",
    403,
  );
  await workflow(
    "bank-unmatch",
    {
      statementId: statement.id,
      lineId: match.lineId,
      reason: "Synthetic correction verification",
    },
    "Match correction preserves audit",
  );
  await workflow("bank-match", match, "Corrected statement line rematched");
  for (const role of ["teacher", "staff", "parent", "student"]) {
    await workflow(
      "bank-import",
      bankInput,
      `${role} cannot import bank statements`,
      403,
      role,
    );
    await workflow(
      "service-charge",
      {
        allocationId: allocation.id,
        month: date.slice(0, 7),
        amountMinor: 1000,
        issuedOn: date,
        dueDate: end,
      },
      `${role} cannot issue service charges`,
      403,
      role,
    );
    await save(
      {
        ...item,
        id: crypto.randomUUID(),
        values: { ...item.values, sku: crypto.randomUUID() },
      },
      `${role} cannot mutate inventory`,
      403,
      role,
    );
  }
  const after = await read(),
    afterYear = after.years.find(
      (v) => v.setup.calendar.year.id === after.activeYearId,
    )!;
  check(
    "Every original student preserved",
    beforeStudentIds.every((id) =>
      afterYear.setup.students.some((s) => s.id === id),
    ),
  );
  check(
    "Every original staff record preserved",
    beforeStaff.every((id) => afterYear.setup.staff.some((s) => s.id === id)),
  );
  for (const [role, s] of sessions) {
    const { data } = await s.client
      .from("mis_memberships")
      .select("role")
      .single();
    check(`${role} membership restored/unchanged`, data?.role === role);
  }
  console.log(
    JSON.stringify({
      passed: checks.filter((c) => c.passed).length,
      total: checks.length,
      syntheticPrefix: prefix,
      liveIndependentClosure:
        "Requires separate finance account; domain-tested only",
    }),
  );
} finally {
  for (const s of sessions.values())
    await s.client.auth.signOut({ scope: "local" }).catch(() => {});
  await writeFile(
    "docs/operational-finance-live-verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        limitations: [
          "Independent finance closure covered by domain tests; no second finance login was provisioned or existing membership changed.",
        ],
      },
      null,
      2,
    ),
  );
}
