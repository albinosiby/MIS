/** Opt-in isolated live acceptance. Never signs in as or edits the existing school accounts. */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import { PDFDocument } from "pdf-lib";
nextEnv.loadEnvConfig(process.cwd());
const c = getSupabaseConfig(),
  key = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!key || !process.argv.includes("--apply"))
  throw new Error("Use --apply only for authorized isolated live acceptance.");
const base = "http://127.0.0.1:3000",
  db = createClient(c.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  checks: { case: string; passed: boolean }[] = [];
function check(label: string, value: unknown): asserts value {
  checks.push({ case: label, passed: Boolean(value) });
  if (!value) throw new Error(label);
  console.log(JSON.stringify({ passed: checks.length, case: label }));
}
const runId = randomUUID(),
  prefix = `qa-${runId.slice(0, 8)}`,
  password = `Aa1!${randomBytes(20).toString("hex")}`,
  newPassword = `Bb2!${randomBytes(20).toString("hex")}`,
  users: string[] = [],
  schools: string[] = [];
const operatorEmail = `${prefix}-operator@acceptance.example.test`,
  operatorName = `QA isolated operator ${runId.slice(0, 8)}`;
const fixture = {
  runId,
  operatorEmail,
  password,
  newPassword,
  operatorId: "",
  users,
  schools,
  checks,
};
await mkdir(".local", { recursive: true });
async function persist() {
  await writeFile(".local/platform-e2e.json", JSON.stringify(fixture), {
    mode: 0o600,
  });
}
async function session(email: string, pass = password) {
  const jar = new Map<string, string>(),
    client = createServerClient(c.url, c.publishableKey, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => {
          for (const v of values)
            v.value ? jar.set(v.name, v.value) : jar.delete(v.name);
        },
      },
    });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: pass,
  });
  check(`fresh account signs in: ${email.split("@")[0]}`, !error && data.user);
  return { client, jar, id: data.user!.id };
}
type Session = Awaited<ReturnType<typeof session>>;
async function request(s: Session | null, path: string, body?: unknown) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined
        ? { "Content-Type": "application/json", Origin: base }
        : {}),
      ...(s
        ? { Cookie: [...s.jar].map(([k, v]) => `${k}=${v}`).join("; ") }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
}
async function command(s: Session, body: unknown, expected = 200) {
  const r = await request(s, "/api/platform", body);
  if (r.status !== expected)
    console.log({ status: r.status, error: await r.clone().text() });
  check(
    `platform ${String((body as { type: string }).type)} HTTP ${expected}`,
    r.status === expected,
  );
  return r;
}
try {
  const { data: created, error } = await db.auth.admin.createUser({
    email: operatorEmail,
    password,
    email_confirm: true,
    user_metadata: { name: operatorName },
    app_metadata: { isolated_acceptance: runId },
  });
  check("isolated operator Auth created", !error && created.user);
  fixture.operatorId = created.user.id;
  users.push(created.user.id);
  await persist();
  const { error: grant } = await db
    .from("mis_platform_operators")
    .insert({ user_id: created.user.id, display_name: operatorName });
  check("isolated operator grant created", !grant);
  const op = await session(operatorEmail);
  check(
    "anonymous cannot list institutions",
    (await request(null, "/api/platform?view=institutions")).status === 403,
  );
  const requests: Record<string, unknown>[] = [];
  for (let i = 0; i < 2; i++) {
    const requestId = randomUUID(),
      schoolId = `school-${requestId}`,
      input = {
        requestId,
        institutionType: i ? "college" : "school",
        school: {
          name: `QA isolated institution ${runId.slice(0, 8)} ${i}`,
          shortName: `QA ${i}`,
          curriculum: "CBSE",
          address: {
            line1: "Acceptance campus",
            city: "Kochi",
            region: "Kerala",
            postalCode: "682001",
            countryCode: "IN",
          },
          email: `${prefix}-office-${i}@acceptance.example.test`,
          phone: "+919876543210",
          timezone: "Asia/Kolkata",
          locale: "en-IN",
          currency: "INR",
        },
        year: {
          name: "2026–27",
          startDate: "2026-04-01",
          endDate: "2027-03-31",
        },
        administratorName: `QA Administrator ${i}`,
        administratorEmail: `${prefix}-admin-${i}@acceptance.example.test`,
        temporaryPassword: password,
      };
    schools.push(schoolId);
    requests.push(input);
    await persist();
    const r = await command(op, { type: "institution-create", input }),
      result = await r.json();
    users.push(result.userId);
    await persist();
    check(
      "registration returns reserved institution",
      result.schoolId === schoolId,
    );
    const repeat = await command(op, { type: "institution-create", input });
    check(
      "registration retry is idempotent",
      (await repeat.json()).userId === result.userId,
    );
    const { data: raw, error: e } = await db.rpc("mis_read_workspace", {
      p_school_id: schoolId,
    });
    check("fresh canonical persisted", !e);
    const root = workspaceSchema.parse(raw);
    check(
      "fresh school has no seed students or transactions",
      root.years[0].setup.students.length === 0 &&
        root.years[0].records.invoices.length === 0 &&
        root.years[0].extensions.length === 0 &&
        root.years[0].setup.completed.length === 0,
    );
  }
  const adminEmail = String(requests[0].administratorEmail),
    admin = await session(adminEmail);
  check(
    "temporary-password session cannot access data",
    (await request(admin, "/api/support")).status === 403,
  );
  check(
    "activation page opens",
    (await request(admin, "/change-password")).status === 200,
  );
  check(
    "password activation accepts recipient password",
    (await request(admin, "/api/account/activate", { password: newPassword }))
      .status === 200,
  );
  const adminReady = await session(adminEmail, newPassword),
    other = await session(String(requests[1].administratorEmail));
  check(
    "second school activates",
    (await request(other, "/api/account/activate", { password: newPassword }))
      .status === 200,
  );
  const otherReady = await session(
    String(requests[1].administratorEmail),
    newPassword,
  );
  check(
    "fresh setup screen loads",
    (await request(adminReady, "/school-setup")).status === 200,
  );
  check(
    "school administrator cannot list platform institutions",
    (await request(adminReady, "/api/platform?view=institutions")).status ===
      403,
  );
  check(
    "school administrator cannot elevate via platform commands",
    (
      await request(adminReady, "/api/platform", {
        type: "institution-status",
        schoolId: schools[1],
        status: "suspended",
      })
    ).status === 403,
  );
  const ticketInput = {
    requestId: randomUUID(),
    subject: `QA isolated report ${runId.slice(0, 8)}`,
    description: "Report export needs review in this new institution.",
    replyEmail: adminEmail,
    category: "technical",
  };
  const ticketResponse = await request(adminReady, "/api/support", ticketInput);
  check("school submits support", ticketResponse.status === 200);
  const ticket = await ticketResponse.json();
  check(
    "duplicate support request idempotent",
    (await request(adminReady, "/api/support", ticketInput)).status === 200,
  );
  check(
    "support rejects forged school",
    (
      await request(adminReady, "/api/support", {
        ...ticketInput,
        requestId: randomUUID(),
        schoolId: schools[1],
      })
    ).status === 400,
  );
  check(
    "other school cannot read ticket",
    (await request(otherReady, `/api/support?ticketId=${ticket.id}`)).status ===
      403,
  );
  const queued = await (
    await request(op, `/api/platform?view=support&schoolId=${schools[0]}`)
  ).json();
  check(
    "request reaches platform queue",
    queued.tickets.some((t: { id: string }) => t.id === ticket.id),
  );
  await command(op, {
    type: "ticket-update",
    ticketId: ticket.id,
    expectedVersion: 0,
    status: "in-progress",
    note: "Review started",
    kind: "status",
  });
  await command(
    op,
    {
      type: "ticket-update",
      ticketId: ticket.id,
      expectedVersion: 0,
      status: "resolved",
      note: "stale",
      kind: "status",
    },
    409,
  );
  await command(op, {
    type: "ticket-update",
    ticketId: ticket.id,
    expectedVersion: 1,
    status: "in-progress",
    note: "Private operator investigation",
    kind: "internal-note",
  });
  await command(op, {
    type: "ticket-update",
    ticketId: ticket.id,
    expectedVersion: 2,
    status: "in-progress",
    note: "Manually contacted recipient; acceptance record only",
    kind: "manual-contact",
  });
  const schoolDetail = await (
    await request(adminReady, `/api/support?ticketId=${ticket.id}`)
  ).json();
  check(
    "school history omits internal notes/manual logs",
    schoolDetail.events.every(
      (e: { kind: string }) =>
        !["internal-note", "manual-contact"].includes(e.kind),
    ),
  );
  await command(op, {
    type: "ticket-update",
    ticketId: ticket.id,
    expectedVersion: 3,
    status: "resolved",
    note: "Issue resolved",
    kind: "status",
  });
  await command(op, {
    type: "ticket-update",
    ticketId: ticket.id,
    expectedVersion: 4,
    status: "closed",
    note: "Closed after review",
    kind: "status",
  });
  await command(op, {
    type: "ticket-update",
    ticketId: ticket.id,
    expectedVersion: 5,
    status: "open",
    note: "Reopened by operator",
    kind: "status",
  });
  const staffEmail = `${prefix}-staff@acceptance.example.test`,
    staffInput = {
      requestId: randomUUID(),
      schoolId: schools[0],
      email: staffEmail,
      name: "QA New Staff",
      role: "staff",
      personId: null,
      temporaryPassword: password,
    };
  const staffResult = await (
    await command(op, { type: "account-create", input: staffInput })
  ).json();
  users.push(staffResult.userId);
  await persist();
  const staff = await session(staffEmail);
  check(
    "new staff must activate",
    (await request(staff, "/api/support")).status === 403,
  );
  check(
    "staff activates",
    (await request(staff, "/api/account/activate", { password: newPassword }))
      .status === 200,
  );
  const staffReady = await session(staffEmail, newPassword);
  await command(op, {
    type: "account-update",
    schoolId: schools[0],
    userId: staff.id,
    role: "staff",
    active: false,
  });
  check(
    "disabled staff existing session denied",
    (await request(staffReady, "/api/support")).status === 403,
  );
  await command(op, {
    type: "account-update",
    schoolId: schools[0],
    userId: staff.id,
    role: "staff",
    active: true,
  });
  check(
    "reactivated staff can access support",
    (await request(staffReady, "/api/support")).status === 200,
  );
  await command(
    op,
    {
      type: "account-update",
      schoolId: schools[0],
      userId: admin.id,
      role: "admin",
      active: false,
    },
    403,
  );
  await command(
    op,
    {
      type: "account-update",
      schoolId: schools[1],
      userId: staff.id,
      role: "staff",
      active: false,
    },
    403,
  );
  await command(
    op,
    {
      type: "account-create",
      input: { ...staffInput, requestId: randomUUID(), role: "platform" },
    },
    400,
  );
  const duplicate = await command(
    op,
    {
      type: "account-create",
      input: { ...staffInput, requestId: randomUUID() },
    },
    403,
  );
  check("existing account is not overwritten", duplicate.status === 403);
  const inspection = await (
    await request(
      op,
      `/api/platform?view=inspect&schoolId=${schools[0]}&section=records.invoices`,
    )
  ).json();
  check(
    "platform inspects selected institution without impersonation",
    inspection.school.id === schools[0] && inspection.rows.length === 0,
  );
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save({ useObjectStreams: false }),
    form = new FormData();
  form.set("yearId", inspection.yearId);
  form.set("ownerType", "school");
  form.set("ownerId", schools[0]);
  form.set("category", "general");
  form.set(
    "file",
    new File([new Uint8Array(bytes)], "QA isolated document.pdf", {
      type: "application/pdf",
    }),
  );
  const upload = await fetch(base + "/api/documents", {
    method: "POST",
    headers: {
      Origin: base,
      Cookie: [...adminReady.jar].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: form,
  });
  check("new school uploads private document", upload.status === 201);
  const file = (await upload.json()).file;
  check(
    "platform downloads selected school private document",
    (
      await request(
        op,
        `/api/platform/institutions/${schools[0]}/documents/${file.id}`,
      )
    ).status === 200,
  );
  check(
    "platform download rejects wrong institution",
    (
      await request(
        op,
        `/api/platform/institutions/${schools[1]}/documents/${file.id}`,
      )
    ).status === 403,
  );
  check(
    "school user cannot use platform download",
    (
      await request(
        adminReady,
        `/api/platform/institutions/${schools[0]}/documents/${file.id}`,
      )
    ).status === 403,
  );
  await command(op, {
    type: "institution-status",
    schoolId: schools[0],
    status: "suspended",
  });
  check(
    "suspension blocks existing school session",
    (await request(adminReady, "/api/support")).status === 403,
  );
  check(
    "other institution remains active",
    (await request(otherReady, "/api/support")).status === 200,
  );
  check(
    "operator still inspects suspended institution",
    (await request(op, `/api/platform?view=inspect&schoolId=${schools[0]}`))
      .status === 200,
  );
  await command(op, {
    type: "institution-status",
    schoolId: schools[0],
    status: "active",
  });
  check(
    "reactivation restores school session",
    (await request(adminReady, "/api/support")).status === 200,
  );
  await command(op, {
    type: "account-reset",
    schoolId: schools[0],
    userId: staff.id,
    temporaryPassword: password,
  });
  check(
    "reset revokes old session",
    (await request(staffReady, "/api/support")).status === 403,
  );
  const reset = await session(staffEmail);
  check(
    "reset account requires new password",
    (await request(reset, "/api/support")).status === 403,
  );
  check(
    "unsafe origin blocked",
    (
      await fetch(base + "/api/platform", {
        method: "POST",
        headers: {
          Origin: "https://foreign.example",
          Cookie: [...op.jar].map(([k, v]) => `${k}=${v}`).join("; "),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "institution-status",
          schoolId: schools[0],
          status: "suspended",
        }),
      })
    ).status === 403,
  );
  const { error: revoke } = await db
    .from("mis_platform_operators")
    .update({ active: false })
    .eq("user_id", op.id);
  check("isolated operator revoke saved", !revoke);
  check(
    "revoked operator existing session denied",
    (await request(op, "/api/platform?view=institutions")).status === 403,
  );
  await db
    .from("mis_platform_operators")
    .update({ active: true })
    .eq("user_id", op.id);
  await persist();
  await writeFile(
    "docs/platform-live-verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        existingAccountsModified: false,
        fixtureCleanup: "Pending browser acceptance and isolated cleanup",
      },
      null,
      2,
    ),
  );
  console.log(
    "Isolated live acceptance complete. Credentials remain only in ignored .local/platform-e2e.json for browser checks; run cleanup next.",
  );
} catch (e) {
  await persist();
  await writeFile(
    "docs/platform-live-verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        existingAccountsModified: false,
        error: e instanceof Error ? e.message : "Acceptance failed",
        fixtureCleanup: "Required",
      },
      null,
      2,
    ),
  );
  throw e;
}
