import { z } from "zod";
export const mutationCapabilitySchema = z.enum([
  "billing",
  "employment",
  "attendance",
  "teaching",
  "operations",
  "configuration",
  "publications",
  "documents",
  "communication",
]);
