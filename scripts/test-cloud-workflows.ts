/** Integration checks against synthetic school data. Tokens/keys are never logged. */
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import { accountIdentitySchema } from "../src/features/identity/schemas/identity.schema.ts";
import { TEST_ACCOUNT_PASSWORD } from "../src/features/identity/data/test-accounts.ts";
import { applyCloudCommand } from "../src/features/cloud/domain/commands.ts";
import { projectCloudWorkspace } from "../src/features/cloud/domain/projection.ts";
import { decideLeave } from "../src/features/workspace/domain/operations.ts";
import type { AccountIdentity } from "../src/features/identity/models/index.ts";
nextEnv.loadEnvConfig(process.cwd());
const config = getSupabaseConfig(),
  key = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!key) throw new Error("Configure the server key locally before testing.");
const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(30000) });
const admin = createClient(config.url, key, {
  global: { fetch: boundedFetch },
  auth: { persistSession: false, autoRefreshToken: false },
});
const checks: { case: string; passed: boolean }[] = [];
const actors = new Map<string, AccountIdentity>();
const clients = new Map<string, SupabaseClient>();
function check(name: string, value: unknown): asserts value {
  checks.push({ case: name, passed: Boolean(value) });
  if (!value) throw new Error(name);
}
function rejects(name: string, fn: () => unknown) {
  let rejected = false;
  try {
    fn();
  } catch {
    rejected = true;
  }
  check(name, rejected);
}
const a = (role: string) => actors.get(role)!;
let root: ReturnType<typeof workspaceSchema.parse>;
const school = "school-greenfield",
  suffix = crypto.randomUUID().slice(0, 8);
