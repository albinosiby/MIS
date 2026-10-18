import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";
import { applyWorkflowCommand } from "../src/features/workspace/domain/workflow-commands.ts";
import { assertYearIntegrity } from "../src/features/workspace/domain/record-integrity.ts";
import { projectWorkflowState } from "../src/features/workspace/domain/workflow-projection.ts";
import {
  saveAdvancedSettings,
  saveCustomValues,
  requestWorkflowApproval,
  decideWorkflowApproval,
} from "../src/features/settings/domain/advanced-settings.ts";
import { postJournal } from "../src/features/fees/domain/ledger.ts";
import { canReadPublication } from "../src/features/reports/domain/publication-access.ts";
import { renderPublication } from "../src/features/reports/domain/render-publication.ts";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import {saveOperation} from "../src/features/operations/domain/operations.ts";
import {gradeQuizAttempt} from "../src/features/learning/domain/grade-quiz.ts";
import {recordLearningProgress} from "../src/features/learning/domain/progress.ts";
import {workspaceSchema} from "../src/features/workspace/schemas/workspace.schema.ts";
import {classAtDate} from "../src/features/students/domain/class-history.ts";
import {
  selectMembershipContext,
  mayAssignSchoolRole,
} from "../src/features/identity/domain/membership-context.ts";
import { mfaRequestSchema } from "../src/features/identity/schemas/mfa.schema.ts";
import { applyOperationalEffects } from "../src/features/operations/domain/connected-effects.ts";
import {
  assertMutationPermission,
  commandCapability,
} from "../src/features/identity/domain/mutation-policy.ts";
import { prepareWorkspaceReplacement } from "../src/features/cloud/domain/workspace-replacement.ts";
import { issueBulkCertificates } from "../src/features/documents/domain/issue-publications.ts";
import { canAccess } from "../src/features/identity/domain/access.ts";
import { canUseCollection } from "../src/features/operations/domain/operations.ts";
import {
  attendanceEligibility,
  consecutiveAbsences,
} from "../src/features/attendance/domain/eligibility.ts";
import { staffLeaveEntitlement } from "../src/features/attendance/domain/leave-policy.ts";
import {
  decideLeave,
  balance,
} from "../src/features/workspace/domain/operations.ts";
const actor = (role: string) => testAccounts.find((a) => a.role === role)!;
const admin = actor("admin");
test("exact-answer quizzes score server-side, enforce attempt allowances and preserve student authorship",()=>{
 let y=createWorkspace().years[0];const student=actor("student"),classId=y.setup.students.find(s=>s.id===student.personId)!.classSectionId,quiz=y.extensions.find(q=>q.kind==="quizzes")!;
 y={...y,extensions:y.extensions.filter(r=>r.kind!=="quiz-attempts").map(q=>q.id===quiz.id?{...q,status:"published",values:{...q.values,classSectionId:classId,answer:"The Pacific Ocean",maxScore:10,gradingMode:"Exact answer",maxAttempts:1}}:q)};
 const input={...quiz,id:"exact-response",kind:"quiz-attempts",title:"Geography response",studentId:student.personId,staffId:null,status:"submitted",values:{quizId:quiz.id,response:"  the   PACIFIC ocean ",score:0},createdBy:student.id,history:[]};
 assert.throws(()=>saveOperation(y,actor("parent"),input));assert.throws(()=>saveOperation(y,actor("teacher"),input));
 y=saveOperation(y,student,input);const saved=y.extensions.find(r=>r.id===input.id)!;assert.equal(saved.status,"graded");assert.equal(saved.values.score,10);assert.equal(saved.createdBy,student.id);
 assert.throws(()=>saveOperation(y,student,{...input,id:"another-response"}));assert.throws(()=>saveOperation(y,actor("teacher"),{...saved,values:{...saved.values,response:"Teacher changed answer"}}));
 const reviewed=gradeQuizAttempt(y,admin,{id:saved.id,score:8,feedback:"Reviewed answer against the accepted rubric"});assert.equal(reviewed.extensions.find(r=>r.id===saved.id)!.values.score,8);assert.equal(reviewed.extensions.find(r=>r.id===saved.id)!.values.response,input.values.response);
});
test("learning progress belongs to the authenticated active student and stays hidden from unrelated modules",()=>{
 let y=createWorkspace().years[0];const student=actor("student"),resource=y.extensions.find(r=>r.kind==="resources")!,classId=y.setup.students.find(s=>s.id===student.personId)!.classSectionId;y={...y,extensions:y.extensions.map(r=>r.id===resource.id?{...r,status:"published",values:{...r.values,classSectionId:classId}}:r)};
 assert.throws(()=>recordLearningProgress(y,actor("parent"),{resourceId:resource.id,state:"completed"}));
 y=recordLearningProgress(y,student,{resourceId:resource.id,state:"completed"});assert.equal(y.workflows.learningProgress[0].studentId,student.personId);assert.equal(projectWorkflowState(y,actor("nurse")).learningProgress.length,0);assert.throws(()=>recordLearningProgress(y,student,{resourceId:resource.id,state:"started"}));
});
test("class movement preserves existing academic records and their contextual class membership",()=>{
 const root=createWorkspace(),before=root.years[0],student=before.setup.students.find(s=>s.id==="student-1")!,target=before.setup.classes.find(c=>c.id!==student.classSectionId)!;
 const moved=applyWorkflowCommand(before,admin,{action:"student-lifecycle",input:{studentId:student.id,kind:"class-changed",classSectionId:target.id,date:"2026-10-18",note:"Approved section movement"}});
 assert.equal(classAtDate(target.id,moved.workflows.studentEvents,student.id,"2026-10-17"),student.classSectionId);assert.equal(classAtDate(target.id,moved.workflows.studentEvents,student.id,"2026-10-18"),target.id);
 assert.deepEqual(moved.records.marks,before.records.marks);assert.ok(workspaceSchema.safeParse({...root,years:[moved,...root.years.slice(1)]}).success);
});
test("attendance eligibility separates missing days, excused days and consecutive instructional absences", () => {
  let y = createWorkspace().years[0];
  const day = "2026-04-01";
  y = {
    ...y,
    setup: {
      ...y.setup,
      calendar: {
        ...y.setup.calendar,
        year: { ...y.setup.calendar.year, startDate: day },
      },
    },
    records: {
      ...y.records,
      events: [],
      attendance: [
        {
          id: "attendance-boundary",
          schoolId: admin.schoolId,
          academicYearId: y.setup.calendar.year.id,
          personType: "student",
          personId: "student-1",
          date: day,
          periodId: null,
          status: "absent",
          note: "Recorded absence",
        },
      ],
    },
  };
  assert.equal(
    attendanceEligibility(y, "student-1", day).status,
    "below-threshold",
  );
  assert.equal(consecutiveAbsences(y, "student-1", day), 1);
  assert.equal(
    attendanceEligibility(y, "student-1", "2026-04-02").status,
    "incomplete",
  );
  y.records.attendance[0].status = "excused";
  assert.equal(attendanceEligibility(y, "student-1", day).percent, null);
  assert.equal(consecutiveAbsences(y, "student-1", day), 0);
});
test("staff leave consumes working-day allowances and snapshots paid status at approval", () => {
  let y = createWorkspace().years[0];
  y = { ...y, records: { ...y.records, leaves: [] } };
  const leave = {
    id: "leave-policy-boundary",
    schoolId: admin.schoolId,
    academicYearId: y.setup.calendar.year.id,
    personType: "staff" as const,
    personId: "staff-2",
    dates: { startDate: "2026-10-19", endDate: "2026-10-20" },
    reason: "Personal leave requested",
    status: "pending" as const,
    decisionNote: "",
    leaveType: "Casual leave",
  };
  y = { ...y, records: { ...y.records, leaves: [leave] } };
  y = decideLeave(y, leave.id, "approved", "Reviewed by school office");
  assert.equal(y.records.leaves[0].paid, true);
  assert.equal(
    staffLeaveEntitlement(y, "staff-2", "Casual leave").remainingDays,
    10,
  );
  const changed = structuredClone(y);
  changed.records.leaves[0].paid = false;
  assert.throws(() => assertYearIntegrity(y, changed));
});
test("refunded collections reopen invoice balances and cannot be imported as new receipts", () => {
  let y = createWorkspace().years[0];
  const invoice = y.records.invoices[0],
    total =
      invoice.lines.reduce((s, l) => s + l.amountMinor, 0) -
      invoice.concessionMinor;
  const payment = {
    id: "net-payment",
    schoolId: admin.schoolId,
    academicYearId: y.setup.calendar.year.id,
    invoiceId: invoice.id,
    refundedMinor: 100,
    amountMinor: 1000,
    paidOn: "2026-10-18",
    method: "Cash" as const,
    reference: "NET-1",
    idempotencyKey: "net-key",
    status: "completed" as const,
    note: "Collection partly refunded",
  };
  y = { ...y, records: { ...y.records, payments: [payment] } };
  assert.equal(balance(y, invoice.id), total - 900);
});
test("family private-file access does not grant document-template editing; certificate batches snapshot templates", () => {
  assert.equal(canAccess("parent", "/documents/files"), true);
  assert.equal(canAccess("parent", "/documents/certificate-templates"), false);
  assert.equal(
    canUseCollection(actor("student"), "certificate-templates", true),
    false,
  );
  let y = createWorkspace().years[0];
  const template = y.extensions.find(
    (t) => t.kind === "certificate-templates",
  )!;
  y = {
    ...y,
    extensions: y.extensions.map((t) =>
      t.id === template.id
        ? {
            ...t,
            status: "published",
            values: {
              prefix: "GF",
              body: "This certifies {{student}} at {{school}} for {{year}}.",
            },
          }
        : t,
    ),
  };
  const issued = issueBulkCertificates(y, admin, {
    studentIds: ["student-1", "student-2"],
    templateId: template.id,
    type: "Bonafide",
    issuedOn: "2026-10-18",
  });
  const pubs = issued.workflows.publications.filter(
    (p) => p.kind === "certificate",
  );
  assert.equal(pubs.length, 2);
  assert.notEqual(pubs[0].reference, pubs[1].reference);
  assert.ok(
    String(pubs[0].snapshot.body).includes(
      y.setup.students.find((s) => s.id === "student-1")!.displayName,
    ),
  );
  assert.equal(issued.workflows.studentEvents.length, 2);
  assert.throws(() =>
    issueBulkCertificates(y, actor("teacher"), {
      studentIds: ["student-1"],
      templateId: template.id,
      type: "Bonafide",
      issuedOn: "2026-10-18",
    }),
  );
  assert.throws(() =>
    issueBulkCertificates(y, admin, {
      studentIds: ["student-1", "student-1"],
      templateId: template.id,
      type: "Bonafide",
      issuedOn: "2026-10-18",
    }),
  );
});
test("role restrictions block commands without expanding role reads or allowing compatibility-write bypasses", () => {
  const root = createWorkspace(),
    a = { ...admin, blockedMutations: ["billing" as const] };
  assert.throws(() => assertMutationPermission(a, "billing"));
  assert.doesNotThrow(() => assertMutationPermission(a, "teaching"));
  assert.equal(
    commandCapability({ type: "billing-remind", ids: ["invoice-1"] }),
    "billing",
  );
  const refund = root.years[0].extensions.find(
    (r) => r.kind === "payment-plans",
  )!;
  assert.equal(
    commandCapability({ type: "operation-save", input: refund }),
    "billing",
  );
  assert.throws(() =>
    prepareWorkspaceReplacement(
      root,
      a,
      { ...root, revision: root.revision + 1 },
      root.revision,
      "Compatibility update",
    ),
  );
});
test("school context selection cannot accept foreign, disabled or forged memberships", () => {
  const primary = {
    membership_id: "primary:user",
    user_id: admin.id,
    school_id: admin.schoolId,
    role: admin.role,
    person_id: admin.personId,
    display_name: admin.name,
    active: true,
  };
  const additional = {
    ...primary,
    membership_id: "additional",
    role: "teacher" as const,
    person_id: "staff-1",
  };
  const foreign = {
    ...additional,
    membership_id: "foreign",
    user_id: "other-user",
  };
  assert.equal(
    selectMembershipContext(
      [primary, additional, foreign],
      admin.id,
      "additional",
    )?.role,
    "teacher",
  );
  assert.equal(
    selectMembershipContext([primary, additional, foreign], admin.id, "foreign")
      ?.role,
    "admin",
  );
  assert.equal(
    selectMembershipContext(
      [{ ...additional, active: false }],
      admin.id,
      "additional",
    ),
    null,
  );
  assert.equal(mayAssignSchoolRole("principal", "admin"), false);
  assert.equal(mayAssignSchoolRole("teacher", "teacher"), false);
  assert.equal(mayAssignSchoolRole("admin", "platform"), false);
  assert.ok(
    mfaRequestSchema.safeParse({
      action: "verify",
      factorId: crypto.randomUUID(),
      code: "123456",
    }).success,
  );
  assert.equal(
    mfaRequestSchema.safeParse({
      action: "verify",
      factorId: crypto.randomUUID(),
      code: "12345x",
    }).success,
    false,
  );
  assert.equal(
    mfaRequestSchema.safeParse({
      action: "remove",
      factorId: "foreign",
      userId: admin.id,
    }).success,
    false,
  );
});
test("purchase receipt and refund transitions apply their connected effects once", () => {
  let y = createWorkspace().years[0];
  const po = y.extensions.find((r) => r.kind === "purchase-orders")!;
  y = {
    ...y,
    extensions: y.extensions.map((r) =>
      r.id === po.id ? { ...r, status: "approved" } : r,
    ),
  };
  const received = {
      ...y,
      extensions: y.extensions.map((r) =>
        r.id === po.id ? { ...r, status: "received" } : r,
      ),
    },
    posted = applyOperationalEffects(y, received, admin);
  assert.equal(
    posted.extensions.filter((r) => r.kind === "stock-movements").length,
    y.extensions.filter((r) => r.kind === "stock-movements").length + 1,
  );
  assert.ok(
    posted.workflows.ledger.some((j) => j.sourceKey === `purchase:${po.id}`),
  );
  assert.equal(
    applyOperationalEffects(posted, posted, admin).workflows.ledger.length,
    posted.workflows.ledger.length,
  );
  const invoice = y.records.invoices[0],
    payment = {
      id: "payment-verification",
      schoolId: admin.schoolId,
      academicYearId: y.setup.calendar.year.id,
      invoiceId: invoice.id,
      refundedMinor: 0,
      amountMinor: 1000,
      paidOn: "2026-10-18",
      method: "Cash" as const,
      reference: "PAY-TEST",
      idempotencyKey: "payment-verification",
      status: "completed" as const,
      note: "Recorded collection",
    };
  const refund = {
    ...po,
    id: "refund-verification",
    kind: "refunds",
    status: "approved",
    studentId: invoice.studentId,
    values: {
      paymentId: payment.id,
      amountMinor: 100,
      reason: "Duplicate payment correction",
    },
  };
  const approved = {
    ...y,
    records: { ...y.records, payments: [...y.records.payments, payment] },
    extensions: [...y.extensions, refund],
  };
  const completed = applyOperationalEffects(
    approved,
    {
      ...approved,
      extensions: approved.extensions.map((r) =>
        r.id === refund.id ? { ...r, status: "completed" } : r,
      ),
    },
    admin,
  );
  assert.equal(
    completed.records.payments.find((p) => p.id === refund.values.paymentId)!
      .refundedMinor,
    Number(refund.values.amountMinor),
  );
});
test("custom fields enforce declared types, required values, ownership and editing roles", () => {
  let y = createWorkspace().years[0];
  y = saveAdvancedSettings(y, admin, {
    ...y.workflows.advanced,
    customFields: [
      {
        key: "blood_group",
        label: "Blood group",
        entity: "student",
        type: "choice",
        required: true,
        options: ["A+", "O+"],
        readRoles: ["admin", "principal"],
      },
    ],
  });
  assert.throws(() =>
    saveCustomValues(y, admin, {
      entity: "student",
      ownerId: "student-1",
      values: {},
    }),
  );
  assert.throws(() =>
    saveCustomValues(y, admin, {
      entity: "student",
      ownerId: "student-1",
      values: { blood_group: "invalid" },
    }),
  );
  assert.throws(() =>
    saveCustomValues(y, admin, {
      entity: "student",
      ownerId: "foreign",
      values: { blood_group: "A+" },
    }),
  );
  y = saveCustomValues(y, admin, {
    entity: "student",
    ownerId: "student-1",
    values: { blood_group: "O+" },
  });
  assert.equal(
    projectWorkflowState(y, actor("teacher")).customValues.find(
      (v) => v.ownerId === "student-1",
    )?.values.blood_group,
    undefined,
  );
  assert.throws(() =>
    saveCustomValues(y, actor("parent"), {
      entity: "student",
      ownerId: "student-1",
      values: { blood_group: "A+" },
    }),
  );
});
test("approval chains require the current reviewer and prohibit requester self-approval", () => {
  let y = createWorkspace().years[0];
  y = saveAdvancedSettings(y, admin, {
    ...y.workflows.advanced,
    approvalPolicies: [
      {
        id: "purchase-policy",
        name: "Purchase approval",
        kind: "purchase-orders",
        roles: ["principal", "admin"],
        slaHours: 24,
        enabled: true,
      },
    ],
  });
  y = requestWorkflowApproval(y, actor("inventory"), "purchase-orders", "po-1");
  const id = y.workflows.approvals[0].id;
  assert.throws(() =>
    decideWorkflowApproval(y, admin, {
      id,
      decision: "approved",
      note: "School approved request",
    }),
  );
  y = decideWorkflowApproval(y, actor("principal"), {
    id,
    decision: "approved",
    note: "Principal approved purchase",
  });
  assert.equal(y.workflows.approvals[0].status, "pending");
  y = decideWorkflowApproval(y, admin, {
    id,
    decision: "approved",
    note: "Administrator verified funds",
  });
  assert.equal(y.workflows.approvals[0].status, "approved");
});
test("payroll requires an approved policy, independent review, immutable finalisation and scoped payslips", () => {
  let y = createWorkspace().years[0];
  const dispatch = (action: string, input: unknown) => {
    y = applyWorkflowCommand(y, admin, { action, input });
  };
  dispatch("salary-plan", {
    staffId: "staff-2",
    basicMinor: 2000000,
    grossMinor: 3000000,
    effectiveFrom: y.setup.calendar.year.startDate,
  });
  assert.throws(() => dispatch("payroll-prepare", { period: "2026-09" }));
  dispatch("payroll-policy", {
    ...y.workflows.payrollPolicy,
    approvedBySchool: true,
    rules: [
      {
        id: "provident",
        label: "School approved contribution",
        basis: "basic",
        amountMinor: 0,
        rateBps: 1200,
        employerOnly: false,
      },
    ],
  });
  dispatch("payroll-prepare", { period: "2026-09" });
  const run = y.workflows.payrollRuns[0];
  assert.equal(run.lines[0].netMinor, 2760000);
  assert.throws(() => dispatch("payroll-progress", { id: run.id }));
  y = applyWorkflowCommand(y, actor("hr"), {
    action: "payroll-progress",
    input: { id: run.id },
  });
  dispatch("payroll-progress", { id: run.id });
  assert.equal(y.workflows.payrollRuns[0].status, "finalised");
  assert.equal(y.workflows.ledger.length, 1);
  assert.equal(y.workflows.publications.length, 1);
  assert.equal(projectWorkflowState(y, actor("parent")).payrollRuns.length, 0);
  assert.equal(
    projectWorkflowState(y, actor("staff")).payrollRuns[0].lines.length,
    1,
  );
  const tampered = structuredClone(y);
  tampered.workflows.payrollRuns[0].lines[0].netMinor = 1;
  assert.throws(() => assertYearIntegrity(y, tampered));
  assert.throws(() =>
    dispatch("salary-plan", {
      staffId: "staff-2",
      basicMinor: 100,
      grossMinor: 100,
      effectiveFrom: "2026-09-01",
    }),
  );
});
test("journals balance, posted history cannot be changed and retries do not double-post", () => {
  const y = createWorkspace().years[0],
    entry = {
      sourceKey: "verified-entry",
      date: "2026-10-18",
      memo: "Verified bank collection",
      reversesId: null,
      lines: [
        { account: "Bank" as const, debitMinor: 100, creditMinor: 0 },
        { account: "Fee receivable" as const, debitMinor: 0, creditMinor: 100 },
      ],
    };
  const posted = postJournal(y, admin, entry);
  assert.equal(postJournal(posted, admin, entry).workflows.ledger.length, 1);
  assert.throws(() =>
    postJournal(y, admin, {
      ...entry,
      lines: [{ ...entry.lines[0], debitMinor: 99 }, entry.lines[1]],
    }),
  );
  assert.throws(() =>
    assertYearIntegrity(posted, {
      ...posted,
      workflows: { ...posted.workflows, ledger: [] },
    }),
  );
});
test("reports reject arbitrary fields, export immutable Unicode snapshots and deny unrelated accounts", async () => {
  let y = createWorkspace().years[0];
  y = applyWorkflowCommand(y, admin, {
    action: "report-builder",
    input: {
      id: "report-1",
      name: "Student register",
      source: "students",
      columns: ["displayName", "admissionNumber"],
      filters: [],
    },
  });
  assert.throws(() =>
    applyWorkflowCommand(y, admin, {
      action: "report-builder",
      input: {
        id: "report-2",
        name: "Unsafe report",
        source: "students",
        columns: ["password"],
        filters: [],
      },
    }),
  );
  y = applyWorkflowCommand(y, admin, {
    action: "report-publish",
    input: { id: "report-1" },
  });
  const pub = y.workflows.publications[0];
  assert.ok(canReadPublication(y, admin, pub));
  assert.equal(canReadPublication(y, actor("parent"), pub), false);
  const sample = {
    ...pub,
    title: "विद्यार्थी रिपोर्ट",
    snapshot: {
      school: "Greenfield School",
      student: "आरव",
      rows: [{ name: "=1+1", marks: 95 }],
      columns: ["name", "marks"],
    },
  };
  const bytes = await renderPublication(sample, "pdf"),
    pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 0);
  assert.equal(pdf.getTitle(), sample.title);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(await renderPublication(sample, "xlsx")) as never,
  );
  assert.equal(
    workbook.worksheets[0].getCell("A4").type,
    ExcelJS.ValueType.String,
  );
  assert.equal(workbook.worksheets[0].getCell("A4").value, "=1+1");
  const changed = structuredClone(y);
  changed.workflows.publications[0].title = "Changed title";
  assert.throws(() => assertYearIntegrity(y, changed));
});
test("workflow commands reject cross-school actors, archived edits and invalid student movement", () => {
  const y = createWorkspace().years[0],
    command = {
      action: "student-lifecycle",
      input: {
        studentId: "student-1",
        kind: "transferred",
        classSectionId: null,
        date: "2026-10-18",
        note: "Family relocation approved",
      },
    };
  assert.throws(() =>
    applyWorkflowCommand(y, { ...admin, schoolId: "foreign" }, command),
  );
  assert.throws(() =>
    applyWorkflowCommand({ ...y, locked: true }, admin, command),
  );
  assert.throws(() => applyWorkflowCommand(y, actor("parent"), command));
  assert.throws(()=>applyWorkflowCommand(y,admin,command),/Return loans/);
  // Complete this test student's operational clearance before confirming transfer.
  y.extensions=y.extensions.filter(row=>row.studentId!=="student-1");
  const next = applyWorkflowCommand(y, admin, command);
  assert.equal(next.workflows.studentEvents[0].kind, "transferred");
  assert.equal(
    next.records.studentProfiles.find((p) => p.studentId === "student-1")
      ?.status,
    "transferred",
  );
});
