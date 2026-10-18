import { z } from "zod";
export const mfaRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("enroll"),
    name: z.string().trim().min(2).max(60),
  }),
  z.strictObject({
    action: z.literal("verify"),
    factorId: z.uuid(),
    code: z.string().regex(/^\d{6}$/),
  }),
  z.strictObject({ action: z.literal("remove"), factorId: z.uuid() }),
]);
export const mfaSummarySchema = z.strictObject({
  factors: z.array(
    z.strictObject({
      id: z.uuid(),
      friendlyName: z.string(),
      status: z.enum(["verified", "unverified"]),
    }),
  ),
  currentLevel: z.enum(["aal1", "aal2"]).nullable(),
  nextLevel: z.enum(["aal1", "aal2"]).nullable(),
});

export const mfaEnrollmentSchema=z.strictObject({factorId:z.uuid(),qrCode:z.string().max(100000),secret:z.string().max(200)});
