export type * from "./operations.ts";
import type { z } from "zod";
import type {
  websiteReleaseSchema,
  websitePublishSchema,
  websiteSelectSchema,
} from "../schemas/releases.schema.ts";
export type WebsiteRelease = z.infer<typeof websiteReleaseSchema>;
export type WebsitePublish = z.infer<typeof websitePublishSchema>;
export type WebsiteSelect = z.infer<typeof websiteSelectSchema>;
