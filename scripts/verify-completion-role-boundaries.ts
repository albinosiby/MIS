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
  for (const role of ["admin", "teacher", "parent", "staff", "student"]) {
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
  const original=await read(),year=original.years.find(y=>y.setup.calendar.year.id===original.activeYearId)!;
  const exam=year.records.exams.toReversed().find(e=>e.name.startsWith("QA lifecycle exam"))!;
  const report=year.workflows.publications.toReversed().find(p=>p.sourceId===exam.id&&p.kind==="report-card"&&!p.revokedAt)!;
  const slot=year.records.slots.find(s=>exam.classSectionIds.includes(s.classSectionId))!;
  const review=year.workflows.resultReviews.find(r=>r.examId===exam.id&&r.publicationId)!;
  const cover=year.workflows.substitutionReviews.find(r=>r.substitution.slotId===slot.id)!;
  check("Existing isolated lifecycle fixture is available",exam&&report&&slot&&review&&cover);
  const requests=[
    {action:"admission-continuation",input:{studentId:report.ownerId,decision:"retain",targetClassId:slot.classSectionId,note:"QA unauthorized continuation attempt"}},
    {action:"admission-withdrawal",input:{studentId:report.ownerId,date:year.setup.calendar.year.startDate,note:"QA unauthorized withdrawal attempt",feeTreatment:"retain-balance"}},
    {action:"result-review-request",input:{publicationId:report.id,subjectId:exam.subjectIds[0],proposedMarks:83,reason:"QA unauthorized mark change attempt"}},
    {action:"result-review-decide",input:{id:review.id,decision:"approved",note:"QA unauthorized review decision"}},
    {action:"substitution-request",input:{slotId:slot.id,date:cover.substitution.date,substituteStaffId:cover.substitution.substituteStaffId,reason:"QA unauthorized substitution request"}},
    {action:"substitution-decide",input:{id:cover.id,decision:"published",note:"QA unauthorized cover publication"}},
    {action:"timetable-publish",input:{classSectionId:slot.classSectionId}},
  ];
  for(const role of ["parent","student","staff"])for(const input of requests)check(`${role} denied ${input.action}`,(await command(role,{type:"workflow",input})).status===403);
  check("Teacher cannot publish a timetable",(await command("teacher",{type:"workflow",input:requests.at(-1)})).status===403);
  check("Teacher cannot confirm admission continuation",(await command("teacher",{type:"workflow",input:requests[0]})).status===403);
  for(const role of ["parent","student","staff"]){
    const response=await bounded(`${base}/api/publications/${report.id}?year=${year.setup.calendar.year.id}&format=pdf`,{headers:{Cookie:[...sessions.get(role)!.cookies].map(([k,v])=>`${k}=${v}`).join("; ")}});
    check(`${role} cannot download another student's corrected report`,response.status===403);
  }
  const after=await read(),afterYear=after.years.find(y=>y.setup.calendar.year.id===year.setup.calendar.year.id)!;
  for(const key of ["admissionDecisions","resultReviews","timetableVersions","substitutionReviews"] as const)check(`${key} history unchanged by denied attempts`,JSON.stringify(afterYear.workflows[key])===JSON.stringify(year.workflows[key]));
  for(const role of ["admin","teacher","parent","staff","student"]){const {data,error}=await sessions.get(role)!.client.from("mis_memberships").select("role,person_id").single();check(`${role} membership unchanged`,!error&&data.role===role&&data.person_id===sessions.get(role)!.personId);}
}
finally {
  for (const session of sessions.values())
    await session.client.auth.signOut({ scope: "local" });
  await writeFile("docs/completion-role-boundaries-live-verification.json", JSON.stringify({
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
