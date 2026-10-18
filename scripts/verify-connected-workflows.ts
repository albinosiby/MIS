/** Synthetic-account HTTP checks. Preserves existing school records and all memberships. */
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { writeFile } from "node:fs/promises";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { TEST_ACCOUNT_PASSWORD } from "../src/features/identity/data/test-accounts.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import {
  runJobBatch,
  queueDueReports,
  processDurableJob,
} from "../src/features/jobs/server/processor.ts";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true")
  throw new Error("Synthetic account tests must be enabled.");
const config = getSupabaseConfig(),
  secret = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!secret || config.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co")
  throw new Error("Expected configured project.");
const bounded: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(60000) });
const sdk = createClient(config.url, secret, {
    global: { fetch: bounded },
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  base = "http://127.0.0.1:3000";
const sessions = new Map<
    string,
    { client: SupabaseClient; cookies: Map<string, string>; id: string }
  >(),
  checks: { case: string; passed: boolean }[] = [];
function check(label: string, value: unknown): asserts value {
  checks.push({ case: label, passed: Boolean(value) });
  if (!value) throw new Error(label);
}
async function call(role: string | null, path: string, input?: unknown) {
  return bounded(base + path, {
    method: input ? "POST" : "GET",
    redirect: "manual",
    headers: {
      Origin: base,
      Cookie: [...(sessions.get(role ?? "")?.cookies ?? [])]
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
}
async function read() {
  const { data, error } = await sdk.rpc("mis_read_workspace", {
    p_school_id: "school-greenfield",
  });
  if (error) throw new Error("Canonical read failed.");
  return workspaceSchema.parse(data);
}
try {
  const original = await read(),
    originalIds = original.years.map((y) => ({
      year: y.setup.calendar.year.id,
      students: y.setup.students.map((s) => s.id),
      staff: y.setup.staff.map((s) => s.id),
    }));
  for (const role of ["admin", "teacher", "staff", "parent", "student"]) {
    const cookies = new Map<string, string>();
    const client: SupabaseClient = createServerClient(
      config.url,
      config.publishableKey,
      {
        global: { fetch: bounded },
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
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
    check(`${role} existing login`, !error && data.user);
    sessions.set(role, { client, cookies, id: data.user.id });
  }
  for (const role of ["admin", "teacher", "staff", "parent", "student"]) {
    const response = await call(role, "/api/account/context");
    const result = await response.json();
    check(
      `${role} lists only own assigned context`,
      response.status === 200 &&
        result.contexts.length === 1 &&
        result.contexts[0].role === role,
    );
    check(
      `${role} cannot select another account context`,
      (
        await call(role, "/api/account/context", {
          membershipId: `primary:${sessions.get(role === "admin" ? "parent" : "admin")!.id}`,
        })
      ).status === 403,
    );
    const mfa = await call(role, "/api/account/mfa");
    check(
      `${role} can inspect own MFA without changing credentials`,
      mfa.status === 200 && Array.isArray((await mfa.json()).factors),
    );
  }
  const y = original.years.find(
      (y) => y.setup.calendar.year.id === original.activeYearId,
    )!,
    yearId = y.setup.calendar.year.id,
    child = "student-1";
  check(
    "Signed-out conversation denied",
    (await call(null, `/api/conversations?year=${yearId}`)).status === 403,
  );
  check(
    "Staff cannot inspect admin jobs",
    (await call("staff", "/api/jobs")).status === 403,
  );
  check(
    "Admin can inspect jobs",
    (await call("admin", "/api/jobs")).status === 200,
  );
  for (const role of ["admin", "parent", "teacher", "student", "staff"]) {
    check(
      `${role} direct messages table denied`,
      (await sessions.get(role)!.client.from("mis_messages").select("*")).error,
    );
  }
  const key = crypto.randomUUID(),
    create = {
      type: "create",
      input: {
        yearId,
        studentId: child,
        subject: "Workflow verification discussion",
        participantIds: [sessions.get("parent")!.id],
        clientKey: key,
      },
    };
  const response = await call("admin", "/api/conversations", create);
  check("Admin creates explicit parent thread", response.status === 201);
  const thread = (await response.json()).conversation;
  const repeated = await call("admin", "/api/conversations", create);
  check(
    "Conversation retry is idempotent",
    repeated.status === 201 &&
      (await repeated.json()).conversation.id === thread.id,
  );
  check(
    "Changed participants cannot reuse create key",
    (
      await call("admin", "/api/conversations", {
        ...create,
        input: {
          ...create.input,
          participantIds: [sessions.get("teacher")!.id],
        },
      })
    ).status === 403,
  );
  check(
    "Explicit parent can read thread",
    (
      await call(
        "parent",
        `/api/conversations?year=${yearId}&thread=${thread.id}&student=${child}`,
      )
    ).status === 200,
  );
  check(
    "Uninvited teacher cannot read thread",
    (
      await call(
        "teacher",
        `/api/conversations?year=${yearId}&thread=${thread.id}&student=${child}`,
      )
    ).status === 403,
  );
  check(
    "Uninvited student cannot read thread",
    (
      await call(
        "student",
        `/api/conversations?year=${yearId}&thread=${thread.id}&student=${child}`,
      )
    ).status === 403,
  );
  const message = {
    type: "send",
    input: {
      conversationId: thread.id,
      body: "Please review the saved school workflow. This is an internal account verification.",
      attachmentIds: [],
      clientKey: crypto.randomUUID(),
    },
  };
  check(
    "Nonparticipant cannot send",
    (await call("staff", "/api/conversations", message)).status === 403,
  );
  const sent = await call("admin", "/api/conversations", message);
  check("Permitted message queued", sent.status === 201);
  const msg = (await sent.json()).message;
  const retry = await call("admin", "/api/conversations", message);
  check(
    "Send retry does not duplicate message",
    retry.status === 201 && (await retry.json()).message.id === msg.id,
  );
  check(
    "Changed message cannot reuse key",
    (
      await call("admin", "/api/conversations", {
        ...message,
        input: { ...message.input, body: "Different contents" },
      })
    ).status === 403,
  );
  check(
    "Wrong origin cannot send",
    (
      await bounded(base + "/api/conversations", {
        method: "POST",
        headers: {
          Origin: "https://untrusted.invalid",
          Cookie: [...sessions.get("admin")!.cookies]
            .map(([k, v]) => `${k}=${v}`)
            .join("; "),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      })
    ).status === 403,
  );
  const { data: job } = await sdk
    .from("mis_jobs")
    .select("*")
    .eq("dedupe_key", `message:${msg.id}`)
    .single();
  check("Message has one durable job", job);
  if (new Date(job.run_at) > new Date())
    await sdk
      .from("mis_jobs")
      .update({ run_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pending");
  for (let count = 0; count < 15; count++) {
    await runJobBatch(sdk, 5);
    const { data: state } = await sdk
      .from("mis_jobs")
      .select("status")
      .eq("id", job.id)
      .single();
    if (state?.status === "completed") break;
  }
  const { data: delivered } = await sdk
    .from("mis_messages")
    .select("status")
    .eq("id", msg.id)
    .single();
  check("Worker delivers without browser", delivered?.status === "sent");
  const inbox = await call("parent", "/api/inbox");
  check(
    "Parent receives permitted inbox notification",
    inbox.status === 200 &&
      (await inbox.json()).notifications.some(
        (n: { source_key: string }) => n.source_key === `message:${msg.id}`,
      ),
  );
  const staffInbox = await call("staff", "/api/inbox");
  check(
    "Unrelated staff does not receive private notification",
    staffInbox.status === 200 &&
      !(await staffInbox.json()).notifications.some(
        (n: { source_key: string }) => n.source_key === `message:${msg.id}`,
      ),
  );
  check(
    "Parent can flag a thread",
    (
      await call("parent", "/api/conversations", {
        type: "state",
        id: thread.id,
        state: "flagged",
      })
    ).status === 200,
  );
  check(
    "Flagged thread prevents send",
    (
      await call("admin", "/api/conversations", {
        ...message,
        input: { ...message.input, clientKey: crypto.randomUUID() },
      })
    ).status === 403,
  );
  check(
    "Parent cannot bypass moderation",
    (
      await call("parent", "/api/conversations", {
        type: "state",
        id: thread.id,
        state: "open",
      })
    ).status === 403,
  );
  check(
    "Participating admin can close thread",
    (
      await call("admin", "/api/conversations", {
        type: "state",
        id: thread.id,
        state: "closed",
      })
    ).status === 200,
  );
  let root = await read();
  const id = crypto.randomUUID(),
    command = {
      type: "workflow",
      input: {
        action: "report-builder",
        input: {
          id,
          name: "Verified student register",
          source: "students",
          columns: ["displayName", "admissionNumber"],
          filters: [],
        },
      },
    };
  check(
    "Parent cannot configure school reports",
    (
      await call("parent", "/api/workflows", {
        expectedRevision: root.revision,
        yearId,
        command,
      })
    ).status === 403,
  );
  const saved = await call("admin", "/api/workflows", {
    expectedRevision: root.revision,
    yearId,
    command,
  });
  check("Admin report definition persisted", saved.status === 200);
  root = await read();
  check(
    "Reload contains saved report",
    root.years
      .find((y) => y.setup.calendar.year.id === yearId)!
      .workflows.reportBuilders.some((r) => r.id === id),
  );
  const published = await call("admin", "/api/workflows", {
    expectedRevision: root.revision,
    yearId,
    command: {
      type: "workflow",
      input: { action: "report-publish", input: { id } },
    },
  });
  check("Publish immutable report snapshot", published.status === 200);
  root = await read();
  const pub = root.years
    .find((y) => y.setup.calendar.year.id === yearId)!
    .workflows.publications.find((p) => p.sourceId === id)!;
  for (const format of ["pdf", "xlsx"]) {
    const output = await call(
      "admin",
      `/api/publications/${pub.id}?year=${yearId}&format=${format}`,
    );
    check(
      `Admin downloads ${format}`,
      output.status === 200 && (await output.arrayBuffer()).byteLength > 1000,
    );
    check(
      `Parent cannot download school ${format}`,
      (
        await call(
          "parent",
          `/api/publications/${pub.id}?year=${yearId}&format=${format}`,
        )
      ).status === 403,
    );
  }
  const originalPublication=JSON.stringify(pub),beforeRevocationRevision=root.revision;
  check("Parent cannot revoke a school publication",(await call("parent",`/api/publications/${pub.id}`,{yearId,reason:"Synthetic verification revoke"})).status===403);
  check("Admin records publication revocation",(await call("admin",`/api/publications/${pub.id}`,{yearId,reason:"Synthetic verification complete"})).status===200);
  check("Publication revocation retry is idempotent",(await call("admin",`/api/publications/${pub.id}`,{yearId,reason:"Synthetic verification complete"})).status===200);
  check("Revoked publication bytes are denied",(await call("admin",`/api/publications/${pub.id}?year=${yearId}&format=pdf`)).status===403);
  const register=await call("admin",`/api/publications?year=${yearId}&search=${pub.reference}`),registerData=await register.json();check("Register reports revocation without issued contents or actor IDs",register.status===200&&registerData.publications.some((p:{id:string;revokedAt:string|null;snapshot?:unknown;issuedBy?:unknown})=>p.id===pub.id&&p.revokedAt&&!p.snapshot&&!p.issuedBy));
  const unchanged=await read();check("Revocation leaves issued snapshot and workspace revision unchanged",unchanged.revision===beforeRevocationRevision&&JSON.stringify(unchanged.years.find(y=>y.setup.calendar.year.id===yearId)!.workflows.publications.find(p=>p.id===pub.id))===originalPublication);root=unchanged;
  const invalid=structuredClone(unchanged),invalidYear=invalid.years.find(y=>y.setup.calendar.year.id===yearId)!;invalid.revision++;
  invalidYear.workflows.publications.push({...pub,id:crypto.randomUUID(),kind:"transcript",reference:`REJECT-${crypto.randomUUID()}`,snapshot:{assessments:[{reference:pub.reference}]}});
  const {error:dependencyError}=await sdk.rpc("mis_commit_workspace",{p_school_id:"school-greenfield",p_expected_revision:unchanged.revision,p_document:invalid,p_actor_id:sessions.get("admin")!.id,p_action:"Verify revoked dependency guard"});
  check("Database atomically rejects a transcript using revoked results",dependencyError?.code==="PT403");
  check("Rejected dependency leaves the school revision unchanged",(await read()).revision===unchanged.revision);
  for(const role of ["admin","teacher","staff","parent","student"])check(`${role} direct revocation registry denied`,Boolean((await sessions.get(role)!.client.from("mis_publication_revocations").select("*")).error));
  const templateId=crypto.randomUUID(),template={id:templateId,schoolId:"school-greenfield",academicYearId:yearId,kind:"certificate-templates",title:"Verification certificate template",date:y.setup.calendar.year.startDate,studentId:null,staffId:null,status:"draft",values:{prefix:"QA",body:"This certifies {{student}} at {{school}} for {{year}}."},createdBy:sessions.get("admin")!.id,history:[]};
  async function adminCommand(command:unknown){root=await read();const response=await call("admin","/api/workflows",{expectedRevision:root.revision,yearId,command});check("Synthetic certificate command persists",response.status===200);root=await read();}
  await adminCommand({type:"operation-save",input:template});await adminCommand({type:"operation-save",input:{...template,status:"published"}});await adminCommand({type:"workflow",input:{action:"certificate-bulk",input:{studentIds:[child],templateId,type:"Bonafide",issuedOn:new Date().toISOString().slice(0,10)}}});
  const cert=root.years.find(y=>y.setup.calendar.year.id===yearId)!.workflows.publications.find(p=>p.kind==="certificate"&&p.snapshot.templateId===templateId)!;
  const verified=await call(null,`/api/verification/certificate?reference=${cert.reference}`),attestation=await verified.json();check("Issued certificate verifies without student identity",verified.status===200&&attestation.valid===true&&Object.keys(attestation.certificate).sort().join(",")==="issuedOn,school,type");
  check("Parent downloads their child's issued certificate",(await call("parent",`/api/publications/${cert.id}?year=${yearId}`)).status===200);
  check("Admin can revoke issued certificate",(await call("admin",`/api/publications/${cert.id}`,{yearId,reason:"Synthetic certificate verification complete"})).status===200);
  const revokedCheck=await call(null,`/api/verification/certificate?reference=${cert.reference}`);check("Revoked certificate no longer verifies",revokedCheck.status===200&&(await revokedCheck.json()).valid===false);
  check("Revocation blocks parent certificate download",(await call("parent",`/api/publications/${cert.id}?year=${yearId}`)).status===403);
  root=await read();
  const scheduleId = crypto.randomUUID(),
    today = new Date().toISOString().slice(0, 10);
  const scheduled = await call("admin", "/api/workflows", {
    expectedRevision: root.revision,
    yearId,
    command: {
      type: "workflow",
      input: {
        action: "report-schedule",
        input: {
          id: scheduleId,
          reportId: id,
          frequency: "daily",
          nextRun: today,
          enabled: true,
          recipientIds: [sessions.get("admin")!.id],
        },
      },
    },
  });
  check("Durable report schedule saved", scheduled.status === 200);
  await queueDueReports(sdk);
  await queueDueReports(sdk);
  const { data: scheduledJobs } = await sdk
    .from("mis_jobs")
    .select("id")
    .eq("school_id", "school-greenfield")
    .eq("dedupe_key", `report-schedule:${yearId}:${scheduleId}:${today}`);
  check(
    "Repeated schedule discovery queues exactly once",
    scheduledJobs?.length === 1,
  );
  for (let count = 0; count < 10; count++) {
    await runJobBatch(sdk, 5);
    const { data: state } = await sdk
      .from("mis_jobs")
      .select("status")
      .eq("id", scheduledJobs[0].id)
      .single();
    if (state?.status === "completed") break;
  }
  root = await read();
  const scheduledYear = root.years.find(
    (y) => y.setup.calendar.year.id === yearId,
  )!;
  check(
    "Report worker publishes snapshot and advances schedule",
    scheduledYear.workflows.publications.some(
      (p) => p.snapshot.jobId === scheduledJobs[0].id,
    ) &&
      scheduledYear.workflows.reportSchedules.find((s) => s.id === scheduleId)!
        .nextRun > today,
  );
  const paused = await call("admin", "/api/workflows", {
    expectedRevision: root.revision,
    yearId,
    command: {
      type: "workflow",
      input: {
        action: "report-schedule",
        input: {
          id: scheduleId,
          reportId: id,
          frequency: "daily",
          nextRun: scheduledYear.workflows.reportSchedules.find(
            (s) => s.id === scheduleId,
          )!.nextRun,
          enabled: false,
          recipientIds: [sessions.get("admin")!.id],
        },
      },
    },
  });
  check("Verification schedule paused after testing", paused.status === 200);
  root = await read();
  const stale = await call("admin", "/api/workflows", {
    expectedRevision: root.revision - 1,
    yearId,
    command,
  });
  check("Stale save cannot overwrite newer data", stale.status !== 200);
  check(
    "Existing student/staff IDs preserved",
    JSON.stringify(
      root.years.map((y) => ({
        year: y.setup.calendar.year.id,
        students: y.setup.students.map((s) => s.id),
        staff: y.setup.staff.map((s) => s.id),
      })),
    ) === JSON.stringify(originalIds),
  );
  const { data: staffMembership } = await sessions
    .get("staff")!
    .client.from("mis_memberships")
    .select("role")
    .single();
  check("Staff membership remains staff", staffMembership?.role === "staff");
} finally {
  for (const session of sessions.values())
    await session.client.auth.signOut({ scope: "local" });
  await writeFile(
    "docs/connected-workflows-live-verification.json",
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
