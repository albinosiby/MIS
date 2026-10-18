import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  websitePublishSchema,
  websiteSelectSchema,
  websiteReleaseSchema,
} from "../schemas/releases.schema.ts";
function authorize(year: SchoolYearWorkspace, actor: AccountIdentity) {
  if (
    year.locked ||
    year.setup.school.id !== actor.schoolId ||
    !["admin", "principal"].includes(actor.role)
  )
    throw new Error(
      "An active school administrator must publish website releases.",
    );
}
export function publishWebsite(
  year: SchoolYearWorkspace,
  actor: AccountIdentity,
  input: unknown,
): SchoolYearWorkspace {
  authorize(year, actor);
  const request = websitePublishSchema.parse(input),
    content = year.extensions
      .filter(
        (row) =>
          ["cms-pages", "cms-news"].includes(row.kind) &&
          row.status === "published",
      )
      .map((row) => ({
        ...structuredClone(row),
        studentId: null,
        staffId: null,
        createdBy: "school-website",
        history: [],
      }));
  if (!content.length)
    throw new Error(
      "Prepare at least one published CMS page or news item before creating a website release.",
    );
  const release = websiteReleaseSchema.parse({
    id: crypto.randomUUID(),
    schoolId: actor.schoolId,
    version:
      1 +
      Math.max(0, ...year.workflows.websiteReleases.map((row) => row.version)),
    label: request.label,
    publishedAt: new Date().toISOString(),
    publishedBy: actor.id,
    school: structuredClone(year.setup.school),
    content,
  });
  return {
    ...year,
    workflows: {
      ...year.workflows,
      websiteReleases: [...year.workflows.websiteReleases, release],
      activeWebsiteReleaseId: release.id,
    },
  };
}
export function selectWebsiteRelease(
  year: SchoolYearWorkspace,
  actor: AccountIdentity,
  input: unknown,
): SchoolYearWorkspace {
  authorize(year, actor);
  const request = websiteSelectSchema.parse(input);
  if (
    request.id &&
    !year.workflows.websiteReleases.some(
      (release) =>
        release.id === request.id && release.schoolId === actor.schoolId,
    )
  )
    throw new Error("Website release is unavailable in this school.");
  return {
    ...year,
    workflows: { ...year.workflows, activeWebsiteReleaseId: request.id },
  };
}
