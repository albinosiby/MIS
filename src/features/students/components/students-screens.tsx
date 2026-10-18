"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useSessionSelection } from "../../workspace/hooks/use-session-selection";
import { GuardianLinks } from "./guardian-links";
import { guardianContactSchema } from "@/shared/schemas/school-records";
import { identifierSchema } from "@/shared/schemas/primitives";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { WorkspaceScreenProps } from "../../workspace/components/workspace-screen";
import {
  Tabs,
  Panel,
  Metrics,
  Badge,
  Table,
  DataForm,
  RecordDialog,
  ConfirmAction,
  LinkButton,
  ExportButton,
  classOptions,
  studentOptions,
  labelFor,
  newRecord,
  enumOptions,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { IngestionEditor } from "../../school-setup";
import { QrCode } from "../../workspace/components/qr-code";
import {
  putRecord,
  mergeStudents,
  issueCertificate,
  scope,
} from "../../workspace/domain/operations";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema";
import { StudentEnrolment } from "./student-enrolment";
import { readableError } from "../../school-setup/components/form-errors";
const tabs = [
  ["/students", "Student Registry"],
  ["/students/guardians", "Guardians"],
  ["/students/promotions", "Promotion & Transfers"],
  ["/students/import", "Import & Migration"],
  ["/students/id-cards", "ID Cards"],
  ["/students/certificates", "Certificates & TC"],
  ["/students/transport", "Transport"],
  ["/students/merge", "Review & Merge"],
] as const;
export default function StudentsScreens({
  route,
  query,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState(""),
    [classId, setClassId] = useState("all");
  const [selected, setSelected] = useSessionSelection(
    `student-selection:${y.setup.school.id}:${y.setup.calendar.year.id}`,
    y.setup.students.map((s) => s.id),
  );
  const classes = classOptions(y),
    students = studentOptions(y);
  const rows = y.setup.students.filter(
    (s) =>
      (classId === "all" || s.classSectionId === classId) &&
      `${s.displayName} ${s.admissionNumber} ${y.setup.relationships
        .filter((r) => r.studentId === s.id)
        .map(
          (r) =>
            y.setup.guardians.find((g) => g.id === r.guardianId)?.displayName,
        )
        .join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function toggle(id: string) {
    setSelected((v) =>
      v.includes(id) ? v.filter((s) => s !== id) : [...v, id],
    );
  }
  const chosen = rows.filter(
    (s) => !selected.length || selected.includes(s.id),
  );
  function print() {
    window.print();
  }
  async function act(fn: () => Promise<void>) {
    try {
      await fn();
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  if (route === "/students/new")
    return <StudentEnrolment inquiryId={query.inquiry} />;
  if (route === "/students/import")
    return (
      <>
        <Tabs items={tabs} route={route} />
        <Panel title="Student import & migration">
          <div className="ws-panel-body">
            <IngestionEditor />
          </div>
        </Panel>
      </>
    );
  const currentStudent = query.id
    ? y.setup.students.find((s) => s.id === query.id)
    : rows[0];
  const profileFields: FormField[] = [
    { name: "dateOfBirth", label: "Date of birth", type: "date" },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: enumOptions(["Female", "Male", "Other", "Prefer not to say"]),
    },
    { name: "address", label: "Residential address", type: "textarea" },
    { name: "emergencyName", label: "Emergency contact" },
    { name: "emergencyPhone", label: "Emergency phone" },
    {
      name: "bloodGroup",
      label: "Blood group",
      type: "select",
      options: enumOptions([
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
        "Unknown",
      ]),
    },
    { name: "medicalNotes", label: "Medical notes", type: "textarea" },
    {
      name: "routeId",
      label: "Transport route",
      type: "select",
      options: y.records.routes.map((r) => ({ value: r.id, label: r.name })),
    },
    { name: "documents", label: "Documents", type: "files" },
  ];
  if (route === "/students/profile") {
    if (!currentStudent)
      return (
        <Panel title="Student not found">
          <p className="ws-empty">Choose a student from the registry.</p>
          <LinkButton href="/students">Student registry</LinkButton>
        </Panel>
      );
    const profile = y.records.studentProfiles.find(
      (p) => p.studentId === currentStudent.id,
    ) ?? {
      ...newRecord(y),
      studentId: currentStudent.id,
      dateOfBirth: "",
      gender: "Prefer not to say",
      address: "",
      emergencyName: "",
      emergencyPhone: "",
      bloodGroup: "Unknown",
      medicalNotes: "",
      routeId: null,
      status: "active",
      documents: [],
    };
    return (
      <>
        <div className="ws-profile-hero">
          <div className="ws-avatar">
            {currentStudent.displayName.slice(0, 1)}
          </div>
          <div>
            <h2>{currentStudent.displayName}</h2>
            <p>
              {currentStudent.admissionNumber} ·{" "}
              {labelFor(classes, currentStudent.classSectionId)}
            </p>
            <Badge tone="green">{profile.status}</Badge>
          </div>
          <LinkButton href="/students">← Student registry</LinkButton>
        </div>
        <div className="ws-two-column">
          <Panel title="Student identity & class">
            <DataForm
              key={currentStudent.id + y.setup.revision}
              initial={currentStudent}
              fields={[
                { name: "displayName", label: "Full name" },
                { name: "admissionNumber", label: "Admission number" },
                {
                  name: "classSectionId",
                  label: "Class & section",
                  type: "select",
                  options: classes,
                },
              ]}
              onSave={async (value) => {
                await mutate((current) => {
                  const next = {
                    ...current,
                    setup: {
                      ...current.setup,
                      students: current.setup.students.map((s) =>
                        s.id === currentStudent.id ? value : s,
                      ),
                      completed: current.setup.completed.slice(0, 6),
                      portal: {
                        ...current.setup.portal,
                        invitationsPrepared: false,
                        acknowledgeSimulation: false,
                      },
                    },
                  };
                  return schoolYearWorkspaceSchema.parse(next);
                }, "Updated student identity and class");
              }}
            />
            <Panel title="Demographics & emergency details">
              <DataForm
                key={profile.id + y.setup.revision}
                initial={profile}
                fields={profileFields}
                onSave={async (value) => {
                  await mutate(
                    (current) => putRecord(current, "studentProfiles", value),
                    "Updated student demographics and documents",
                  );
                }}
              />
            </Panel>
          </Panel>
          <div>
            <Panel title="Linked guardians">
              <div className="ws-panel-body">
                {y.setup.relationships
                  .filter((l) => l.studentId === currentStudent.id)
                  .map((l) => {
                    const g = y.setup.guardians.find(
                      (g) => g.id === l.guardianId,
                    )!;
                    return (
                      <div key={g.id}>
                        <h3>{g.displayName}</h3>
                        <p>
                          {g.email}
                          <br />
                          {g.phone}
                        </p>
                        <Badge>{l.relationship}</Badge>
                      </div>
                    );
                  })}
                <LinkButton href="/students/guardians">
                  Manage guardian links
                </LinkButton>
              </div>
            </Panel>
            <Panel title="Documents checklist">
              <div className="ws-panel-body">
                {profile.documents.length ? (
                  profile.documents.map((doc) => (
                    <p key={doc.id}>
                      {doc.name}{" "}
                      <Badge
                        tone={doc.status === "verified" ? "green" : "amber"}
                      >
                        {doc.status}
                      </Badge>
                    </p>
                  ))
                ) : (
                  <p>No documents attached.</p>
                )}
                <p className="ws-hint">
                  Upload and manage private file content in the document register.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <Tabs items={tabs} route={route} />
      <div className="ws-actions ws-print-hide">
        <LinkButton href="/students/new" variant="default">
          + Enroll New Student
        </LinkButton>
        <LinkButton href="/students/import">Import CSV</LinkButton>
        <ExportButton
          name="students"
          report="students"
          rows={chosen.map((s) => ({
            ...s,
            className: labelFor(classes, s.classSectionId),
          }))}
        />
        {(route === "/students/id-cards" ||
          route === "/students/certificates") && (
          <Button variant="outline" onClick={print}>
            Print / Save PDF
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="config-errors">
          {error}
        </p>
      )}
      {route === "/students/guardians" ? (
        <Panel
          title="Guardian directory & student links"
          action={
            <Button
              onClick={() =>
                setEditor(
                  <Dialog
                    title="Add guardian & link student"
                    onClose={() => setEditor(null)}
                  >
                    <DataForm
                      initial={{
                        id: crypto.randomUUID(),
                        schoolId: y.setup.school.id,
                        displayName: "",
                        email: "",
                        phone: "",
                        studentId: y.setup.students[0]?.id ?? "",
                      }}
                      fields={[
                        { name: "displayName", label: "Guardian full name" },
                        { name: "email", label: "Email" },
                        { name: "phone", label: "Phone (country code)" },
                        {
                          name: "studentId",
                          label: "Linked student",
                          type: "select",
                          options: students,
                        },
                      ]}
                      onSave={async (value) => {
                        const data = guardianContactSchema
                          .extend({ studentId: identifierSchema })
                          .parse(value);
                        await mutate(
                          (current) => ({
                            ...current,
                            setup: {
                              ...current.setup,
                              guardians: [
                                ...current.setup.guardians,
                                guardianContactSchema.parse({
                                  id: data.id,
                                  schoolId: data.schoolId,
                                  displayName: data.displayName,
                                  email: data.email,
                                  phone: data.phone,
                                }),
                              ],
                              relationships: [
                                ...current.setup.relationships,
                                {
                                  schoolId: data.schoolId,
                                  studentId: data.studentId,
                                  guardianId: data.id,
                                  relationship: "guardian",
                                  canViewRecords: true,
                                  canReceiveNotices: true,
                                },
                              ],
                            },
                          }),
                          "Added guardian and linked student",
                        );
                        setEditor(null);
                      }}
                    />
                  </Dialog>,
                )
              }
            >
              + Add guardian
            </Button>
          }
        >
          <Table
            headers={["Guardian", "Contact", "Linked students", "Actions"]}
            rows={y.setup.guardians
              .filter((g) =>
                `${g.displayName} ${g.email} ${g.phone}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((g) => [
                <strong>{g.displayName}</strong>,
                <>
                  {g.email}
                  <br />
                  {g.phone}
                </>,
                y.setup.relationships
                  .filter((l) => l.guardianId === g.id)
                  .map((l) => labelFor(students, l.studentId))
                  .join(", "),
                <>
                  {" "}
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditor(
                        <Dialog
                          title="Edit guardian contact"
                          onClose={() => setEditor(null)}
                        >
                          <DataForm
                            initial={g}
                            fields={[
                              { name: "displayName", label: "Full name" },
                              { name: "email", label: "Email" },
                              { name: "phone", label: "Phone" },
                            ]}
                            onSave={async (value) => {
                              const parsed = guardianContactSchema.parse(value);
                              await mutate(
                                (current) => ({
                                  ...current,
                                  setup: {
                                    ...current.setup,
                                    guardians: current.setup.guardians.map(
                                      (v) => (v.id === g.id ? parsed : v),
                                    ),
                                  },
                                }),
                                "Updated guardian contact",
                              );
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
                    variant="outline"
                    onClick={() =>
                      setEditor(
                        <GuardianLinks
                          guardianId={g.id}
                          onClose={() => setEditor(null)}
                        />,
                      )
                    }
                  >
                    Manage links
                  </Button>
                </>,
              ])}
          />
        </Panel>
      ) : route === "/students/transport" ? (
        <>
          <Panel
            title="Bus routes & capacity"
            action={
              <Button
                onClick={() =>
                  setEditor(
                    <RecordDialog
                      title="Add bus route"
                      collection="routes"
                      initial={{
                        ...newRecord(y),
                        name: "",
                        vehicle: "",
                        capacity: 40,
                        stops: [
                          {
                            id: crypto.randomUUID(),
                            name: "Campus",
                            time: "08:00",
                          },
                        ],
                      }}
                      fields={[
                        { name: "name", label: "Route name" },
                        { name: "vehicle", label: "Vehicle registration" },
                        { name: "capacity", label: "Capacity", type: "number" },
                        { name: "stops.0.name", label: "First stop" },
                        {
                          name: "stops.0.time",
                          label: "Pickup time",
                          type: "time",
                        },
                      ]}
                      onClose={() => setEditor(null)}
                    />,
                  )
                }
              >
                + Add route
              </Button>
            }
          >
            <Table
              headers={["Route / vehicle", "Capacity", "Stops", "Actions"]}
              rows={y.records.routes.map((r) => [
                <>
                  {r.name}
                  <br />
                  {r.vehicle}
                </>,
                `${y.records.studentProfiles.filter((p) => p.routeId === r.id && p.status === "active").length}/${r.capacity}`,
                r.stops.map((s) => `${s.name} ${s.time}`).join(" → "),
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditor(
                      <RecordDialog
                        title="Edit bus route"
                        collection="routes"
                        initial={r}
                        fields={[
                          { name: "name", label: "Route name" },
                          { name: "vehicle", label: "Vehicle" },
                          {
                            name: "capacity",
                            label: "Capacity",
                            type: "number",
                          },
                          ...r.stops.flatMap((_, i) => [
                            { name: `stops.${i}.name`, label: `Stop ${i + 1}` },
                            {
                              name: `stops.${i}.time`,
                              label: "Time",
                              type: "time" as const,
                            },
                          ]),
                        ]}
                        onClose={() => setEditor(null)}
                      />,
                    )
                  }
                >
                  Edit route
                </Button>,
              ])}
            />
          </Panel>
          <p className="ws-section-note">
            Assign transport in each student profile. Capacity is checked across
            all active students.
          </p>
        </>
      ) : route === "/students/merge" ? (
        <Panel title="Review & merge duplicate records">
          <div className="ws-panel-body">
            <p>
              Select the retained and duplicate students. Operational history is
              protected; the blocks merges that would discard existing
              attendance, marks, invoices or certificates.
            </p>
            <DataForm
              initial={{
                primaryId: y.setup.students[0]?.id,
                duplicateId: "",
                confirmed: false,
              }}
              fields={[
                {
                  name: "primaryId",
                  label: "Retain student",
                  type: "select",
                  options: students,
                },
                {
                  name: "duplicateId",
                  label: "Duplicate student",
                  type: "select",
                  options: students,
                },
                {
                  name: "confirmed",
                  label:
                    "I reviewed both records and want to merge their guardian links",
                  type: "checkbox",
                },
              ]}
              submitLabel="Review & merge"
              onSave={async (value) => {
                const data = z
                  .object({
                    primaryId: identifierSchema,
                    duplicateId: identifierSchema,
                    confirmed: z.literal(true),
                  })
                  .parse(value);
                await mutate(
                  (current) =>
                    mergeStudents(current, data.primaryId, data.duplicateId),
                  "Merged duplicate student guardian links",
                );
              }}
            />
          </div>
        </Panel>
      ) : route === "/students/promotions" ? (
        <>
          <Panel
            title="Promotion & transfer directives"
            action={
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    mutate(
                      (current) => ({
                        ...current,
                        records: {
                          ...current.records,
                          promotions: [
                            ...current.records.promotions,
                            ...current.setup.students
                              .filter(
                                (s) =>
                                  !current.records.promotions.some(
                                    (p) => p.studentId === s.id,
                                  ) &&
                                  current.records.studentProfiles.some(
                                    (p) =>
                                      p.studentId === s.id &&
                                      p.status === "active",
                                  ),
                              )
                              .map((s) => ({
                                ...newRecord(current),
                                studentId: s.id,
                                targetClassId: s.classSectionId,
                                decision: "retain" as const,
                                note: "Prepared for individual review; retain current cohort.",
                              })),
                          ],
                        },
                      }),
                      "Prepared retention directives for review",
                    ),
                  )
                }
              >
                Prepare missing retention directives
              </Button>
            }
          >
            <Table
              headers={["Student", "Current cohort", "Directive", "Actions"]}
              rows={rows.map((student) => {
                const directive = y.records.promotions.find(
                  (p) => p.studentId === student.id,
                );
                return [
                  student.displayName,
                  labelFor(classes, student.classSectionId),
                  directive
                    ? `${directive.decision} → ${labelFor(classes, directive.targetClassId)}`
                    : "Not configured",
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditor(
                        <RecordDialog
                          title="Promotion directive"
                          collection="promotions"
                          initial={
                            directive ?? {
                              ...newRecord(y),
                              studentId: student.id,
                              targetClassId: student.classSectionId,
                              decision: "retain",
                              note: "",
                            }
                          }
                          fields={[
                            {
                              name: "targetClassId",
                              label: "Target cohort",
                              type: "select",
                              options: classes,
                            },
                            {
                              name: "decision",
                              label: "Decision",
                              type: "select",
                              options: enumOptions([
                                "promote",
                                "retain",
                                "transfer",
                              ]),
                            },
                            {
                              name: "note",
                              label: "Review notes",
                              type: "textarea",
                            },
                          ]}
                          onClose={() => setEditor(null)}
                        />,
                      )
                    }
                  >
                    Configure
                  </Button>,
                ];
              })}
            />
          </Panel>
          <div className="ws-actions">
            <p className="ws-hint">
              Directives are applied when the new academic year is created.
              Current-year classes and their operational history are retained.
            </p>
            <LinkButton href="/settings/year-end">Year-end rollover</LinkButton>
          </div>
        </>
      ) : route === "/students/certificates" ? (
        <>
          <Panel
            title="Certificate issue register"
            action={
              <Button
                onClick={() =>
                  setEditor(
                    <RecordDialog
                      title="Prepare certificate"
                      collection="certificates"
                      initial={{
                        ...newRecord(y),
                        studentId: y.setup.students[0]?.id,
                        type: "Bonafide",
                        issuedOn: y.setup.calendar.year.startDate,
                        status: "draft",
                        reference: `CERT-${Date.now()}`,
                      }}
                      fields={[
                        {
                          name: "studentId",
                          label: "Student",
                          type: "select",
                          options: students,
                        },
                        {
                          name: "type",
                          label: "Certificate type",
                          type: "select",
                          options: enumOptions([
                            "Bonafide",
                            "Transfer Certificate",
                            "Study Certificate",
                            "ID Card",
                          ]),
                        },
                        { name: "issuedOn", label: "Issue date", type: "date" },
                      ]}
                      onClose={() => setEditor(null)}
                    />,
                  )
                }
              >
                + Prepare certificate
              </Button>
            }
          >
            <Table
              headers={["Reference", "Student", "Type / status", "Actions"]}
              rows={y.records.certificates.map((c) => [
                c.reference,
                labelFor(students, c.studentId),
                <>
                  {c.type}
                  <br />
                  <Badge tone={c.status === "issued" ? "green" : "amber"}>
                    {c.status}
                  </Badge>
                </>,
                <div className="ws-actions">
                  {c.status === "draft" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void act(() =>
                          mutate(
                            (current) => issueCertificate(current, c.id),
                            "Issued certificate",
                          ),
                        )
                      }
                    >
                      Issue certificate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setSelected([c.studentId])}
                  >
                    Preview
                  </Button>
                </div>,
              ])}
            />
          </Panel>
          {y.records.certificates
            .filter((c) => !selected.length || selected.includes(c.studentId))
            .map((c) => (
              <article className="ws-letterhead" key={c.id}>
                <h3>{y.setup.school.name.toUpperCase()}</h3>
                <p style={{ textAlign: "center" }}>
                  {y.setup.school.address.line1}, {y.setup.school.address.city}
                  <br />
                  Affiliation: {y.setup.school.affiliationNumber}
                </p>
                <hr />
                <p>
                  Ref: {c.reference} · Date: {c.issuedOn}
                </p>
                <h3>{c.type.toUpperCase()}</h3>
                <p>
                  This is to certify that {labelFor(students, c.studentId)} is
                  recorded in {y.setup.calendar.year.name}. This document is a
                  workspace preview.
                </p>
                <div className="ws-stamp">
                  {y.setup.staff[0].displayName}
                  <br />
                  Principal · {c.status === "issued" ? "issued" : "Draft"}
                </div>
              </article>
            ))}
        </>
      ) : route === "/students/id-cards" ? (
        <>
          <div className="ws-filter-bar">
            <Select
              aria-label="ID card cohort"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="all">All cohorts</option>
              {classes.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <p>All matching cards are included in the print preview.</p>
          </div>
          <div className="ws-three-column">
            {chosen.map((s) => (
              <Panel key={s.id} title={y.setup.school.shortName}>
                <div className="ws-panel-body">
                  <h3>{s.displayName}</h3>
                  <p>
                    {s.admissionNumber}
                    <br />
                    {labelFor(classes, s.classSectionId)}
                    <br />
                    {y.setup.calendar.year.name}
                  </p>
                  <QrCode
                    value={
                      typeof window === "undefined"
                        ? s.id
                        : window.location.origin +
                          `/students/profile?id=${s.id}`
                    }
                    label={`Student ID ${s.admissionNumber}`}
                  />
                </div>
              </Panel>
            ))}
          </div>
        </>
      ) : (
        <>
          <Metrics
            items={[
              { label: "Total enrolled", value: y.setup.students.length },
              {
                label: "Active students",
                value: y.setup.students.filter(
                  (s) =>
                    !y.records.studentProfiles.some(
                      (p) => p.studentId === s.id && p.status !== "active",
                    ),
                ).length,
              },
              { label: "Linked guardians", value: y.setup.guardians.length },
              {
                label: "Documents pending",
                value: y.records.studentProfiles.filter((p) =>
                  p.documents.some((d) => d.status === "pending"),
                ).length,
              },
            ]}
          />
          <div className="ws-filter-bar">
            <Select
              aria-label="Student cohort"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="all">All cohorts</option>
              {classes.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Badge>{selected.length} selected</Badge>
            <Button
              variant="outline"
              onClick={() => setSelected(rows.map((s) => s.id))}
            >
              Select matching
            </Button>
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear selection
            </Button>
          </div>
          <Panel title="Master student registry">
            <Table
              headers={[
                "Select",
                "Student name & identity",
                "GRN / roll",
                "Class & section",
                "Primary guardian",
                "Status",
                "Actions",
              ]}
              rows={rows.map((s) => {
                const guardian = y.setup.guardians.find(
                    (g) =>
                      g.id ===
                      y.setup.relationships.find((l) => l.studentId === s.id)
                        ?.guardianId,
                  ),
                  profile = y.records.studentProfiles.find(
                    (p) => p.studentId === s.id,
                  );
                return [
                  <input
                    type="checkbox"
                    aria-label={`Select ${s.displayName}`}
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />,
                  <Link
                    className="ws-row-link"
                    href={`/students/profile?id=${s.id}`}
                  >
                    {s.displayName}
                  </Link>,
                  s.admissionNumber,
                  labelFor(classes, s.classSectionId),
                  guardian?.displayName ?? "Not linked",
                  <Badge
                    tone={profile?.status === "transferred" ? "gray" : "green"}
                  >
                    {profile?.status ?? "active"}
                  </Badge>,
                  <LinkButton href={`/students/profile?id=${s.id}`}>
                    View / edit
                  </LinkButton>,
                ];
              })}
            />
          </Panel>
        </>
      )}
      {editor}
    </>
  );
}
