"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WorkflowField } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText,
} from "../../workspace/hooks/workflow-actions";
export function WebsiteReleasePanel() {
  const { year, unavailable, run, submit } = useWorkflowActions(),
    active = year.workflows.activeWebsiteReleaseId;
  return (
    <>
      <section className="op-card">
        <h2>Publish the school website</h2>
        <p>
          CMS records marked published are prepared content. A release saves
          their text and school branding together. Later edits stay private
          until the next release.
        </p>
        <div className="op-links">
          <Link href="/website/pages">Edit pages</Link>
          <Link href="/website/news">Edit news</Link>
          <Link href="/school-site" target="_blank" rel="noopener noreferrer">
            Open public site
          </Link>
        </div>
        <form
          className="conversation-form mt-5"
          onSubmit={submit("website-publish", (form) => ({
            label: workflowText(form, "label"),
          }))}
        >
          <WorkflowField label="Release label">
            <input
              name="label"
              required
              minLength={2}
              maxLength={100}
              placeholder="School website update"
            />
          </WorkflowField>
          <Button type="submit" disabled={unavailable}>
            Publish website release
          </Button>
        </form>
      </section>
      <section className="op-card mt-6">
        <h2>Saved releases</h2>
        {!active && (
          <p className="op-notice">
            No release is live. The public site shows its school information and
            admissions links without CMS pages or news.
          </p>
        )}
        {[...year.workflows.websiteReleases].reverse().map((release) => (
          <div className="conversation-notice" key={release.id}>
            <div>
              <strong>{release.label}</strong>
              <p>
                Version {release.version} · {release.publishedAt.slice(0, 10)} ·{" "}
                {release.content.length} content records ·{" "}
                {release.id === active ? "Live" : "Saved"}
              </p>
            </div>
            {release.id !== active && (
              <Button
                variant="outline"
                disabled={unavailable}
                onClick={() => void run("website-select", { id: release.id })}
              >
                Restore this release
              </Button>
            )}
          </div>
        ))}
        {active && (
          <Button
            variant="outline"
            disabled={unavailable}
            onClick={() => void run("website-select", { id: null })}
          >
            Withdraw live CMS content
          </Button>
        )}
      </section>
    </>
  );
}
