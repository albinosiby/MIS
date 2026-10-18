import {z} from "zod";
const gradeBands = z
  .array(
    z.strictObject({
      label: z.string().trim().min(1).max(20),
      minimum: z.number().min(0).max(100),
    }),
  )
  .min(1)
  .max(20);
export const publishResultsSchema = z
  .strictObject({ examId: z.string().min(1), gradeBands,
    publishedScaleIds: z.array(z.string().min(1).max(128)).max(20).default([]),
    templateId: z.string().min(1).max(128).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (
      !v.gradeBands.some((b) => b.minimum === 0) ||
      new Set(v.gradeBands.map((b) => b.minimum)).size !== v.gradeBands.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["gradeBands"],
        message: "Grade thresholds must be unique and include zero.",
      });
  });

export const publishTranscriptSchema = z.strictObject({
  studentId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  weights: z
    .array(
      z.strictObject({
        examId: z.string().min(1),
        weightBps: z.number().int().min(1).max(10000),
      }),
    )
    .min(1)
    .max(50),
});
