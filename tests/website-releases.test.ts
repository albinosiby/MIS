import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";
import {
  publishWebsite,
  selectWebsiteRelease,
} from "../src/features/website/domain/releases.ts";
import { projectCloudPublicWorkspace } from "../src/features/cloud/domain/public-projection.ts";
import { assertYearIntegrity } from "../src/features/workspace/domain/record-integrity.ts";
const admin = testAccounts.find((actor) => actor.role === "admin")!;
function prepared() {
  const root = createWorkspace(),
    year = root.years[0];
  year.extensions = [
    {
      id: "website-about",
      kind: "cms-pages",
      schoolId: admin.schoolId,
      academicYearId: root.activeYearId,
      title: "About our school",
      date: year.setup.calendar.year.startDate,
      studentId: null,
      staffId: null,
      status: "published",
      values: { slug: "about", body: "Approved school content" },
      createdBy: admin.id,
      history: [],
    },
  ];
  return root;
}
test("website content changes only when an immutable release is selected", () => {
  const root = prepared();
  assert.equal(projectCloudPublicWorkspace(root).years[0].extensions.length, 0);
  root.years[0] = publishWebsite(root.years[0], admin, {
    label: "Initial school release",
  });
  const original = structuredClone(root.years[0].workflows.websiteReleases[0]);
  root.years[0].extensions[0].values.body = "An unpublished later edit";
  root.years[0].setup.school.name = "A pending branding edit";
  let publicView = projectCloudPublicWorkspace(root);
  assert.equal(
    publicView.years[0].extensions[0].values.body,
    "Approved school content",
  );
  assert.equal(publicView.years[0].setup.school.name, original.school.name);
  assert.deepEqual(publicView.years[0].extensions[0].history, []);
  assert.equal(publicView.years[0].extensions[0].createdBy, "school-website");
  assert.equal(publicView.years[0].workflows.websiteReleases.length, 0);
  root.years[0] = publishWebsite(root.years[0], admin, {
    label: "Second school release",
  });
  assert.equal(root.years[0].workflows.websiteReleases[1].version, 2);
  assert.equal(
    projectCloudPublicWorkspace(root).years[0].extensions[0].values.body,
    "An unpublished later edit",
  );
  root.years[0] = selectWebsiteRelease(root.years[0], admin, {
    id: original.id,
  });
  assert.equal(
    projectCloudPublicWorkspace(root).years[0].extensions[0].values.body,
    "Approved school content",
  );
  assert.deepEqual(root.years[0].workflows.websiteReleases[0], original);
  root.years[0] = selectWebsiteRelease(root.years[0], admin, { id: null });
  assert.equal(projectCloudPublicWorkspace(root).years[0].extensions.length, 0);
});
test("website publication rejects foreign roles, duplicate/reserved slugs and altered releases", () => {
  const root = prepared(),
    year = root.years[0];
  for (const actor of testAccounts.filter(
    (actor) => !["admin", "principal"].includes(actor.role),
  ))
    assert.throws(
      () => publishWebsite(year, actor, { label: "Forbidden release" }),
      /administrator/,
    );
  assert.throws(
    () =>
      publishWebsite(
        year,
        { ...admin, schoolId: "foreign-school" },
        { label: "Foreign release" },
      ),
    /administrator/,
  );
  const duplicates = structuredClone(year);
  duplicates.extensions.push({
    ...duplicates.extensions[0],
    id: "duplicate-page",
  });
  assert.throws(() =>
    publishWebsite(duplicates, admin, { label: "Ambiguous pages" }),
  );
  for (const slug of [
    "admissions",
    "verify-certificate",
    "../private",
    "MixedCase",
  ]) {
    const invalid = structuredClone(year);
    invalid.extensions[0].values.slug = slug;
    assert.throws(() =>
      publishWebsite(invalid, admin, { label: "Invalid slug release" }),
    );
  }
  const published = publishWebsite(year, admin, { label: "Original release" }),
    changed = structuredClone(published);
  changed.workflows.websiteReleases[0].content[0].values.body =
    "Rewritten issued content";
  assert.throws(
    () => assertYearIntegrity(published, changed),
    /Published website/,
  );
  assert.throws(
    () => selectWebsiteRelease(published, admin, { id: "unknown-release" }),
    /unavailable/,
  );
});
