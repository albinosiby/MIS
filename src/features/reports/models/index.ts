export type * from "./operations.ts";

import type {z} from "zod";

import type {publicationSchema, reportBuilderSchema, publishedReportScheduleSchema} from "../schemas/publication.schema.ts";
export type Publication=z.infer<typeof publicationSchema>;
export type ReportBuilder=z.infer<typeof reportBuilderSchema>;
export type PublishedReportSchedule=z.infer<typeof publishedReportScheduleSchema>;

import type {publicationSummarySchema,publicationListResponseSchema,publicationRevocationSchema} from "../schemas/publication-register.schema.ts";
export type PublicationSummary=z.infer<typeof publicationSummarySchema>;
export type PublicationListResponse=z.infer<typeof publicationListResponseSchema>;
export type PublicationRevocation=z.infer<typeof publicationRevocationSchema>;
