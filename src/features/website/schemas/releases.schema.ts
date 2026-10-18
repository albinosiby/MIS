import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { schoolProfileSchema } from "../../../shared/schemas/school.ts";
import { operationRecordSchema } from "../../operations/schemas/operations.schema.ts";
export const websitePublishSchema = z.strictObject({
  label: z.string().trim().min(2).max(100),
});
export const websiteSelectSchema = z.strictObject({
  id: identifierSchema.nullable(),
});
export const websiteReleaseSchema = z
  .strictObject({
    id: identifierSchema,
    schoolId: identifierSchema,
    version: z.number().int().positive(),
    label: z.string().min(2).max(100),
    publishedAt: z.iso.datetime(),
    publishedBy: identifierSchema,
    school: schoolProfileSchema,
    content: z.array(operationRecordSchema).max(200),
  })
  .superRefine((release, ctx) => {
    if (release.school.id !== release.schoolId)
      ctx.addIssue({
        code: "custom",
        path: ["schoolId"],
        message: "Website branding must belong to the school.",
      });
    const slugs = new Set<string>();
    for (const [index, row] of release.content.entries()) {
      if (
        !["cms-pages", "cms-news"].includes(row.kind) ||
        row.status !== "published" ||
        row.schoolId !== release.schoolId ||
        row.studentId ||
        row.staffId ||
        row.history.length ||
        row.createdBy !== "school-website"
      )
        ctx.addIssue({
          code: "custom",
          path: ["content", index],
          message: "Only public CMS content can be included in a release.",
        });
      if (row.kind === "cms-pages") {
        const slug = String(row.values.slug);
        if (
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
          ["admissions", "verify-certificate"].includes(slug) ||
          slugs.has(slug)
        )
          ctx.addIssue({
            code: "custom",
            path: ["content", index, "values", "slug"],
            message: "Use a unique lowercase page slug that is not reserved.",
          });
        slugs.add(slug);
      }
    }
  });
