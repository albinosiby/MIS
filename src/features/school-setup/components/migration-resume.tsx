"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  Badge,
  Panel,
  Metrics,
  Table,
  LinkButton,
  DataForm,
  ExportButton,
} from "../../workspace/components/workspace-ui";
import { useSetupWorkspace } from "../hooks/setup-workspace-provider";
import { completeSetupStep, setupPhases } from "../domain/setup-workflow";
import { reviewException } from "../domain/review-exception";
import type { ExceptionRecord } from "../models";
import { IngestionEditor } from "./setup-ingestion";
import { readableError } from "./form-errors";

export function MigrationResume() {
  const { config, year, commit, busy, inactiveStudentIds } =
    useSetupWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [review, setReview] = useState<ExceptionRecord | null>(null),
    [error, setError] = useState("");
  const phases = setupPhases(config),
    current = phases.find((p) => p.status === "in_progress");
  const unresolved = config.exceptions.filter((e) =>
    `${e.name} ${e.id} ${e.discrepancy}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (config.completed.length < 6)
    return (
      <Panel title="Complete the preceding setup phases">
        <div className="fr-help">
          <p>
            Student data migration unlocks after school configuration and staff
            allocation are signed off.
          </p>
          <LinkButton href={`/school-setup/${current?.id ?? "school-profile"}`}>
            Continue {current?.title ?? "school setup"}
          </LinkButton>
        </div>
      </Panel>
    );
  return (
    <>
      <div className="fr-toolbar">
        <p>Phase 7 of 8 · Student data ingestion</p>
        <div className="ws-actions">
          <LinkButton href="/school-setup">Setup overview</LinkButton>
          <ExportButton
            name="migration-exceptions"
            report="students"
            rows={config.exceptions.map((e) => ({
              student: e.name,
              record: e.id,
              category: e.category,
              exception: e.discrepancy,
            }))}
          />
        </div>
      </div>
      <Metrics
        items={[
          {
            label: "Student records",
            value: config.students.length,
            detail: "Saved in this academic year",
          },
          {
            label: "Unresolved exceptions",
            value: config.exceptions.length,
            detail: "Review before signing off ingestion",
          },
          {
            label: "Recorded reviews",
            value: config.reviews.length,
            detail: "Administrative decisions retained",
          },
        ]}
      />
      <div className="fr-columns">
        <div>
          <Panel
            title="Data migration processing status"
            action={
              <Badge tone={config.exceptions.length ? "amber" : "green"}>
                {config.exceptions.length
                  ? "Review required"
                  : "Ready for sign-off"}
              </Badge>
            }
          >
            <div className="fr-help">
              <h3>
                {config.students.length} student records ·{" "}
                {config.completed.length} setup phases complete
              </h3>
              <p>
                Import files are parsed and validated before saving. Resolve
                flagged records to continue to the parent gateway.
              </p>
              <progress
                aria-label="Setup phases completed"
                value={config.completed.length}
                max={8}
              />
            </div>
          </Panel>
          <Panel
            title="Records requiring action"
            action={<Badge>{unresolved.length} matching</Badge>}
          >
            <div className="ws-panel-body">
              <label htmlFor="migration-search">Filter exceptions</label>
              <Input
                id="migration-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Student, GRN or diagnostic…"
                maxLength={200}
              />
            </div>
            <Table
              headers={[
                "Student / GRN",
                "Class",
                "Diagnostic exception",
                "Action",
              ]}
              rows={unresolved.map((e) => [
                <>
                  <strong>{e.name}</strong>
                  <br />
                  <small>{e.id}</small>
                </>,
                e.grade,
                <>
                  <Badge tone="amber">{e.category}</Badge>
                  <p>{e.discrepancy}</p>
                </>,
                <Button
                  variant="outline"
                  disabled={busy || year.locked}
                  onClick={() => setReview(e)}
                >
                  Resolve
                </Button>,
              ])}
              empty="No unresolved exceptions match this search."
            />
          </Panel>
          <Panel title="Import & reconciliation tools">
            <details className="fr-import-tools">
              <summary>
                <Upload aria-hidden="true" />
                Upload CSV or review imported data
              </summary>
              <IngestionEditor />
            </details>
          </Panel>
          <div className="fr-toolbar">
            <p>
              {config.exceptions.length
                ? "Resolve all remaining exceptions before sign-off."
                : "All recorded exceptions resolved. You can sign off this phase."}
            </p>
            <Button
              disabled={busy || year.locked || config.exceptions.length > 0}
              onClick={async () => {
                setError("");
                try {
                  await commit(
                    (current) =>
                      completeSetupStep(
                        current,
                        "data-ingestion",
                        current,
                        inactiveStudentIds,
                      ),
                    "Signed off student data ingestion",
                  );
                  router.push("/school-setup/portal-gateway");
                } catch (e) {
                  setError(readableError(e));
                }
              }}
            >
              Proceed to phase 8<ArrowRight aria-hidden="true" />
            </Button>
          </div>
          {error && (
            <p className="config-errors" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside>
          <Panel title="Migration checklist">
            <div className="fr-help">
              <h3>Review before continuing</h3>
              <ul>
                <li>Use the CSV template and existing class IDs.</li>
                <li>Check student and guardian relationships.</li>
                <li>Resolve every recorded exception.</li>
                <li>Sign off ingestion to enable portal setup.</li>
              </ul>
            </div>
          </Panel>
          <Panel title="Data integrity">
            <div className="fr-help">
              <ShieldCheck aria-hidden="true" />
              <h3>Validated school workspace</h3>
              <p>
                School and academic-year relationships are checked when records
                are saved. Administrative review does not verify identity or
                external compliance.
              </p>
              <LinkButton href="/students">Open student directory</LinkButton>
            </div>
          </Panel>
        </aside>
      </div>
      {review && (
        <Dialog
          title={`Resolve ${review.name}`}
          onClose={() => setReview(null)}
        >
          <p>{review.discrepancy}</p>
          <DataForm
            initial={{ note: "" }}
            fields={[
              {
                name: "note",
                label: "Review note (8–500 characters)",
                type: "textarea",
                required: true,
              },
            ]}
            submitLabel="Save review & resolve"
            onSave={async (input) => {
              if (!input || typeof input !== "object" || !("note" in input))
                throw new Error("Add a review note.");
              const note = input.note;
              await commit((current) => {
                const result = reviewException(
                  current.exceptions,
                  {
                    schoolId: current.school.id,
                    academicYearId: current.calendar.year.id,
                    exceptionId: review.id,
                    note,
                  },
                  {
                    schoolId: current.school.id,
                    academicYearId: current.calendar.year.id,
                  },
                );
                if (!result.success)
                  throw new Error(result.issues[0]?.message ?? "Review failed");
                return {
                  ...current,
                  exceptions: result.records,
                  reviews: [...current.reviews, result.review],
                };
              }, `Reviewed ingestion exception ${review.id}`);
              setReview(null);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
