"use client";
import { useState, type ReactNode } from "react";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { WorkspaceScreenProps } from "../../workspace/components/workspace-screen";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  DataForm,
  RecordDialog,
  LinkButton,
  ExportButton,
  classOptions,
  staffOptions,
  studentOptions,
  labelFor,
  newRecord,
  enumOptions,
  type FormField,
} from "../../workspace/components/workspace-ui";
import {
  admissionCoreField,
  submitInquiry,
} from "../domain/admission-workflow";
import { DesignIcon } from "../../workspace/components/design-icon";
import { QrCode } from "../../workspace/components/qr-code";
import {
  scope,
  putRecord,
  progressInquiry,
} from "../../workspace/domain/operations";
import {
  inquirySchema,
  admissionFormSchema,
} from "../schemas/admissions.schema";
import type { Inquiry } from "../models";
import { readableError } from "../../school-setup/components/form-errors";
const tabs = [
  ["/admissions", "Enquiries & Pipeline"],
  ["/admissions/applications", "Applications"],
  ["/admissions/form-builder", "Form Builder"],
  ["/admissions/assessments", "Tests & Interviews"],
  ["/admissions/seats", "Seats & Waitlist"],
  ["/admissions/offers", "Offers & Enrolment"],
  ["/admissions/reenrolment", "Re-enrolment"],
  ["/admissions/analytics", "Reports & Analytics"],
] as const;
const nextStages: Record<string, string[]> = {
  new: ["contacted", "lost"],
  contacted: ["campus_visit", "application", "lost"],
  campus_visit: ["application", "lost"],
  application: ["assessment", "lost"],
  assessment: ["offered", "waitlisted", "lost"],
  offered: ["waitlisted", "lost"],
  waitlisted: ["offered", "lost"],
  lost: ["new"],
  enrolled: [],
};
export default function AdmissionsScreens({
  route,
  query,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const router = useRouter();
  const [publicSent, setPublicSent] = useState(false);

  const [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState(""),
    [stage, setStage] = useState("all");
  const r = y.records;
  const classes = classOptions(y),
    staff = staffOptions(y);
  const date = academicReferenceDate(y.setup.calendar.year, "10-18");
  const rows = r.inquiries.filter(
    (v) =>
      (stage === "all" || v.stage === stage) &&
      `${v.id} ${v.studentName} ${v.guardianName} ${v.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
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
      required: true,
    },
    {
      name: "source",
      label: "Lead source",
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
  function edit(
    v: Inquiry,
    title = "Inquiry details",
    extra: FormField[] = [],
  ) {
    setEditor(
      <RecordDialog
        title={title}
        collection="inquiries"
        initial={v}
        fields={[
          ...fields,
          ...extra,
          ...r.admissionForms[0].fields
            .filter((f) => !admissionCoreField(f.id))
            .map((f) => ({
              name: `answers.${f.id}`,
              label: `Application · ${f.label}`,
              type: (f.type === "date"
                ? "date"
                : f.type === "select"
                  ? "select"
                  : "text") as FormField["type"],
              emptyValue: "",
              options: enumOptions(
                f.options
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              ),
            })),
          {
            name: "documents",
            label: "Application documents (metadata)",
            type: "files",
          },
        ]}
        onClose={() => setEditor(null)}
      />,
    );
  }
  async function move(v: Inquiry, to: string) {
    try {
      await mutate(
        (current) => progressInquiry(current, v.id, to),
        `Moved inquiry ${v.id} to ${to}`,
        { type: "admission-progress", input: { id: v.id, stage: to } },
      );
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  const emptyInquiry = {
    ...newRecord(y),
    id: `ENQ-${Date.now()}`,
    studentName: "",
    guardianName: "",
    email: "",
    phone: "",
    classSectionId: classes[0]?.value,
    source: "Walk-in",
    stage: "new",
    counselorId: null,
    followUpDate: date,
    notes: "",
    score: null,
    interviewDate: null,
    offerExpiry: null,
    studentId: null,
    lostReason: "",
  };
  const inquiryTable = (items: Inquiry[], assessment = false) => (
    <Table
      headers={[
        "Inquiry / student",
        "Target cohort",
        "Counselor",
        "Stage / assessment",
        "Next action",
      ]}
      rows={items.map((v) => [
        <>
          <strong>{v.studentName}</strong>
          <br />
          <small>
            {v.id} · {v.guardianName}
          </small>
        </>,
        labelFor(classes, v.classSectionId),
        labelFor(staff, v.counselorId),
        <>
          <Badge
            tone={
              v.stage === "enrolled"
                ? "green"
                : v.stage === "lost"
                  ? "gray"
                  : "blue"
            }
          >
            {v.stage.replaceAll("_", " ")}
          </Badge>
          {assessment && (
            <p>
              {v.score === null ? "Score pending" : `${v.score}%`} ·{" "}
              {v.interviewDate ?? "Not scheduled"}
            </p>
          )}
        </>,
        <div className="ws-actions">
          <Button
            variant="outline"
            onClick={() =>
              edit(
                v,
                assessment ? "Assessment & interview" : "Inquiry details",
                assessment
                  ? [
                      {
                        name: "score",
                        label: "Assessment score (%)",
                        type: "number",
                      },
                      {
                        name: "interviewDate",
                        label: "Interview date",
                        type: "date",
                      },
                      {
                        name: "offerExpiry",
                        label: "Offer expiry",
                        type: "date",
                      },
                    ]
                  : [],
              )
            }
          >
            Details
          </Button>
          <LinkButton
            href={`/documents/files?owner=${encodeURIComponent(`admission:${v.id}`)}`}
          >
            Private application files
          </LinkButton>
          {v.stage === "offered" ? (
            <LinkButton href={`/students/new?inquiry=${v.id}`}>
              Enroll student
            </LinkButton>
          ) : (
            nextStages[v.stage]?.[0] && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void move(v, nextStages[v.stage][0])}
              >
                {nextStages[v.stage][0].replaceAll("_", " ")} →
              </Button>
            )
          )}
        </div>,
      ])}
    />
  );
  if (publicSent)
    return (
      <Panel title="Enquiry received">
        <p className="ws-panel-body" role="status">
          Your application has been saved. The school can review it in the
          admissions queue.
        </p>
        <LinkButton href="/school-site">Return to school site</LinkButton>
      </Panel>
    );
  if (
    route === "/admissions/public-form" &&
    query.apply === "1" &&
    !r.admissionForms[0].accepting
  )
    return (
      <Panel title="Admissions intake paused">
        <p className="ws-panel-body">
          This school is not accepting new sample applications right now.
        </p>
        <LinkButton
          href={
            query.public === "1" ? "/school-site" : "/admissions/public-form"
          }
        >
          Back to admission portal
        </LinkButton>
      </Panel>
    );
  if (
    route === "/admissions/inquiries/new" ||
    (route === "/admissions/public-form" && query.apply === "1")
  )
    return (
      <>
        <Panel
          title={
            route.endsWith("/new")
              ? "New walk-in / phone enquiry"
              : "Submit sample admission enquiry"
          }
        >
          <DataForm
            initial={{
              ...emptyInquiry,
              answers: {},
              documents: [],
              siblingStudentId: null,
            }}
            fields={[
              ...fields
                .slice(0, route.endsWith("/public-form") ? 5 : 6)
                .map((field) => {
                  const configured = r.admissionForms[0].fields.find(
                    (f) => admissionCoreField(f.id) === field.name,
                  );
                  return route.endsWith("/public-form") && configured
                    ? {
                        ...field,
                        label: configured.label,
                        description:
                          field.name === "phone"
                            ? "Include the country code, for example +919876543210."
                            : field.description,
                      }
                    : field;
                }),
              ...(route.endsWith("/public-form")
                ? r.admissionForms[0].fields
                    .filter((f) => !admissionCoreField(f.id))
                    .map((f) => ({
                      name: `answers.${f.id}`,
                      emptyValue: "",
                      label: f.label,
                      type: (f.type === "date"
                        ? "date"
                        : f.type === "select"
                          ? "select"
                          : "text") as FormField["type"],
                      required: f.required,
                      options: enumOptions(
                        f.options
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      ),
                    }))
                : []),
              ...(route.endsWith("/public-form") &&
              r.admissionForms[0].requireDocuments
                ? [
                    {
                      name: "documents",
                      label: "Required document metadata",
                      type: "files" as const,
                    },
                  ]
                : []),
              ...(route.endsWith("/public-form") &&
              r.admissionForms[0].requireSibling
                ? [
                    {
                      name: "siblingStudentId",
                      label:
                        query.public === "1"
                          ? "Sibling admission number"
                          : "Existing sibling",
                      type:
                        query.public === "1"
                          ? ("text" as const)
                          : ("select" as const),
                      options:
                        query.public === "1" ? undefined : studentOptions(y),
                      required: true,
                    },
                  ]
                : []),
            ]}
            onSave={async (value) => {
              const validated = inquirySchema.parse(value);
              await mutate(
                (current) =>
                  submitInquiry(
                    current,
                    validated,
                    route.endsWith("/public-form"),
                  ),
                "Created admission inquiry",
                query.public === "1"
                  ? { type: "public-inquiry", input: validated }
                  : { type: "admission-save", input: validated },
              );
              if (query.public === "1") setPublicSent(true);
              else router.push("/admissions/inquiries");
            }}
            submitLabel="Create enquiry"
          />
        </Panel>
        <LinkButton
          href={query.public === "1" ? "/school-site" : "/admissions"}
        >
          ← Back to admissions
        </LinkButton>
      </>
    );
  if (route === "/admissions/public-form")
    return (
      <div className="ws-two-column">
        <Panel title="Public admission form & QR code">
          <div className="ws-panel-body">
            <h3>{r.admissionForms[0].title}</h3>
            <p>
              Accepting applications:{" "}
              <Badge tone={r.admissionForms[0].accepting ? "green" : "red"}>
                {r.admissionForms[0].accepting ? "Open" : "Paused"}
              </Badge>
            </p>
            <p>
              Application fee preview:{" "}
              {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: y.setup.school.currency,
              }).format(r.admissionForms[0].applicationFeeMinor / 100)}
            </p>
            <div className="ws-actions">
              <LinkButton href="/admissions/public-form?apply=1">
                Open sample form
              </LinkButton>
              <LinkButton href="/admissions/form-builder">Edit form</LinkButton>
              <Button variant="outline" onClick={() => window.print()}>
                Print QR stand / PDF
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="Admission link">
          <div className="ws-panel-body">
            <QrCode
              value={
                typeof window === "undefined"
                  ? "/admissions/public-form?apply=1"
                  : window.location.origin + "/admissions/public-form?apply=1"
              }
              label="Scan to open the local admission workspace"
            />
            <p className="ws-hint">
              The link uses this local browser origin. No public hosting or real
              payment collection is enabled.
            </p>
          </div>
        </Panel>
      </div>
    );
  if (route === "/admissions/form-builder") {
    const form = r.admissionForms[0];
    return (
      <>
        <Panel title="Admission form settings">
          <DataForm
            key={form.id + y.setup.revision}
            initial={form}
            fields={[
              { name: "title", label: "Form title" },
              {
                name: "accepting",
                label: "Accept new applications",
                type: "checkbox",
              },
              {
                name: "requireDocuments",
                label: "Require document review",
                type: "checkbox",
              },
              {
                name: "requireSibling",
                label: "Require an existing sibling",
                type: "checkbox",
              },
              {
                name: "applicationFeeMinor",
                label: "Application fee preview",
                type: "number",
                factor: 100,
              },
            ]}
            onSave={async (value) => {
              await mutate(
                (current) =>
                  putRecord(
                    current,
                    "admissionForms",
                    admissionFormSchema.parse(value),
                  ),
                "Updated admission form settings",
              );
            }}
          />
        </Panel>
        <Panel
          title="Configured fields"
          action={
            <Button
              onClick={() =>
                setEditor(
                  <Dialog
                    title="Add form field"
                    onClose={() => setEditor(null)}
                  >
                    <DataForm
                      initial={{
                        id: crypto.randomUUID(),
                        label: "",
                        type: "text",
                        required: true,
                      }}
                      fields={[
                        { name: "label", label: "Field label" },
                        {
                          name: "options",
                          label: "Select choices (comma separated)",
                        },
                        {
                          name: "type",
                          label: "Input type",
                          type: "select",
                          options: enumOptions([
                            "text",
                            "email",
                            "phone",
                            "date",
                            "select",
                          ]),
                        },
                        {
                          name: "required",
                          label: "Required",
                          type: "checkbox",
                        },
                      ]}
                      onSave={async (value) => {
                        await mutate((current) => {
                          const latest = current.records.admissionForms.find(
                            (f) => f.id === form.id,
                          )!;
                          return putRecord(current, "admissionForms", {
                            ...latest,
                            fields: [...latest.fields, value],
                          });
                        }, "Added admission form field");
                        setEditor(null);
                      }}
                    />
                  </Dialog>,
                )
              }
            >
              + Add field
            </Button>
          }
        >
          <Table
            headers={["Field", "Type", "Required", "Actions"]}
            rows={form.fields.map((f) => [
              f.label,
              f.type,
              f.required ? "Yes" : "No",
              <div className="ws-actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditor(
                      <Dialog
                        title="Edit form field"
                        onClose={() => setEditor(null)}
                      >
                        <DataForm
                          initial={f}
                          fields={[
                            { name: "label", label: "Field label" },
                            {
                              name: "options",
                              label: "Select choices (comma separated)",
                            },
                            {
                              name: "required",
                              label: "Required",
                              type: "checkbox",
                            },
                          ]}
                          onSave={async (value) => {
                            await mutate((current) => {
                              const latest =
                                current.records.admissionForms.find(
                                  (v) => v.id === form.id,
                                )!;
                              return putRecord(current, "admissionForms", {
                                ...latest,
                                fields: latest.fields.map((field) =>
                                  field.id === f.id ? value : field,
                                ),
                              });
                            }, "Edited admission form field");
                            setEditor(null);
                          }}
                        />
                      </Dialog>,
                    )
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await mutate(
                        (current) =>
                          putRecord(current, "admissionForms", {
                            ...form,
                            fields: form.fields.filter((v) => v.id !== f.id),
                          }),
                        "Removed admission form field",
                      );
                    } catch (e) {
                      setError(readableError(e));
                    }
                  }}
                >
                  Remove
                </Button>
              </div>,
            ])}
          />
        </Panel>
        {error && (
          <p role="alert" className="config-errors">
            {error}
          </p>
        )}
        {editor}
      </>
    );
  }
  if (route === "/admissions")
    return (
      <>
        <header className="ws-page-header">
          <div>
            <h1>Admissions Management Hub</h1>
            <p>
              Track prospective candidates across the admissions lifecycle from
              enquiry intake to seat allotment and fee confirmation.
            </p>
          </div>
          <div className="ws-actions">
            <LinkButton href="/admissions/public-form">
              <DesignIcon group="admissions" name="imgContainer" />
              Public Form & QR
            </LinkButton>
            <ExportButton
              name="admissions-pipeline"
              rows={r.inquiries}
              report="admissions"
            />
            <LinkButton href="/admissions/inquiries/new" variant="default">
              <DesignIcon group="admissions" name="imgContainer2" />
              Log New Enquiry
            </LinkButton>
          </div>
        </header>
        <nav className="ws-tabs" aria-label="Admissions screens">
          {tabs.map(([href, label], i) => (
            <Link
              key={href}
              href={href}
              className={href === route ? "selected" : ""}
            >
              <DesignIcon group="admissions" name={`imgContainer${i + 3}`} />
              {label}
            </Link>
          ))}
        </nav>
        <Metrics
          items={[
            {
              label: "Total inquiries",
              value: r.inquiries.length,
              detail: `${r.inquiries.filter((v) => !v.counselorId).length} unassigned leads`,
              icon: <DesignIcon group="admissions" name="imgContainer11" />,
            },
            {
              label: "Applications filed",
              value: r.inquiries.filter((v) =>
                [
                  "application",
                  "assessment",
                  "offered",
                  "waitlisted",
                  "enrolled",
                ].includes(v.stage),
              ).length,
              icon: <DesignIcon group="admissions" name="imgContainer13" />,
            },
            {
              label: "Interviews & tests",
              value: r.inquiries.filter((v) => v.stage === "assessment").length,
              icon: <DesignIcon group="admissions" name="imgContainer14" />,
            },
            {
              label: "Offers rolled out",
              value: r.inquiries.filter((v) =>
                ["offered", "enrolled"].includes(v.stage),
              ).length,
              icon: <DesignIcon group="admissions" name="imgContainer15" />,
            },
            {
              label: "Confirmed enrolments",
              value: r.inquiries.filter((v) => v.stage === "enrolled").length,
              icon: <DesignIcon group="admissions" name="imgContainer16" />,
            },
          ]}
        />
        <div className="ws-filter-bar">
          <span>
            Use the header search to find an applicant, parent or enquiry ID.
          </span>
          <Select
            aria-label="Admissions stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">All stages</option>
            {enumOptions(Object.keys(nextStages)).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <LinkButton href="/admissions/inquiries">Manage inquiries</LinkButton>
        </div>
        {error && (
          <p className="config-errors" role="alert">
            {error}
          </p>
        )}
        <div className="ws-kanban-scroll">
          <div className="ws-kanban">
            {[
              ["NEW", ["new"]],
              ["CONTACTED", ["contacted"]],
              ["CAMPUS VISIT", ["campus_visit"]],
              ["APPLICATION ISSUED", ["application", "assessment"]],
              ["OFFERED / ACCEPTED", ["offered", "waitlisted", "enrolled"]],
              ["LOST / CLOSED", ["lost"]],
            ].map(([label, stages]) => (
              <section className="ws-kanban-column" key={String(label)}>
                <header>
                  <span>● {label}</span>
                  <Badge>
                    {
                      rows.filter((v) => (stages as string[]).includes(v.stage))
                        .length
                    }
                  </Badge>
                </header>
                {rows
                  .filter((v) => (stages as string[]).includes(v.stage))
                  .map((v) => (
                    <article className="ws-kanban-card" key={v.id}>
                      <small>
                        {v.id}
                        <Badge tone={v.stage === "enrolled" ? "green" : "blue"}>
                          {v.stage.replaceAll("_", " ")}
                        </Badge>
                      </small>
                      <h3>
                        <button onClick={() => edit(v)}>{v.studentName}</button>
                      </h3>
                      <p>
                        {labelFor(classes, v.classSectionId)} · {v.source}
                      </p>
                      <p>{v.notes}</p>
                      <footer>
                        <span>{labelFor(staff, v.counselorId)}</span>
                        <Button
                          variant="ghost"
                          onClick={() => edit(v, "Assign counselor")}
                        >
                          Assign / Edit →
                        </Button>
                        {v.stage === "offered" ? (
                          <LinkButton href={`/students/new?inquiry=${v.id}`}>
                            Enroll →
                          </LinkButton>
                        ) : (
                          nextStages[v.stage]?.[0] && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void move(v, nextStages[v.stage][0])
                              }
                            >
                              Move to{" "}
                              {nextStages[v.stage][0].replaceAll("_", " ")}
                            </Button>
                          )
                        )}
                      </footer>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </div>
        <h2 className="ws-section-note">Sub-Module Operational Telemetry</h2>
        <div className="ws-three-column">
          <Panel title="Online form builder">
            <div className="ws-panel-body">
              <Badge tone="green">
                {r.admissionForms[0].accepting ? "Open" : "Paused"}
              </Badge>
              <h3>{r.admissionForms[0].title}</h3>
              <p>{r.admissionForms[0].fields.length} configured fields</p>
              <LinkButton href="/admissions/form-builder">
                Edit schema →
              </LinkButton>
            </div>
          </Panel>
          <Panel title="Seat allotment health">
            <div className="ws-panel-body">
              {y.setup.classes.slice(0, 3).map((c) => {
                const count = y.setup.students.filter(
                  (s) => s.classSectionId === c.id&&!y.records.studentProfiles.some(p=>p.studentId===s.id&&p.status!=="active"),
                ).length;
                return (
                  <div key={c.id}>
                    Grade {c.grade} · {count}/{c.capacity}
                    <div className="ws-progress">
                      <span
                        style={{
                          width:
                            Math.min(100, (count / c.capacity) * 100) + "%",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <LinkButton href="/admissions/seats">
                Manage capacity →
              </LinkButton>
            </div>
          </Panel>
          <Panel title="Entrance tests">
            <div className="ws-panel-body">
              <Badge>
                {r.inquiries.filter((v) => v.stage === "assessment").length}{" "}
                candidates
              </Badge>
              <h3>Candidate evaluation & interview</h3>
              <LinkButton href="/admissions/assessments">
                View assessments →
              </LinkButton>
            </div>
          </Panel>
        </div>
        {editor}
      </>
    );
  return (
    <>
      <nav className="ws-tabs" aria-label="Admissions screens">
        {tabs.map(([href, label]) => (
          <Link
            key={href}
            className={href === route ? "selected" : ""}
            href={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="ws-actions">
        <LinkButton href="/admissions/inquiries/new" variant="default">
          + New enquiry
        </LinkButton>
        <ExportButton name="admissions" rows={rows} report="admissions" />
        <LinkButton href="/admissions/completion">Complete admission & continuation</LinkButton>
      </div>
      {error && (
        <p className="config-errors" role="alert">
          {error}
        </p>
      )}
      {route === "/admissions/seats" ? (
        <>
          <Metrics
            items={[
              {
                label: "Sanctioned seats",
                value: y.setup.classes.reduce((s, c) => s + c.capacity, 0),
              },
              { label: "Enrolled", value: y.setup.students.length },
              {
                label: "Waitlisted",
                value: r.inquiries.filter((v) => v.stage === "waitlisted")
                  .length,
              },
            ]}
          />
          <Panel title="Grade intake capacity">
            <Table
              headers={[
                "Cohort",
                "Enrolled / capacity",
                "Utilization",
                "Waitlisted",
                "Actions",
              ]}
              rows={y.setup.classes.map((c) => {
                const count = y.setup.students.filter(
                  (s) => s.classSectionId === c.id&&!y.records.studentProfiles.some(p=>p.studentId===s.id&&p.status!=="active"),
                ).length;
                return [
                  labelFor(classes, c.id),
                  `${count} / ${c.capacity}`,
                  <>
                    <Badge tone={count / c.capacity > 0.9 ? "red" : "green"}>
                      {Math.round((count / c.capacity) * 100)}%
                    </Badge>
                    <div className="ws-progress">
                      <span
                        style={{ width: (count / c.capacity) * 100 + "%" }}
                      />
                    </div>
                  </>,
                  r.inquiries.filter(
                    (i) =>
                      i.classSectionId === c.id && i.stage === "waitlisted",
                  ).length,
                  <LinkButton href="/school-setup/classes-sections">
                    Edit capacity
                  </LinkButton>,
                ];
              })}
            />
          </Panel>
          <Panel title="Prioritized waitlist">
            {inquiryTable(
              rows.filter((v) => v.stage === "waitlisted"),
              true,
            )}
          </Panel>
        </>
      ) : route === "/admissions/analytics" ? (
        <Panel title="Stage-by-stage conversion funnel">
          <div className="ws-panel-body">
            {[
              "new",
              "contacted",
              "application",
              "assessment",
              "offered",
              "enrolled",
            ].map((s, i) => {
              const count = r.inquiries.filter(
                (v) =>
                  [
                    "new",
                    "contacted",
                    "campus_visit",
                    "application",
                    "assessment",
                    "offered",
                    "waitlisted",
                    "enrolled",
                  ].indexOf(v.stage) >=
                    [
                      "new",
                      "contacted",
                      "campus_visit",
                      "application",
                      "assessment",
                      "offered",
                      "waitlisted",
                      "enrolled",
                    ].indexOf(s) && v.stage !== "lost",
              ).length;
              return (
                <div key={s}>
                  <h3>
                    {i + 1}. {s.replaceAll("_", " ")} · {count}
                  </h3>
                  <div className="ws-progress">
                    <span
                      style={{
                        width:
                          (r.inquiries.length
                            ? (count / r.inquiries.length) * 100
                            : 0) + "%",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p>
              Closed inquiries:{" "}
              {r.inquiries.filter((v) => v.stage === "lost").length}. Values are
              calculated from the saved pipeline.
            </p>
          </div>
        </Panel>
      ) : route === "/admissions/reenrolment" ? (
        <Panel title="Re-enrolment intent">
          <Table
            headers={["Student", "Current intent", "Notes", "Update"]}
            rows={y.setup.students
              .filter((v) =>
                v.displayName.toLowerCase().includes(search.toLowerCase()),
              )
              .map((student) => {
                const record = r.reenrolments.find(
                  (v) => v.studentId === student.id,
                ) ?? {
                  ...newRecord(y),
                  studentId: student.id,
                  intent: "pending",
                  note: "",
                };
                return [
                  student.displayName,
                  <Badge>{record.intent}</Badge>,
                  record.note,
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditor(
                        <RecordDialog
                          title="Re-enrolment intent"
                          collection="reenrolments"
                          initial={record}
                          fields={[
                            {
                              name: "intent",
                              label: "Intent",
                              type: "select",
                              options: enumOptions([
                                "pending",
                                "continue",
                                "withdraw",
                              ]),
                            },
                            { name: "note", label: "Notes", type: "textarea" },
                          ]}
                          onClose={() => setEditor(null)}
                        />,
                      )
                    }
                  >
                    Update intent
                  </Button>,
                ];
              })}
          />
        </Panel>
      ) : (
        <Panel
          title={
            route === "/admissions/assessments"
              ? "Candidate evaluation & interviews"
              : route === "/admissions/offers"
                ? "Offer & enrolment ledger"
                : route === "/admissions/applications"
                  ? "Applications register"
                  : "Active inquiry desk"
          }
        >
          {inquiryTable(
            rows.filter((v) =>
              route === "/admissions/applications"
                ? [
                    "application",
                    "assessment",
                    "offered",
                    "waitlisted",
                    "enrolled",
                  ].includes(v.stage)
                : route === "/admissions/assessments"
                  ? [
                      "application",
                      "assessment",
                      "waitlisted",
                      "offered",
                    ].includes(v.stage)
                  : route === "/admissions/offers"
                    ? ["offered", "enrolled", "waitlisted"].includes(v.stage)
                    : true,
            ),
            route === "/admissions/assessments" ||
              route === "/admissions/offers",
          )}
        </Panel>
      )}
      {editor}
    </>
  );
}
