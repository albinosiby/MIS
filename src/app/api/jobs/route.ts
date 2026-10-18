import { z } from "zod";
import {
  schoolActor,
  jsonBody,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  durableJobSchema,
  jobControlSchema,
  jobAttemptSchema,
} from "@/features/jobs/schemas/job.schema";
const summary = durableJobSchema.omit({
  payload: true,
  lease_token: true,
  lease_until: true,
  created_by: true,
});
export async function GET() {
  try {
    const actor = await schoolActor();
    if (!["admin", "principal"].includes(actor.role))
      throw new Error("Administrator required.");
    const client = createSupabaseAdminClient();
    const { data, error } = await client
      .from("mis_jobs")
      .select("*")
      .eq("school_id", actor.schoolId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Jobs unavailable.");
    const jobs = durableJobSchema.array().parse(data);
    const ids = jobs.map((j) => j.id);
    const { data: rawAttempts, error: attemptError } = ids.length
      ? await client
          .from("mis_job_attempts")
          .select("*")
          .in("job_id", ids)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [], error: null };
    if (attemptError) throw new Error("Attempts unavailable.");
    return privateJson({
      jobs: jobs.map(
        ({
          payload: _payload,
          lease_token: _token,
          lease_until: _lease,
          created_by: _creator,
          ...row
        }) => summary.parse(row),
      ),
      attempts: jobAttemptSchema.array().parse(rawAttempts),
      providers: {
        App: "in-app delivery enabled",
        Email: "not configured",
        SMS: "not configured",
        WhatsApp: "not configured",
        Push: "not configured",
      },
    });
  } catch (e) {
    return apiFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await schoolActor();
    if (!["admin", "principal"].includes(actor.role))
      throw new Error("Administrator required.");
    const input = jobControlSchema.parse(await jsonBody(request));
    const {error}=await createSupabaseAdminClient().rpc("mis_control_job",{p_actor:actor.id,p_school:actor.schoolId,p_id:input.id,p_action:input.action});
    if(error)throw new Error("Job changed or this action is unavailable. Refresh and retry.");
    return privateJson({ ok: true });
  } catch (e) {
    return apiFailure(e);
  }
}
