"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  Metrics,
  Panel,
  Badge,
  Table,
  LinkButton,
  ExportButton,
  RecordDialog,
  classOptions,
  staffOptions,
  labelFor,
  enumOptions,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { admissionStageSchema } from "../schemas/admissions.schema";
import type { Inquiry } from "../models";
import { downloadFile } from "../../school-setup/components/setup-ingestion";

export function AdmissionsFirstRow({
  route,
  search,
}: {
  route: "/admissions/inquiries" | "/admissions/analytics";
  search: string;
}) {
  const { year: y } = useWorkspace();
  const [query, setQuery] = useState(""),
    [stage, setStage] = useState("all"),
    [source, setSource] = useState("all"),
    [counselor, setCounselor] = useState("all");
  const [editor, setEditor] = useState<ReactNode>(null);
  const classes = classOptions(y),
    staff = staffOptions(y),
    inquiries = y.records.inquiries;
  const needle = `${search} ${query}`.trim().toLowerCase();
  const filtered = inquiries.filter(
    (i) =>
      (stage === "all" || i.stage === stage) &&
      (source === "all" || i.source === source) &&
      (counselor === "all" ||
        (counselor === "unassigned"
          ? !i.counselorId
          : i.counselorId === counselor)) &&
      `${i.id} ${i.studentName} ${i.guardianName} ${i.phone} ${i.email}`
        .toLowerCase()
        .includes(needle),
  );
  const enrolled = inquiries.filter((i) => i.stage === "enrolled").length;
  const activeStudents = y.setup.students.filter(
    (s) =>
      !y.records.studentProfiles.some(
        (p) => p.studentId === s.id && p.status !== "active",
      ),
  );
  const exportStages = admissionStageSchema.options.map((value) => ({
    school: y.setup.school.shortName,
    academicYear: y.setup.calendar.year.name,
    stage: value,
    count: inquiries.filter((i) => i.stage === value).length,
    percent: inquiries.length
      ? Math.round(
          (inquiries.filter((i) => i.stage === value).length /
            inquiries.length) *
            100,
        )
      : 0,
  }));
  const fields: FormField[] = [
    { name: "studentName", label: "Student full name", required: true },
    { name: "guardianName", label: "Guardian name", required: true },
    { name: "email", label: "Guardian email", required: true },
    { name: "phone", label: "Guardian phone (country code)", required: true },
    {
      name: "classSectionId",
      label: "Target cohort",
      type: "select",
      options: classes,
    },
    {
      name: "source",
      label: "Lead channel",
      type: "select",
      options: enumOptions([
        "Website",
        "Walk-in",
        "Referral",
        "Phone",
        "Campaign",
      ]),
    },
    {
      name: "counselorId",
      label: "Assigned counselor",
      type: "select",
      options: staff,
    },
    { name: "followUpDate", label: "Follow-up date", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  function edit(i: Inquiry, assignment = false) {
    setEditor(
      <RecordDialog
        title={assignment ? "Assign inquiry counselor" : "Inquiry details"}
        collection="inquiries"
        initial={i}
        fields={
          assignment
            ? fields.filter((f) =>
                ["counselorId", "followUpDate", "notes"].includes(f.name),
              )
            : fields
        }
        onClose={() => setEditor(null)}
      />,
    );
  }
  if (route === "/admissions/analytics")
    return (
      <>
        <div className="fr-toolbar">
          <p>Intake overview · academic year {y.setup.calendar.year.name}</p>
          <div className="ws-actions">
            <LinkButton href="/admissions/inquiries">
              Manage inquiries
            </LinkButton>
            <ExportButton
              name="admissions-funnel"
              report="admissions"
              rows={exportStages}
            />
          </div>
        </div>
        <Metrics
          items={[
            {
              label: "Total inquiries",
              value: inquiries.length,
              detail: "Current intake records",
            },
            {
              label: "Enrolled inquiries",
              value: enrolled,
              detail: "Linked intake stage",
            },
            {
              label: "Gross conversion",
              value: inquiries.length
                ? `${Math.round((enrolled / inquiries.length) * 100)}%`
                : "—",
              detail: "Enrolled / all inquiries",
            },
            {
              label: "Available seats",
              value: Math.max(
                0,
                y.setup.classes.reduce((n, c) => n + c.capacity, 0) -
                  activeStudents.length,
              ),
              detail: "Configured capacity minus active students",
            },
          ]}
        />
        <div className="fr-columns">
          <div>
            <Panel
              title="Stage-by-stage intake funnel"
              action={
                <Badge>{admissionStageSchema.options.length} stages</Badge>
              }
            >
              <div className="fr-summary">
                <div>
                  <strong>{inquiries.length}</strong>
                  <span>Registered inquiries</span>
                </div>
                <div>
                  <strong>{enrolled}</strong>
                  <span>Enrolled</span>
                </div>
              </div>
              <p className="fr-help">
                Current-stage distribution from saved intake records. Historical
                stage-by-stage attrition is not inferred from a student's
                current stage.
              </p>
              {exportStages.map((s, index) => (
                <div className="fr-stage" key={s.stage}>
                  <b>{index + 1}</b>
                  <div>
                    <h3>{s.stage.replaceAll("_", " ")}</h3>
                    <progress
                      aria-label={`${s.stage}: ${s.count} inquiries`}
                      value={s.count}
                      max={Math.max(1, inquiries.length)}
                    />
                  </div>
                  <span>
                    {s.count}
                    <br />
                    <small>{s.percent}%</small>
                  </span>
                </div>
              ))}
              {!inquiries.length && (
                <p className="fr-empty">
                  No intake records yet. Create an enquiry to start the
                  pipeline.
                </p>
              )}
            </Panel>
            <Panel
              title="Grade capacity & seat utilisation"
              action={
                <LinkButton href="/admissions/seats">Manage seats</LinkButton>
              }
            >
              <Table
                headers={[
                  "Academic cohort",
                  "Capacity",
                  "Active enrolled",
                  "Utilisation",
                ]}
                rows={y.setup.classes.map((c) => {
                  const count = activeStudents.filter(
                    (s) => s.classSectionId === c.id,
                  ).length;
                  return [
                    labelFor(classes, c.id),
                    c.capacity,
                    count,
                    <Badge
                      tone={
                        count > c.capacity
                          ? "red"
                          : count >= c.capacity
                            ? "amber"
                            : "green"
                      }
                    >
                      {c.capacity
                        ? `${Math.round((count / c.capacity) * 100)}%`
                        : "Not set"}
                    </Badge>,
                  ];
                })}
              />
            </Panel>
          </div>
          <aside>
            <Panel title="Inquiry channel sources">
              {["Website", "Walk-in", "Referral", "Phone", "Campaign"].map(
                (s) => {
                  const count = inquiries.filter((i) => i.source === s).length;
                  return (
                    <div key={s} className="fr-source">
                      <span>
                        {s}
                        <small>
                          {inquiries.length
                            ? Math.round((count / inquiries.length) * 100)
                            : 0}
                          % of inquiries
                        </small>
                      </span>
                      <strong>{count}</strong>
                    </div>
                  );
                },
              )}
            </Panel>
            <Panel title="Closed inquiry reasons">
              {[
                ...new Set(
                  inquiries
                    .filter((i) => i.stage === "lost")
                    .map((i) => i.lostReason || "Reason not recorded"),
                ),
              ].map((reason) => (
                <div className="fr-source" key={reason}>
                  <span>{reason}</span>
                  <strong>
                    {
                      inquiries.filter(
                        (i) =>
                          i.stage === "lost" &&
                          (i.lostReason || "Reason not recorded") === reason,
                      ).length
                    }
                  </strong>
                </div>
              ))}
              {!inquiries.some((i) => i.stage === "lost") && (
                <p className="fr-empty">No closed inquiries recorded.</p>
              )}
            </Panel>
            <Panel title="Recent admission exports">
              <div className="fr-help">
                {y.records.exports
                  .filter((e) => e.report === "admissions")
                  .slice(-3)
                  .reverse()
                  .map((e) => (
                    <div key={e.id}>
                      <h3>{e.filename}</h3>
                      <p>
                        {e.rowCount} rows ·{" "}
                        {new Date(e.createdAt).toLocaleDateString(
                          y.setup.school.locale,
                        )}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() =>
                          downloadFile(
                            e.filename,
                            e.content,
                            "text/csv;charset=utf-8",
                          )
                        }
                      >
                        Download saved CSV
                      </Button>
                    </div>
                  ))}
                {!y.records.exports.some((e) => e.report === "admissions") && (
                  <p>
                    No exports yet. Export the current funnel using the button
                    above.
                  </p>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </>
    );
  return (
    <>
      <div className="fr-toolbar">
        <p>Review and triage the school's prospective student pipeline.</p>
        <div className="ws-actions">
          <LinkButton href="/admissions/analytics">
            Export / view funnel
          </LinkButton>
          <ExportButton
            name="admissions-inquiries"
            report="admissions"
            rows={filtered}
          />
          <LinkButton href="/admissions/inquiries/new" variant="default">
            + New walk-in enquiry
          </LinkButton>
        </div>
      </div>
      <Metrics
        items={[
          {
            label: "Total inquiries",
            value: inquiries.length,
            detail: "Saved intake records",
          },
          {
            label: "Action required",
            value: inquiries.filter(
              (i) => !i.counselorId && !["lost", "enrolled"].includes(i.stage),
            ).length,
            detail: "Active inquiries without a counselor",
          },
          {
            label: "Assessment",
            value: inquiries.filter((i) => i.stage === "assessment").length,
            detail: "Current assessment stage",
          },
          {
            label: "Enrolled",
            value: enrolled,
            detail: "Completed intake stage",
          },
        ]}
      />
      <div className="ws-filter-bar">
        <label className="fr-filter">
          Find an inquiry
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Student, parent, phone or ENQ-ID…"
            maxLength={200}
          />
        </label>
        <label className="fr-filter">
          Funnel stage
          <Select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All stages</option>
            {enumOptions(admissionStageSchema.options).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="fr-filter">
          Lead channel
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All channels</option>
            {["Website", "Walk-in", "Referral", "Phone", "Campaign"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </Select>
        </label>
        <label className="fr-filter">
          Counselor
          <Select
            value={counselor}
            onChange={(e) => setCounselor(e.target.value)}
          >
            <option value="all">All counselors</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setQuery("");
            setStage("all");
            setSource("all");
            setCounselor("all");
          }}
        >
          Clear filters
        </Button>
      </div>
      <Panel
        title="Prospective student inquiries"
        action={<Badge>{filtered.length} matching inquiries</Badge>}
      >
        <Table
          headers={[
            "Student & guardian",
            "Target cohort",
            "Lead channel",
            "Assigned counselor",
            "Funnel / follow-up",
            "Actions",
          ]}
          rows={filtered.map((i) => [
            <>
              <strong>{i.studentName}</strong>
              <br />
              <small>
                {i.id} · {i.guardianName}
              </small>
              <br />
              <small>{i.phone}</small>
            </>,
            labelFor(classes, i.classSectionId),
            i.source,
            <>
              <strong>{labelFor(staff, i.counselorId)}</strong>
              <br />
              <Button variant="ghost" onClick={() => edit(i, true)}>
                Assign counselor
              </Button>
            </>,
            <>
              <Badge
                tone={
                  i.stage === "enrolled"
                    ? "green"
                    : i.stage === "lost"
                      ? "gray"
                      : "blue"
                }
              >
                {i.stage.replaceAll("_", " ")}
              </Badge>
              <br />
              <small>Follow-up: {i.followUpDate}</small>
            </>,
            <div className="ws-actions">
              <Button variant="outline" onClick={() => edit(i)}>
                Details
              </Button>
              {i.stage === "offered" && (
                <LinkButton href={`/students/new?inquiry=${i.id}`}>
                  Enroll student
                </LinkButton>
              )}
              <LinkButton
                href={`/documents/files?owner=${encodeURIComponent(`admission:${i.id}`)}`}
              >
                Files
              </LinkButton>
            </div>,
          ])}
          empty="No inquiries match your search and filters."
        />
      </Panel>
      <div className="fr-note">
        Follow-up dates and stages come from saved intake records. Assessment
        and offer decisions continue in their existing admission workflows.
      </div>
      {editor}
    </>
  );
}