async function read() {
  const { data, error } = await admin.rpc("mis_read_workspace", {
    p_school_id: school,
  });
  check("Canonical database read", !error);
  return workspaceSchema.parse(data);
}
async function commit(next: typeof root, actor: AccountIdentity, label: string) {
  const { error } = await admin.rpc("mis_commit_workspace", {
    p_school_id: school,
    p_expected_revision: root.revision,
    p_document: next,
    p_actor_id: actor.id,
    p_action: `Integration audit: ${label}`,
  });
  check(label, !error);
  root = await read();
  check(`${label} persisted revision`, root.revision === next.revision);
}
async function command(role: string, c: unknown, label: string) {
  const next = applyCloudCommand(root, a(role), {
    expectedRevision: root.revision,
    yearId: root.activeYearId,
    command: c,
  });
  await commit(next, a(role), label);
}
try {
  console.log("Starting synthetic cloud workflow audit");
  for (const role of ["admin", "teacher", "staff", "parent", "student"]) {
    const client = createClient(config.url, config.publishableKey, {
      global: { fetch: boundedFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: `${role}@greenfield.test`,
      password: TEST_ACCOUNT_PASSWORD,
    });
    check(`${role} real Auth sign-in`, !error && Boolean(data.user));
    const { data: member, error: membershipError } = await client
      .from("mis_memberships")
      .select("user_id,school_id,role,person_id,display_name,active")
      .eq("user_id", data.user!.id)
      .single();
    check(
      `${role} own membership through RLS`,
      !membershipError && member?.role === role && member?.active,
    );
    console.log(`${role} authenticated`);
    actors.set(
      role,
      accountIdentitySchema.parse({
        id: data.user!.id,
        email: data.user!.email,
        name: member.display_name,
        role: member.role,
        schoolId: member.school_id,
        personId: member.person_id,
      }),
    );
    clients.set(role, client);
  }
  root = await read();
  const y = () =>
    root.years.find((y) => y.setup.calendar.year.id === root.activeYearId)!;
  const parent = clients.get("parent")!;
  const { error: rawError } = await parent.rpc("mis_read_workspace", {
    p_school_id: school,
  });
  check(
    "Parent cannot download canonical workspace directly",
    Boolean(rawError),
  );
  const { error: overwriteError } = await parent.rpc("mis_commit_workspace", {
    p_school_id: school,
    p_expected_revision: root.revision,
    p_document: root,
    p_actor_id: a("parent").id,
    p_action: "Forbidden overwrite",
  });
  check("Parent cannot call privileged write RPC", Boolean(overwriteError));
  const { data: others } = await parent
    .from("mis_memberships")
    .select("user_id")
    .neq("user_id", a("parent").id);
  check("Parent RLS hides other memberships", others?.length === 0);
  const { error: roleError, data: changed } = await parent
    .from("mis_memberships")
    .update({ role: "admin" })
    .eq("user_id", a("parent").id)
    .select("user_id");
  const { data: storedMember } = await admin
    .from("mis_memberships")
    .select("role")
    .eq("user_id", a("parent").id)
    .single();
  check(
    "Parent cannot promote own role",
    storedMember?.role === "parent" &&
      (Boolean(roleError) || changed?.length === 0),
  );
  const source = y().records.homework.find(
    (h) => h.staffId === a("teacher").personId,
  )!;
  const homework = {
    ...source,
    id: `cloud-hw-${suffix}`,
    title: `Cloud workflow ${suffix}`,
    maxScore: 10,
  };
  await command(
    "teacher",
    { type: "teacher-create", kind: "homework", input: homework },
    "Teacher assignment saved",
  );
  await command(
    "student",
    {
      type: "homework-submit",
      input: {
        homeworkId: homework.id,
        studentId: "student-1",
        answer: "I calculated the total and checked every step.",
      },
    },
    "Student answer saved",
  );
  const submission = y().records.submissions.find(
    (s) => s.homeworkId === homework.id && s.studentId === "student-1",
  )!;
  await command(
    "teacher",
    {
      type: "submission-grade",
      input: {
        submissionId: submission.id,
        score: 9,
        feedback: "Correct working and a clear explanation.",
      },
    },
    "Teacher feedback saved",
  );
  check(
    "Parent projection receives score and feedback",
    projectCloudWorkspace(root, a("parent"))
      .years.find((v) => v.setup.calendar.year.id === root.activeYearId)!
      .records.submissions.some((s) => s.id === submission.id && s.score === 9),
  );
  const claimSource = y().extensions.find((r) => r.kind === "expenses")!;
  const claim = {
    ...claimSource,
    id: `cloud-expense-${suffix}`,
    title: `Cloud staff claim ${suffix}`,
    staffId: a("staff").personId,
    status: "draft",
    createdBy: a("staff").id,
    history: [],
    values: { ...claimSource.values, amountMinor: 12550 },
  };
  await command(
    "staff",
    { type: "operation-save", input: claim },
    "Staff expense draft saved",
  );
  await command(
    "staff",
    {
      type: "operation-save",
      input: {
        ...y().extensions.find((r) => r.id === claim.id)!,
        status: "submitted",
      },
    },
    "Staff claim submitted",
  );
  rejects("Staff self-approval rejected", () =>
    applyCloudCommand(root, a("staff"), {
      expectedRevision: root.revision,
      yearId: root.activeYearId,
      command: {
        type: "operation-save",
        input: {
          ...y().extensions.find((r) => r.id === claim.id)!,
          status: "approved",
        },
      },
    }),
  );
  await command(
    "admin",
    {
      type: "operation-save",
      input: {
        ...y().extensions.find((r) => r.id === claim.id)!,
        status: "approved",
      },
    },
    "Admin approves staff claim",
  );
  check(
    "Staff projection receives school decision",
    projectCloudWorkspace(root, a("staff"))
      .years.find((v) => v.setup.calendar.year.id === root.activeYearId)!
      .extensions.some((r) => r.id === claim.id && r.status === "approved"),
  );
  const date = y().setup.calendar.year.startDate;
  await command(
    "parent",
    {
      type: "leave",
      input: {
        personId: "student-1",
        startDate: date,
        endDate: date,
        reason: `Cloud family appointment ${suffix}`,
      },
    },
    "Parent leave request saved",
  );
  const leave = y().records.leaves.at(-1)!;
  const approved = decideLeave(
    y(),
    leave.id,
    "approved",
    "Approved by the cloud audit administrator.",
  );
  await commit(
    workspaceSchema.parse({
      ...root,
      revision: root.revision + 1,
      years: root.years.map((v) =>
        v.setup.calendar.year.id === root.activeYearId ? approved : v,
      ),
    }),
    a("admin"),
    "Admin leave approval persisted",
  );
  await command(
    "teacher",
    {
      type: "attendance-save",
      input: {
        classSectionId: source.classSectionId,
        date,
        entries: [{ studentId: "student-1", status: "present" }],
      },
    },
    "Teacher attendance respects approved leave",
  );
  check(
    "Parent receives excused attendance",
    projectCloudWorkspace(root, a("parent"))
      .years.find((v) => v.setup.calendar.year.id === root.activeYearId)!
      .records.attendance.some(
        (r) =>
          r.personId === "student-1" &&
          r.date === date &&
          r.status === "excused",
      ),
  );
  rejects("Unrelated child command rejected", () =>
    applyCloudCommand(root, a("parent"), {
      expectedRevision: root.revision,
      yearId: root.activeYearId,
      command: {
        type: "leave",
        input: {
          personId: "student-2",
          startDate: date,
          endDate: date,
          reason: "Unrelated child attempt",
        },
      },
    }),
  );
  rejects("Foreign school projection rejected", () =>
    projectCloudWorkspace(root, { ...a("parent"), schoolId: "foreign-school" }),
  );
  const stale = root.revision - 1;
  const { error: staleError } = await admin.rpc("mis_commit_workspace", {
    p_school_id: school,
    p_expected_revision: stale,
    p_document: { ...root, revision: stale + 1 },
    p_actor_id: a("admin").id,
    p_action: "Rejected stale audit write",
  });
  console.log(
    JSON.stringify({
      staleCode: staleError?.code,
      staleMessage: staleError?.message,
    }),
  );
  const afterStale = await read();
  check(
    "Database CAS rejects stale writer",
    staleError?.code === "PT409" && afterStale.revision === root.revision,
  );
  const { error: lastAdminError } = await admin
    .from("mis_memberships")
    .update({ active: false })
    .eq("user_id", a("admin").id);
  check("Database prevents disabling final admin", Boolean(lastAdminError));
  const pp = projectCloudWorkspace(root, a("parent")).years[0];
  check(
    "Parent projection contains only permitted student",
    pp.setup.students.length === 1 && pp.setup.students[0].id === "student-1",
  );
  check(
    "Parent receives no staff dossiers or audit ledger",
    pp.records.staffProfiles.length === 0 && pp.setup.audit.length === 0,
  );
  const { data: claims } = await parent.auth.getClaims();
  const sessionId = claims?.claims.session_id;
  const { data: activeBefore } = await admin.rpc("mis_session_active", {
    p_user_id: a("parent").id,
    p_session_id: sessionId,
  });
  check("Authenticated session is recognised", activeBefore === true);
  await parent.auth.signOut({ scope: "global" });
  const { data: activeAfter } = await admin.rpc("mis_session_active", {
    p_user_id: a("parent").id,
    p_session_id: sessionId,
  });
  check("Global sign-out invalidates session lookup", activeAfter === false);
  for (const client of clients.values()) await client.auth.signOut({scope:"local"});
  writeFileSync(
    "docs/supabase-workflow-audit.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        project: config.url,
        checks,
        passed: checks.filter((c) => c.passed).length,
        failed: checks.filter((c) => !c.passed).length,
        revision: root.revision,
        scope:
          "Real Auth and RLS requests plus server-domain workflows committed to the remote database; browser scenarios are recorded separately.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: checks.length,
      failed: 0,
      revision: root.revision,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      failedCase:
        error instanceof Error ? error.message : "Unknown integration failure",
      passed: checks.filter((c) => c.passed).length,
    }),
  );
  process.exitCode = 1;
}
