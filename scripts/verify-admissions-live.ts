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
const config = getSupabaseConfig(),
  secret = process.env.SUPABASE_SERVER_SECRET_KEY,
  base = "http://127.0.0.1:3000";
if (
  !secret ||
  process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true" ||
  config.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co"
)
  throw new Error("Expected synthetic school project.");
const bounded: typeof fetch = (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(60000) }),
  sdk = createClient(config.url, secret, {
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
  if (!value) throw new Error(label);
}
async function read() {
  const { data, error } = await sdk.rpc("mis_read_workspace", {
    p_school_id: "school-greenfield",
  });
  if (error) throw new Error("Workspace unavailable.");
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
    const cookies = new Map<string, string>(),
      client: SupabaseClient = createServerClient(
        config.url,
        config.publishableKey,
        {
          global: { fetch: bounded },
          cookies: {
            getAll: () =>
              [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (values) => {
              for (const v of values)
                v.value ? cookies.set(v.name, v.value) : cookies.delete(v.name);
            },
          },
        },
      );
    const { data, error } = await client.auth.signInWithPassword({
      email: `${role}@greenfield.test`,
      password: TEST_ACCOUNT_PASSWORD,
    });
    check(`${role} existing sign-in`, !error && data.user);
    const { data: membership, error: membershipError } = await client
      .from("mis_memberships")
      .select("person_id,role")
      .single();
    check(
      `${role} original membership`,
      !membershipError && membership.role === role,
    );
    sessions.set(role, {
      client,
      cookies,
      id: data.user.id,
      personId: membership.person_id,
    });
  }
  const original = await read(),
    year = original.years.find(
      (y) => y.setup.calendar.year.id === original.activeYearId,
    )!,
    admin = sessions.get("admin")!,
    template = year.records.inquiries[0],
    id = crypto.randomUUID();
  const application = {
    ...template,
    id,
    studentName: "Verified admissions applicant",
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
  check(
    "Teacher cannot manage admissions",
    (await command("teacher", { type: "admission-save", input: application }))
      .status === 403,
  );
  check(
    "Parent cannot manage admissions",
    (await command("parent", { type: "admission-save", input: application }))
      .status === 403,
  );
  check(
    "Administrator creates an inquiry",
    (await command("admin", { type: "admission-save", input: application }))
      .status === 200,
  );
  check(
    "Details cannot forge an offer",
    (
      await command("admin", {
        type: "admission-save",
        input: { ...application, stage: "offered" },
      })
    ).status === 403,
  );
  for (const stage of ["contacted", "application", "assessment"])
    check(
      `Application progresses to ${stage}`,
      (
        await command("admin", {
          type: "admission-progress",
          input: { id, stage },
        })
      ).status === 200,
    );
  check(
    "Offer requires assessment score",
    (
      await command("admin", {
        type: "admission-progress",
        input: { id, stage: "offered" },
      })
    ).status === 403,
  );
  check(
    "Administrator records assessment and offer expiry",
    (
      await command("admin", {
        type: "admission-save",
        input: {
          ...application,
          stage: "assessment",
          score: 85,
          offerExpiry: year.setup.calendar.year.endDate,
        },
      })
    ).status === 200,
  );
  check(
    "Assessed applicant receives an offer",
    (
      await command("admin", {
        type: "admission-progress",
        input: { id, stage: "offered" },
      })
    ).status === 200,
  );
  const profile = year.records.studentProfiles[0],
    request = {
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
  check(
    "Parent cannot enroll applicants",
    (await command("parent", { type: "student-enrol", input: request }))
      .status === 403,
  );
  if (year.records.admissionForms[0]?.requireDocuments)
    check(
      "Document checklist cannot replace a private uploaded file",
      (await command("admin", { type: "student-enrol", input: request }))
        .status === 403,
    );
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Synthetic admission file for workflow verification");
  const bytes = await pdf.save({ useObjectStreams: false });
  async function upload(role: string) {
    const form = new FormData();
    form.set("yearId", year.setup.calendar.year.id);
    form.set("ownerType", "admission");
    form.set("ownerId", id);
    form.set("category", "identity");
    form.set(
      "file",
      new File([Uint8Array.from(bytes).buffer], "admission-verification.pdf", {
        type: "application/pdf",
      }),
    );
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
  check(
    "Teacher cannot upload another applicant's private file",
    (await upload("teacher")).status === 403,
  );
  check(
    "Parent cannot upload an unrelated application file",
    (await upload("parent")).status === 403,
  );
  const uploaded = await upload("admin");
  check(
    "Administrator uploads a private application file",
    uploaded.status === 201,
  );
  const document = (await uploaded.json()).file;
  check(
    "Application upload is ready and hides its storage path",
    document.owner_type === "admission" &&
      document.owner_id === id &&
      document.status === "ready" &&
      !document.object_path,
  );
  async function fileRead(role: string) {
    return bounded(base + `/api/documents/${document.id}`, {
      headers: {
        Cookie: [...sessions.get(role)!.cookies]
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
    });
  }
  check(
    "Administrator downloads the private application PDF",
    (await fileRead("admin")).status === 200,
  );
  check(
    "Unrelated parent cannot download application bytes",
    (await fileRead("parent")).status === 403,
  );
  const response = await command("admin", {
    type: "student-enrol",
    input: request,
  });
  check("Administrator enrolls accepted applicant", response.status === 200);
  const projected = (await response.json()).data,
    { data: revocations } = await sdk
      .from("mis_publication_revocations")
      .select("publication_id")
      .eq("school_id", year.setup.school.id);
  check(
    "Issued revoked contents are absent from admin page projection",
    projected.years.every(
      (y: { workflows: { publications: { id: string }[] } }) =>
        y.workflows.publications.every(
          (p) => !revocations!.some((r) => r.publication_id === p.id),
        ),
    ),
  );
  const final = await read(),
    saved = final.years.find(
      (y) => y.setup.calendar.year.id === year.setup.calendar.year.id,
    )!,
    enrolled = saved.records.inquiries.find((row) => row.id === id)!;
  check(
    "Application links to a persistent student",
    enrolled.stage === "enrolled" &&
      saved.setup.students.some((student) => student.id === enrolled.studentId),
  );
  check(
    "Guardian relationship and student profile persist",
    saved.setup.relationships.some(
      (link) => link.studentId === enrolled.studentId,
    ) &&
      saved.records.studentProfiles.some(
        (profile) => profile.studentId === enrolled.studentId,
      ),
  );
  check(
    "Admission invoice is dated and linked",
    saved.records.invoices.some(
      (invoice) =>
        invoice.studentId === enrolled.studentId &&
        invoice.dueDate >= invoice.issuedOn,
    ),
  );
  check(
    "Enrollment timeline is saved",
    saved.workflows.studentEvents.some(
      (event) =>
        event.studentId === enrolled.studentId && event.kind === "enrolled",
    ),
  );
  check(
    "Enrollment retry cannot create another student",
    (await command("admin", { type: "student-enrol", input: request }))
      .status === 403,
  );
  check(
    "Existing students retain their IDs",
    year.setup.students.every((student) =>
      saved.setup.students.some((row) => row.id === student.id),
    ),
  );
  check(
    "Existing staff retain their IDs",
    JSON.stringify(saved.setup.staff.map((row) => row.id)) ===
      JSON.stringify(year.setup.staff.map((row) => row.id)),
  );
} finally {
  for (const session of sessions.values())
    await session.client.auth.signOut({ scope: "local" });
  await writeFile(
    "docs/admissions-live-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        passed: checks.filter((c) => c.passed).length,
        total: checks.length,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: checks.filter((c) => c.passed).length,
      total: checks.length,
    }),
  );
}
