import { PDFDocument } from "pdf-lib";
/** Uses existing synthetic users and new admission records; never changes credentials or roles. */
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { writeFile } from "node:fs/promises";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { TEST_ACCOUNT_PASSWORD } from "../src/features/identity/data/test-accounts.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
nextEnv.loadEnvConfig(process.cwd());
const config = getSupabaseConfig(), secret = process.env.SUPABASE_SERVER_SECRET_KEY, base = "http://127.0.0.1:3000";
if (!secret ||
  process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true" ||
  config.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co")
  throw new Error("Expected synthetic school project.");
const bounded: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(60000) }), sdk = createClient(config.url, secret, {
  global: { fetch: bounded },
  auth: { persistSession: false, autoRefreshToken: false },
}), sessions = new Map<string, {
  client: SupabaseClient;
  cookies: Map<string, string>;
  id: string;
  personId: string | null;
}>(), checks: {
  case: string;
  passed: boolean;
}[] = [];
function check(label: string, value: unknown): asserts value {
  checks.push({ case: label, passed: Boolean(value) });
  if (!value)
    throw new Error(label);
}
async function read() {
  const { data, error } = await sdk.rpc("mis_read_workspace", {
    p_school_id: "school-greenfield",
  });
  if (error)
    throw new Error("Workspace unavailable.");
  return workspaceSchema.parse(data);
}
async function command(role: string, input: unknown) {
  const root = await read();
  return bounded(base + "/api/workflows", {
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
      command: input,
    }),
  });
}
try {
  for (const role of ["admin", "teacher", "parent"]) {
    const cookies = new Map<string, string>(), client: SupabaseClient = createServerClient(config.url, config.publishableKey, {
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
    check(`${role} existing sign-in`, !error && data.user);
    const { data: membership, error: membershipError } = await client
      .from("mis_memberships")
      .select("person_id,role")
      .single();
    check(`${role} original membership`, !membershipError && membership.role === role);
    sessions.set(role, {
      client,
      cookies,
      id: data.user.id,
      personId: membership.person_id,
    });
  }
  const original = await read(), year = original.years.find((y) => y.setup.calendar.year.id === original.activeYearId)!, admin = sessions.get("admin")!, template = year.records.inquiries[0], id = crypto.randomUUID();
  const fixture = structuredClone(original), fixtureYear = fixture.years.find(y => y.setup.calendar.year.id === fixture.activeYearId)!;
  const qaClassId = crypto.randomUUID(), qaSubjectId = crypto.randomUUID(), qaSlotId = crypto.randomUUID(), qaExamId = crypto.randomUUID();
  const teacherPerson = sessions.get("teacher")!.personId!;
  const qaScope = { schoolId: year.setup.school.id, academicYearId: year.setup.calendar.year.id };
  fixtureYear.setup.classes.push({ ...qaScope, id: qaClassId, grade: "QA Lifecycle", section: id.slice(0, 8), capacity: 1 });
  fixtureYear.records.subjects.push({ ...qaScope, id: qaSubjectId, name: `QA Lifecycle ${id.slice(0, 8)}`, code: `QA${id.slice(0, 8)}`, maxMarks: 100 });
  fixtureYear.setup.allocations.push({ id: crypto.randomUUID(), staffId: teacherPerson, classSectionId: qaClassId, subject: `QA Lifecycle ${id.slice(0, 8)}` });
  fixture.revision++;
  const validFixture = workspaceSchema.parse(fixture);
  const { error: fixtureError } = await sdk.rpc("mis_commit_workspace", { p_school_id: year.setup.school.id, p_expected_revision: original.revision, p_document: validFixture, p_actor_id: admin.id, p_action: "QA: append isolated lifecycle class and subject" });
  check("Isolated synthetic class/subject fixture saved without replacing school records", !fixtureError);
  const application = {
    ...template,
    id,
    studentName: "QA completion lifecycle applicant",
    classSectionId: qaClassId,
    guardianName: "Verification guardian",
    email: "admissions-verification@example.test",
    phone: "+919876543210",
    stage: "new",
    studentId: null,
    score: null,
    offerExpiry: null,
    lostReason: "",
    documents: [],
  };
  check("Teacher cannot manage admissions", (await command("teacher", { type: "admission-save", input: application }))
    .status === 403);
  check("Parent cannot manage admissions", (await command("parent", { type: "admission-save", input: application }))
    .status === 403);
  check("Administrator creates an inquiry", (await command("admin", { type: "admission-save", input: application }))
    .status === 200);
  check("Details cannot forge an offer", (await command("admin", {
    type: "admission-save",
    input: { ...application, stage: "offered" },
  })).status === 403);
  for (const stage of ["contacted", "application", "assessment"])
    check(`Application progresses to ${stage}`, (await command("admin", {
      type: "admission-progress",
      input: { id, stage },
    })).status === 200);
  check("Offer requires assessment score", (await command("admin", {
    type: "admission-progress",
    input: { id, stage: "offered" },
  })).status === 403);
  check("Administrator records assessment and offer expiry", (await command("admin", {
    type: "admission-save",
    input: {
      ...application,
      stage: "assessment",
      score: 85,
      offerExpiry: year.setup.calendar.year.endDate,
    },
  })).status === 200);
  check("Assessed applicant receives an offer", (await command("admin", {
    type: "admission-progress",
    input: { id, stage: "offered" },
  })).status === 200);
  const profile = year.records.studentProfiles[0], request = {
    studentName: application.studentName,
    admissionNumber: `QA-${crypto.randomUUID()}`,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    classSectionId: application.classSectionId,
    address: "Synthetic school verification address",
    guardianName: application.guardianName,
    email: application.email,
    phone: application.phone,
    existingGuardianId: null,
    emergencyName: application.guardianName,
    emergencyPhone: application.phone,
    routeId: null,
    documents: [],
    generateInvoice: true,
    inquiryId: id,
  };
  check("Parent cannot enroll applicants", (await command("parent", { type: "student-enrol", input: request }))
    .status === 403);
  if (year.records.admissionForms[0]?.requireDocuments)
    check("Document checklist cannot replace a private uploaded file", (await command("admin", { type: "student-enrol", input: request }))
      .status === 403);
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Synthetic admission file for workflow verification");
  const bytes = await pdf.save({ useObjectStreams: false });
  async function upload(role: string) {
    const form = new FormData();
    form.set("yearId", year.setup.calendar.year.id);
    form.set("ownerType", "admission");
    form.set("ownerId", id);
    form.set("category", "identity");
    form.set("file", new File([Uint8Array.from(bytes).buffer], "admission-verification.pdf", {
      type: "application/pdf",
    }));
    return bounded(base + "/api/documents", {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: [...sessions.get(role)!.cookies]
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
      body: form,
    });
  }
  check("Teacher cannot upload another applicant's private file", (await upload("teacher")).status === 403);
  check("Parent cannot upload an unrelated application file", (await upload("parent")).status === 403);
  const uploaded = await upload("admin");
  check("Administrator uploads a private application file", uploaded.status === 201);
  const document = (await uploaded.json()).file;
  check("Application upload is ready and hides its storage path", document.owner_type === "admission" &&
    document.owner_id === id &&
    document.status === "ready" &&
    !document.object_path);
  async function fileRead(role: string) {
    return bounded(base + `/api/documents/${document.id}`, {
      headers: {
        Cookie: [...sessions.get(role)!.cookies]
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
    });
  }
  check("Administrator downloads the private application PDF", (await fileRead("admin")).status === 200);
  check("Unrelated parent cannot download application bytes", (await fileRead("parent")).status === 403);
  const response = await command("admin", {
    type: "student-enrol",
    input: request,
  });
  check("Administrator enrolls accepted applicant", response.status === 200);
  const projected = (await response.json()).data, { data: revocations } = await sdk
    .from("mis_publication_revocations")
    .select("publication_id")
    .eq("school_id", year.setup.school.id);
  check("Issued revoked contents are absent from admin page projection", projected.years.every((y: {
    workflows: {
      publications: {
        id: string;
      }[];
    };
  }) => y.workflows.publications.every((p) => !revocations!.some((r) => r.publication_id === p.id))));
  const final = await read(), saved = final.years.find((y) => y.setup.calendar.year.id === year.setup.calendar.year.id)!, enrolled = saved.records.inquiries.find((row) => row.id === id)!;
  check("Application links to a persistent student", enrolled.stage === "enrolled" &&
    saved.setup.students.some((student) => student.id === enrolled.studentId));
  check("Guardian relationship and student profile persist", saved.setup.relationships.some((link) => link.studentId === enrolled.studentId) &&
    saved.records.studentProfiles.some((profile) => profile.studentId === enrolled.studentId));
  check("Admission invoice is dated and linked", saved.records.invoices.some((invoice) => invoice.studentId === enrolled.studentId &&
    invoice.dueDate >= invoice.issuedOn));
  check("Enrollment timeline is saved", saved.workflows.studentEvents.some((event) => event.studentId === enrolled.studentId && event.kind === "enrolled"));
  check("Enrollment retry cannot create another student", (await command("admin", { type: "student-enrol", input: request }))
    .status === 403);
  async function workflow(role: string, action: string, input: unknown) { return command(role, { type: "workflow", input: { action, input } }); }
  const studentId = enrolled.studentId!;
  const continuation = { studentId, decision: "retain", targetClassId: qaClassId, note: "QA guardian confirmed next-year continuation" };
  check("Parent cannot confirm continuation", (await workflow("parent", "admission-continuation", continuation)).status === 403);
  check("Admin confirms continuation and rollover directive", (await workflow("admin", "admission-continuation", continuation)).status === 200);
  check("Continuation retry is rejected", (await workflow("admin", "admission-continuation", continuation)).status === 403);
  let latest = await read(), liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  check("Continuation persists without current-year class change", liveYear.records.promotions.some(p => p.studentId === studentId && p.decision === "retain") && liveYear.setup.students.find(s => s.id === studentId)?.classSectionId === qaClassId);
  const fixture2 = structuredClone(latest), y2 = fixture2.years.find(y => y.setup.calendar.year.id === fixture2.activeYearId)!;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  y2.records.exams.push({ ...qaScope, id: qaExamId, name: `QA lifecycle exam ${id.slice(0, 8)}`, dates: { startDate: day, endDate: day }, classSectionIds: [qaClassId], subjectIds: [qaSubjectId], maxMarks: 100, passMarks: 33, status: "published" });
  y2.records.marks.push({ ...qaScope, id: crypto.randomUUID(), examId: qaExamId, subjectId: qaSubjectId, studentId, marks: 70, remark: "QA original mark" });
  const periods = y2.setup.bells.filter(b => b.kind === "period");
  const candidates = y2.setup.staff.filter(s => s.id !== teacherPerson);
  let chosen: {
    weekday: string;
    periodId: string;
    room: string;
    sub: string;
  } | null = null;
  for (const weekday of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    for (const period of periods)
      for (const room of y2.records.rooms) {
        const busy = y2.records.slots.filter(s => s.weekday === weekday && s.periodId === period.id);
        const sub = candidates.find(s => !busy.some(t => t.staffId === s.id));
        if (!chosen && sub && !busy.some(t => t.staffId === teacherPerson || t.room === room.name))
          chosen = { weekday, periodId: period.id, room: room.name, sub: sub.id };
      }
  check("A free synthetic timetable period is available", chosen);
  y2.records.slots.push({ ...qaScope, id: qaSlotId, classSectionId: qaClassId, staffId: teacherPerson, subjectId: qaSubjectId, weekday: chosen.weekday as "Monday", periodId: chosen.periodId, room: chosen.room, status: "draft" });
  const moderationSourceId = crypto.randomUUID();
  y2.extensions.push({ ...qaScope, id: moderationSourceId, kind: "re-evaluations", title: "QA pre-publication marking review", date: day, studentId, staffId: null, status: "submitted", values: { examId: qaExamId, subjectId: qaSubjectId, reason: "QA independent second marking requested", decision: "Pending review" }, createdBy: sessions.get("teacher")!.id, history: [] });
  fixture2.revision++;
  const { error: academicFixtureError } = await sdk.rpc("mis_commit_workspace", { p_school_id: year.setup.school.id, p_expected_revision: latest.revision, p_document: workspaceSchema.parse(fixture2), p_actor_id: admin.id, p_action: "QA: append isolated assessment/mark and draft slot" });
  check("Synthetic assessment and draft slot saved", !academicFixtureError);
  const bands = [{ label: "Pass", minimum: 33 }, { label: "Fail", minimum: 0 }];
  check("Teacher cannot issue report cards", (await workflow("teacher", "results-publish", { examId: qaExamId, gradeBands: bands })).status === 403);
  check("Allocated teacher submits pre-publication moderation", (await workflow("teacher", "result-moderation-request", { examId: qaExamId, studentId, subjectId: qaSubjectId, proposedMarks: 75, reason: "QA moderated original assessment mark", sourceOperationId: moderationSourceId })).status === 200);
  check("Pending moderation blocks result issue", (await workflow("admin", "results-publish", { examId: qaExamId, gradeBands: bands })).status === 403);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  const moderation = liveYear.workflows.resultReviews.find(r => r.examId === qaExamId && r.publicationId === null)!;
  check("Independent admin decides mark moderation", (await workflow("admin", "result-review-decide", { id: moderation.id, decision: "approved", note: "QA independent moderator confirms 75 marks" })).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  check("Linked re-evaluation request completes with recorded decision", liveYear.extensions.find(r => r.id === moderationSourceId)?.status === "completed" && liveYear.extensions.find(r => r.id === moderationSourceId)?.values.decision === "QA independent moderator confirms 75 marks");
  check("Admin publishes and locks synthetic results", (await workflow("admin", "results-publish", { examId: qaExamId, gradeBands: bands })).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  const report = liveYear.workflows.publications.find(p => p.sourceId === qaExamId && p.kind === "report-card")!;
  check("A first immutable report exists", report?.version === 1);
  check("Admin issues a weighted synthetic transcript", (await workflow("admin", "transcript-publish", { studentId, title: "QA lifecycle transcript", weights: [{ examId: qaExamId, weightBps: 10000 }] })).status === 200);
  const reviewRequest = { publicationId: report.id, subjectId: qaSubjectId, proposedMarks: 82, reason: "QA second marker verified revised mark" };
  check("Unrelated parent cannot propose corrections", (await workflow("parent", "result-review-request", reviewRequest)).status === 403);
  check("Allocated teacher submits a result correction", (await workflow("teacher", "result-review-request", reviewRequest)).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  const review = liveYear.workflows.resultReviews.find(r => r.publicationId === report.id)!;
  check("Teacher cannot decide their result request", (await workflow("teacher", "result-review-decide", { id: review.id, decision: "approved", note: "QA self approval attempt" })).status === 403);
  const correction = await workflow("admin", "result-review-decide", { id: review.id, decision: "approved", note: "QA independent review confirmed corrected mark" });
  check("Independent admin approves and versions the result", correction.status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  check("Original result bytes remain unchanged but revoked", JSON.stringify(liveYear.workflows.publications.find(p => p.id === report.id)?.snapshot) === JSON.stringify(report.snapshot) && Boolean(liveYear.workflows.publications.find(p => p.id === report.id)?.revokedAt));
  const corrected = liveYear.workflows.publications.find(p => p.kind === "report-card" && p.sourceId === qaExamId && p.version === 2)!;
  check("Corrected result and raw mark persist", corrected?.snapshot.percent === 82 && liveYear.records.marks.some(m => m.examId === qaExamId && m.studentId === studentId && m.marks === 82));
  check("Dependent transcript is revoked", liveYear.workflows.publications.some(p => p.kind === "transcript" && p.ownerId === studentId && p.revokedAt));
  async function downloadPublication(pubId: string) { return bounded(`${base}/api/publications/${pubId}?year=${year.setup.calendar.year.id}&format=pdf`, { headers: { Cookie: [...sessions.get("admin")!.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } }); }
  check("Old report download is denied", (await downloadPublication(report.id)).status === 403);
  check("Corrected report PDF downloads", (await downloadPublication(corrected.id)).status === 200);
  const { error: revokeError } = await sdk.rpc("mis_revoke_publication", { p_actor: admin.id, p_school: year.setup.school.id, p_year: year.setup.calendar.year.id, p_publication: report.id, p_reason: "QA obsolete synthetic result source revoked" });
  check("Detached revocation registered for obsolete synthetic source", !revokeError);
  const forged = structuredClone(await read()), forgedYear = forged.years.find(y => y.setup.calendar.year.id === forged.activeYearId)!;
  forgedYear.workflows.resultReviews.push({ ...review, id: crypto.randomUUID(), status: "submitted", decidedAt: null, decidedBy: null, decisionNote: "", correctedPublicationId: null });
  forged.revision++;
  const { error: revocationGuardError } = await sdk.rpc("mis_commit_workspace", { p_school_id: year.setup.school.id, p_expected_revision: forged.revision - 1, p_document: workspaceSchema.parse(forged), p_actor_id: admin.id, p_action: "QA: expect revoked review source rejection" });
  check("Atomic database guard rejects a review against a detached revoked source", revocationGuardError?.code === "PT403");
  check("Review retry is rejected", (await workflow("admin", "result-review-decide", { id: review.id, decision: "approved", note: "QA duplicate correction attempt" })).status === 403);
  check("Admin publishes only the synthetic class timetable", (await workflow("admin", "timetable-publish", { classSectionId: qaClassId })).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  check("Timetable snapshot persists with teacher names", liveYear.workflows.timetableVersions.at(-1)?.slots.some(s => s.id === qaSlotId && s.teacherName));
  const actualDate = new Date(year.setup.calendar.year.startDate + "T00:00:00Z");
  while (actualDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) !== chosen.weekday)
    actualDate.setUTCDate(actualDate.getUTCDate() + 1);
  const substitution = { slotId: qaSlotId, date: actualDate.toISOString().slice(0, 10), substituteStaffId: chosen.sub, reason: "QA teacher training cover request" };
  check("Teacher submits own substitution request", (await workflow("teacher", "substitution-request", substitution)).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  const cover = liveYear.workflows.substitutionReviews.find(r => r.substitution.slotId === qaSlotId)!;
  check("Unapproved substitution cannot be published", (await workflow("admin", "substitution-decide", { id: cover.id, decision: "published", note: "QA premature publication attempt" })).status === 403);
  check("Independent admin approves substitution", (await workflow("admin", "substitution-decide", { id: cover.id, decision: "approved", note: "QA substitute availability independently checked" })).status === 200);
  check("Admin explicitly publishes approved substitution", (await workflow("admin", "substitution-decide", { id: cover.id, decision: "published", note: "QA approved teaching cover published" })).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  check("Published cover persists", liveYear.records.substitutions.some(s => s.id === cover.substitution.id && s.status === "published"));
  check("Cancellation retains a decision record", (await workflow("admin", "substitution-decide", { id: cover.id, decision: "cancelled", note: "QA teacher returned; teaching cover cancelled" })).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  check("Cancelled cover removed from schedule with immutable audit", !liveYear.records.substitutions.some(s => s.id === cover.substitution.id) && liveYear.workflows.substitutionReviews.find(r => r.id === cover.id)?.decisions.length === 3);
  check("Withdrawal cannot be performed by parent", (await workflow("parent", "admission-withdrawal", { studentId, date: day, note: "QA completed synthetic exit", feeTreatment: "void-uncollected" })).status === 403);
  check("Admin completes synthetic withdrawal and fee treatment", (await workflow("admin", "admission-withdrawal", { studentId, date: day, note: "QA completed synthetic exit", feeTreatment: "void-uncollected" })).status === 200);
  latest = await read();
  liveYear = latest.years.find(y => y.setup.calendar.year.id === latest.activeYearId)!;
  check("Withdrawal timeline and voided invoice persist", liveYear.workflows.studentEvents.some(e => e.studentId === studentId && e.kind === "withdrawn") && liveYear.records.invoices.filter(i => i.studentId === studentId).every(i => i.status === "void"));
  check("Synthetic withdrawal posts a balanced reversal journal", liveYear.workflows.ledger.some(j => j.sourceKey.startsWith("void:") && j.lines.reduce((s, l) => s + l.debitMinor - l.creditMinor, 0) === 0));
  const vacancyId=crypto.randomUUID(),vacancy={...application,id:vacancyId,studentName:"QA vacancy applicant",stage:"new",studentId:null,score:null,offerExpiry:null};
  check("Vacancy application is created",(await command("admin",{type:"admission-save",input:vacancy})).status===200);
  for(const stage of ["contacted","application","assessment"])check(`Vacancy application advances to ${stage}`,(await command("admin",{type:"admission-progress",input:{id:vacancyId,stage}})).status===200);
  check("Vacancy assessment is recorded",(await command("admin",{type:"admission-save",input:{...vacancy,stage:"assessment",score:80,offerExpiry:year.setup.calendar.year.endDate}})).status===200);
  check("Vacancy offer is approved",(await command("admin",{type:"admission-progress",input:{id:vacancyId,stage:"offered"}})).status===200);
  const vacancyForm=new FormData();vacancyForm.set("yearId",year.setup.calendar.year.id);vacancyForm.set("ownerType","admission");vacancyForm.set("ownerId",vacancyId);vacancyForm.set("category","identity");vacancyForm.set("file",new File([Uint8Array.from(bytes).buffer],"vacancy-verification.pdf",{type:"application/pdf"}));
  check("Vacancy private identity file is uploaded",(await bounded(base+"/api/documents",{method:"POST",headers:{Origin:base,Cookie:[...sessions.get("admin")!.cookies].map(([k,v])=>`${k}=${v}`).join("; ")},body:vacancyForm})).status===201);
  check("Vacated seat admits a new student while retaining historical enrolment",(await command("admin",{type:"student-enrol",input:{...request,studentName:vacancy.studentName,admissionNumber:`QA-VAC-${crypto.randomUUID()}`,inquiryId:vacancyId}})).status===200);
  latest=await read();liveYear=latest.years.find(y=>y.setup.calendar.year.id===latest.activeYearId)!;
  const vacancyStudentId=liveYear.records.inquiries.find(i=>i.id===vacancyId)!.studentId!;
  check("Class capacity counts active students without deleting history",liveYear.setup.classes.find(c=>c.id===qaClassId)?.capacity===1&&liveYear.setup.students.filter(s=>s.classSectionId===qaClassId).length===2&&liveYear.records.studentProfiles.filter(p=>liveYear.setup.students.some(s=>s.id===p.studentId&&s.classSectionId===qaClassId)&&p.status==="active").length===1);
  check("Operational admissions preserve existing setup sign-offs",JSON.stringify(liveYear.setup.completed)===JSON.stringify(year.setup.completed));
  check("Vacancy test enrolment closes without leaving an active synthetic student",(await workflow("admin","admission-withdrawal",{studentId:vacancyStudentId,date:day,note:"QA vacancy verification complete; cleared exit",feeTreatment:"void-uncollected"})).status===200);
  check("Existing students retain their IDs", year.setup.students.every((student) => saved.setup.students.some((row) => row.id === student.id)));
  check("Existing staff retain their IDs", JSON.stringify(saved.setup.staff.map((row) => row.id)) ===
    JSON.stringify(year.setup.staff.map((row) => row.id)));
}
finally {
  for (const session of sessions.values())
    await session.client.auth.signOut({ scope: "local" });
  await writeFile("docs/completion-lifecycles-live-verification.json", JSON.stringify({
    checkedAt: new Date().toISOString(),
    passed: checks.filter((c) => c.passed).length,
    total: checks.length,
    checks,
  }, null, 2));
  console.log(JSON.stringify({
    passed: checks.filter((c) => c.passed).length,
    total: checks.length,
  }));
}
