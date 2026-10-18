import type { z } from "zod";
import type { durableJobSchema, jobAttemptSchema } from "../schemas/job.schema.ts";
export type DurableJob = z.infer<typeof durableJobSchema>;
export type JobAttempt = z.infer<typeof jobAttemptSchema>;

import type {jobConsoleResponseSchema} from "../schemas/job.schema.ts";
export type JobConsoleResponse=z.infer<typeof jobConsoleResponseSchema>;
