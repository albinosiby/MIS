/** Uses existing synthetic users and new learning records; never changes credentials or roles. */
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
  for (const role of ["teacher", "student", "parent"]) {
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
    student = year.setup.students.find(
      (s) => s.id === sessions.get("student")!.personId,
    )!,
    teacher = sessions.get("teacher")!;
  check(
    "Existing teacher is assigned to synthetic student's class",
    year.setup.allocations.some(
      (a) =>
        a.staffId === teacher.personId &&
        a.classSectionId === student.classSectionId,
    ),
  );
  const common = {
    schoolId: year.setup.school.id,
    academicYearId: year.setup.calendar.year.id,
    date: year.setup.calendar.year.startDate,
    studentId: null,
    staffId: null,
    createdBy: teacher.id,
    history: [],
  };
  const quiz = {
    ...common,
    id: crypto.randomUUID(),
    kind: "quizzes",
    title: "Verified geography practice",
    status: "draft",
    values: {
      classSectionId: student.classSectionId,
      question: "Name the Pacific Ocean.",
      answer: "Pacific Ocean",
      maxScore: 10,
      gradingMode: "Exact answer",
      maxAttempts: 1,
    },
  };
  check(
    "Teacher creates a quiz",
    (await command("teacher", { type: "operation-save", input: quiz }))
      .status === 200,
  );
  check(
    "Teacher publishes the quiz",
    (
      await command("teacher", {
        type: "operation-save",
        input: { ...quiz, status: "published" },
      })
    ).status === 200,
  );
  const attempt = {
    ...common,
    id: crypto.randomUUID(),
    kind: "quiz-attempts",
    title: "Verified student practice response",
    studentId: student.id,
    status: "submitted",
    values: { quizId: quiz.id, response: "  PACIFIC   ocean ", score: 0 },
    createdBy: sessions.get("student")!.id,
  };
  check(
    "Parent cannot impersonate a quiz submission",
    (await command("parent", { type: "operation-save", input: attempt }))
      .status === 403,
  );
  check(
    "Teacher cannot author a student's response",
    (await command("teacher", { type: "operation-save", input: attempt }))
      .status === 403,
  );
  check(
    "Student cannot supply a reviewed score",
    (
      await command("student", {
        type: "operation-save",
        input: { ...attempt, values: { ...attempt.values, score: 10 } },
      })
    ).status === 403,
  );
  const submitted = await command("student", {
    type: "operation-save",
    input: attempt,
  });
  check("Student submits an assigned quiz", submitted.status === 200);
  const view = (await submitted.json()).data,
    visible = view.years.find(
      (y: { setup: { calendar: { year: { id: string } } } }) =>
        y.setup.calendar.year.id === year.setup.calendar.year.id,
    );
  check(
    "Server scores exact answer",
    visible.extensions.some(
      (r: { id: string; status: string; values: { score: number } }) =>
        r.id === attempt.id && r.status === "graded" && r.values.score === 10,
    ),
  );
  check(
    "Student projection withholds answer key",
    visible.extensions.find((r: { id: string }) => r.id === quiz.id).values
      .answer !== quiz.values.answer,
  );
  check(
    "Student cannot exceed attempt allowance",
    (
      await command("student", {
        type: "operation-save",
        input: { ...attempt, id: crypto.randomUUID() },
      })
    ).status === 403,
  );
  check(
    "Student cannot regrade their answer",
    (
      await command("student", {
        type: "workflow",
        input: {
          action: "quiz-grade",
          input: {
            id: attempt.id,
            score: 9,
            feedback: "Student attempted regrading",
          },
        },
      })
    ).status === 403,
  );
  check(
    "Teacher score maximum is enforced",
    (
      await command("teacher", {
        type: "workflow",
        input: {
          action: "quiz-grade",
          input: { id: attempt.id, score: 11, feedback: "Above quiz maximum" },
        },
      })
    ).status === 403,
  );
  check(
    "Assigned teacher can review a score",
    (
      await command("teacher", {
        type: "workflow",
        input: {
          action: "quiz-grade",
          input: {
            id: attempt.id,
            score: 8,
            feedback: "Reviewed against the practice rubric",
          },
        },
      })
    ).status === 200,
  );
  const resource = {
    ...common,
    id: crypto.randomUUID(),
    kind: "resources",
    title: "Verified learning resource",
    status: "draft",
    values: {
      classSectionId: student.classSectionId,
      url: "https://example.com/learning",
      description:
        "Synthetic resource used to verify reported learning progress.",
    },
  };
  check(
    "Teacher creates a resource",
    (await command("teacher", { type: "operation-save", input: resource }))
      .status === 200,
  );
  check(
    "Teacher publishes a resource",
    (
      await command("teacher", {
        type: "operation-save",
        input: { ...resource, status: "published" },
      })
    ).status === 200,
  );
  check(
    "Parent cannot report progress as their child",
    (
      await command("parent", {
        type: "workflow",
        input: {
          action: "learning-progress",
          input: { resourceId: resource.id, state: "completed" },
        },
      })
    ).status === 403,
  );
  check(
    "Student can mark assigned resource started",
    (
      await command("student", {
        type: "workflow",
        input: {
          action: "learning-progress",
          input: { resourceId: resource.id, state: "started" },
        },
      })
    ).status === 200,
  );
  check(
    "Student can mark assigned resource completed",
    (
      await command("student", {
        type: "workflow",
        input: {
          action: "learning-progress",
          input: { resourceId: resource.id, state: "completed" },
        },
      })
    ).status === 200,
  );
  const final = await read(),
    saved = final.years.find(
      (y) => y.setup.calendar.year.id === year.setup.calendar.year.id,
    )!,
    savedAttempt = saved.extensions.find((r) => r.id === attempt.id)!;
  check(
    "Reload retains reviewed score and original response",
    savedAttempt.values.score === 8 &&
      savedAttempt.values.response === attempt.values.response,
  );
  check(
    "Reported progress persists exactly once",
    saved.workflows.learningProgress.filter(
      (p) => p.resourceId === resource.id && p.studentId === student.id,
    ).length === 1 &&
      saved.workflows.learningProgress.find(
        (p) => p.resourceId === resource.id,
      )!.state === "completed",
  );
  check(
    "Existing student IDs are preserved",
    JSON.stringify(saved.setup.students.map((s) => s.id)) ===
      JSON.stringify(year.setup.students.map((s) => s.id)),
  );
} finally {
  for (const session of sessions.values())
    await session.client.auth.signOut({ scope: "local" });
  await writeFile(
    "docs/learning-live-verification.json",
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
