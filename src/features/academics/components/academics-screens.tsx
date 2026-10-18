"use client";
import { useState, type ReactNode } from "react";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
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
  LinkButton,
  ExportButton,
  classOptions,
  staffOptions,
  subjectOptions,
  studentOptions,
  labelFor,
  newRecord,
  enumOptions,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { scope, putRecord } from "../../workspace/domain/operations";
import { homeworkSchema, lessonPlanSchema } from "../schemas/academics.schema";
const tabs = [
  ["/academics", "Homework & Assignments"],
  ["/academics/subjects", "Subjects & Faculty"],
  ["/academics/syllabus", "Syllabus & Curriculum"],
  ["/academics/lessons", "Lesson Plans"],
] as const;
export default function AcademicsScreens({
  route,
  query,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate } = useWorkspace();
  const router = useRouter();
  const [editor, setEditor] = useState<ReactNode>(null),
    [homeworkId, setHomeworkId] = useState(
      query.id ?? y.records.homework[0]?.id ?? "",
    );
  const classes = classOptions(y),
    staff = staffOptions(y),
    subjects = subjectOptions(y),
    students = studentOptions(y);
  const date = academicReferenceDate(y.setup.calendar.year, "10-18");
  const unitFields: FormField[] = [
    { name: "title", label: "Unit title" },
    { name: "subjectId", label: "Subject", type: "select", options: subjects },
    {
      name: "classSectionId",
      label: "Class & section",
      type: "select",
      options: classes,
    },
    { name: "description", label: "Learning outcomes", type: "textarea" },
    {
      name: "plannedPeriods",
      label: "Planned teaching periods",
      type: "number",
    },
    { name: "completedPeriods", label: "Completed periods", type: "number" },
  ];
  const lessonFields: FormField[] = [
    { name: "title", label: "Lesson title" },
    {
      name: "unitId",
      label: "Curriculum unit",
      type: "select",
      options: y.records.units.map((u) => ({
        value: u.id,
        label: `${u.title} · ${labelFor(classes, u.classSectionId)}`,
      })),
    },
    { name: "staffId", label: "Teacher", type: "select", options: staff },
    { name: "date", label: "Planned date", type: "date" },
    {
      name: "objectives",
      label: "Objectives, activities & assessment",
      type: "textarea",
    },
  ];
  const homeworkFields: FormField[] = [
    { name: "title", label: "Homework title" },
    {
      name: "classSectionId",
      label: "Target cohort",
      type: "select",
      options: classes,
    },
    { name: "subjectId", label: "Subject", type: "select", options: subjects },
    { name: "staffId", label: "Assigned by", type: "select", options: staff },
    { name: "instructions", label: "Instructions", type: "textarea" },
    { name: "dueDate", label: "Due date", type: "date" },
    { name: "maxScore", label: "Maximum score", type: "number" },
    { name: "attachments", label: "Worksheets / attachments", type: "files" },
  ];
  if (route === "/academics/lessons/new")
    return (
      <Panel title="Create curriculum-aligned lesson plan">
        <DataForm
          initial={{
            ...newRecord(y),
            unitId: y.records.units[0]?.id ?? "",
            staffId: y.setup.staff[1]?.id ?? y.setup.staff[0].id,
            title: "",
            date,
            objectives: "",
            status: "draft",
          }}
          fields={lessonFields}
          onSave={async (value) => {
            const data = lessonPlanSchema.parse(value);
            await mutate(
              (current) => putRecord(current, "lessons", data),
              "Created lesson plan",
            );
            router.push("/academics/lessons");
          }}
          submitLabel="Save lesson plan"
        />
      </Panel>
    );
  if (route === "/academics/homework/new")
    return (
      <Panel title="Create & assign homework">
        <DataForm
          initial={{
            ...newRecord(y),
            title: "",
            classSectionId: y.setup.classes[0].id,
            subjectId: y.records.subjects[0]?.id ?? "",
            staffId: y.setup.staff[1]?.id ?? y.setup.staff[0].id,
            instructions: "",
            dueDate: date,
            maxScore: 20,
            attachments: [],
          }}
          fields={homeworkFields}
          onSave={async (value) => {
            const hw = homeworkSchema.parse(value);
            await mutate((current) => {
              const next = putRecord(current, "homework", hw);
              return {
                ...next,
                records: {
                  ...next.records,
                  submissions: [
                    ...next.records.submissions,
                    ...next.setup.students
                      .filter(
                        (s) =>
                          s.classSectionId === hw.classSectionId &&
                          !next.records.studentProfiles.some(
                            (p) =>
                              p.studentId === s.id && p.status !== "active",
                          ),
                      )
                      .map((s) => ({
                        ...scope(next),
                        id: crypto.randomUUID(),
                        homeworkId: hw.id,
                        studentId: s.id,
                        status: "pending" as const,
                              answer: "",
                        score: null,
                        feedback: "",
                      })),
                  ],
                },
              };
            }, "Assigned homework to class roster");
            router.push("/academics");
          }}
          submitLabel="Create & assign homework"
        />
      </Panel>
    );
  if (route === "/academics/submissions") {
    const hw = y.records.homework.find((h) => h.id === homeworkId);
    return (
      <>
        <div className="ws-filter-bar">
          <Select
            aria-label="Homework task"
            value={homeworkId}
            onChange={(e) => setHomeworkId(e.target.value)}
          >
            {y.records.homework.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
              </option>
            ))}
          </Select>
          <LinkButton href="/academics">← Homework hub</LinkButton>
        </div>
        <Panel
          title={
            hw
              ? `${hw.title} · Submissions & grading`
              : "Choose a homework task"
          }
        >
          <Table
            headers={["Student", "Submission", "Score", "Feedback", "Actions"]}
            rows={y.records.submissions
              .filter(
                (s) =>
                  s.homeworkId === homeworkId &&
                  labelFor(students, s.studentId)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((s) => [
                labelFor(students, s.studentId),
                <Badge
                  tone={
                    s.status === "graded"
                      ? "green"
                      : s.status === "submitted"
                        ? "blue"
                        : "amber"
                  }
                >
                  {s.status}
                </Badge>,
                s.score === null ? "—" : `${s.score}/${hw?.maxScore}`,
                s.feedback || "—",
                <div className="ws-actions">
                  {s.status === "pending" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void mutate(
                          (current) =>
                            putRecord(current, "submissions", {
                              ...s,
                              status: "submitted",
                            }),
                          "Recorded homework submission",
                        ).catch(() => {})
                      }
                    >
                      Mark submitted
                    </Button>
                  )}
                  {s.status !== "pending" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setEditor(
                          <RecordDialog
                            title="Grade homework submission"
                            collection="submissions"
                            initial={{
                              ...s,
                              status: "graded",
                              score: s.score ?? 0,
                            }}
                            fields={[
                              {
                                name: "score",
                                label: `Score (max ${hw?.maxScore})`,
                                type: "number",
                              },
                              {
                                name: "feedback",
                                label: "Feedback",
                                type: "textarea",
                              },
                            ]}
                            onClose={() => setEditor(null)}
                          />,
                        )
                      }
                    >
                      Grade / feedback
                    </Button>
                  )}
                </div>,
              ])}
          />
        </Panel>
        {editor}
      </>
    );
  }
  return (
    <>
      <Tabs items={tabs} route={route} />
      <div className="ws-actions">
        <LinkButton href="/academics/lessons/new">
          Create lesson plan
        </LinkButton>
        <LinkButton href="/academics/homework/new" variant="default">
          + Create & Assign Homework
        </LinkButton>
        <ExportButton
          name="academics"
          report="marks"
          rows={
            route === "/academics/subjects"
              ? y.records.subjects
              : route === "/academics/syllabus"
                ? y.records.units
                : route === "/academics/lessons"
                  ? y.records.lessons
                  : y.records.homework
          }
        />
      </div>
      {route === "/academics/subjects" ? (
        <Panel
          title="Subjects & faculty allocation"
          action={
            <Button
              onClick={() =>
                setEditor(
                  <RecordDialog
                    title="Add subject"
                    collection="subjects"
                    initial={{
                      ...newRecord(y),
                      name: "",
                      code: "",
                      maxMarks: 100,
                    }}
                    fields={[
                      { name: "name", label: "Subject name" },
                      { name: "code", label: "Subject code" },
                      {
                        name: "maxMarks",
                        label: "Default maximum marks",
                        type: "number",
                      },
                    ]}
                    onClose={() => setEditor(null)}
                  />,
                )
              }
            >
              + Add subject
            </Button>
          }
        >
          <Table
            headers={[
              "Subject / code",
              "Default maximum",
              "Allocated faculty",
              "Actions",
            ]}
            rows={y.records.subjects
              .filter((s) =>
                `${s.name} ${s.code}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => [
                <>
                  {s.name}
                  <br />
                  <small>{s.code}</small>
                </>,
                s.maxMarks,
                y.setup.allocations
                  .filter((a) => a.subject === s.name)
                  .map((a) => labelFor(staff, a.staffId))
                  .join(", ") || "Not allocated",
                <div className="ws-actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditor(
                        <RecordDialog
                          title="Edit subject"
                          collection="subjects"
                          initial={s}
                          fields={[
                            { name: "name", label: "Subject name" },
                            { name: "code", label: "Subject code" },
                            {
                              name: "maxMarks",
                              label: "Default maximum",
                              type: "number",
                            },
                          ]}
                          onClose={() => setEditor(null)}
                        />,
                      )
                    }
                  >
                    Edit subject
                  </Button>
                  <LinkButton href="/staff/allocations">
                    Allocate faculty
                  </LinkButton>
                </div>,
              ])}
          />
        </Panel>
      ) : route === "/academics/syllabus" ? (
        <Panel
          title="Syllabus units & curriculum pacing"
          action={
            <Button
              onClick={() =>
                setEditor(
                  <RecordDialog
                    title="Add curriculum unit"
                    collection="units"
                    initial={{
                      ...newRecord(y),
                      subjectId: y.records.subjects[0]?.id ?? "",
                      classSectionId: y.setup.classes[0].id,
                      title: "",
                      description: "",
                      plannedPeriods: 12,
                      completedPeriods: 0,
                    }}
                    fields={unitFields}
                    onClose={() => setEditor(null)}
                  />,
                )
              }
            >
              + Add unit
            </Button>
          }
        >
          <Table
            headers={[
              "Unit / outcome",
              "Subject / class",
              "Planned / completed",
              "Pacing",
              "Actions",
            ]}
            rows={y.records.units
              .filter((u) =>
                u.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((u) => [
                <>
                  {u.title}
                  <br />
                  <small>{u.description}</small>
                </>,
                <>
                  {labelFor(subjects, u.subjectId)}
                  <br />
                  {labelFor(classes, u.classSectionId)}
                </>,
                `${u.completedPeriods}/${u.plannedPeriods}`,
                <div className="ws-progress">
                  <span
                    style={{
                      width:
                        (u.completedPeriods / u.plannedPeriods) * 100 + "%",
                    }}
                  />
                </div>,
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditor(
                      <RecordDialog
                        title="Edit syllabus unit"
                        collection="units"
                        initial={u}
                        fields={unitFields}
                        onClose={() => setEditor(null)}
                      />,
                    )
                  }
                >
                  Update unit
                </Button>,
              ])}
          />
        </Panel>
      ) : route === "/academics/lessons" ? (
        <Panel title="Lesson plans & approval workflow">
          <Table
            headers={[
              "Lesson / planned date",
              "Curriculum unit",
              "Teacher",
              "Status",
              "Actions",
            ]}
            rows={y.records.lessons
              .filter((l) =>
                `${l.title} ${l.objectives}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((l) => [
                <>
                  {l.title}
                  <br />
                  {l.date}
                </>,
                y.records.units.find((u) => u.id === l.unitId)?.title,
                labelFor(staff, l.staffId),
                <Badge
                  tone={
                    l.status === "approved"
                      ? "green"
                      : l.status === "returned"
                        ? "amber"
                        : "blue"
                  }
                >
                  {l.status}
                </Badge>,
                <div className="ws-actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditor(
                        <RecordDialog
                          title="Edit lesson plan"
                          collection="lessons"
                          initial={l}
                          fields={lessonFields}
                          onClose={() => setEditor(null)}
                        />,
                      )
                    }
                  >
                    Edit
                  </Button>
                  {(l.status === "draft" || l.status === "returned") && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void mutate(
                          (current) =>
                            putRecord(current, "lessons", {
                              ...l,
                              status: "submitted",
                            }),
                          "Submitted lesson plan for review",
                        ).catch(() => {})
                      }
                    >
                      Submit
                    </Button>
                  )}
                  {l.status === "submitted" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void mutate(
                            (current) =>
                              putRecord(current, "lessons", {
                                ...l,
                                status: "approved",
                              }),
                            "Approved lesson plan",
                          ).catch(() => {})
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void mutate(
                            (current) =>
                              putRecord(current, "lessons", {
                                ...l,
                                status: "returned",
                              }),
                            "Returned lesson plan for revision",
                          ).catch(() => {})
                        }
                      >
                        Return
                      </Button>
                    </>
                  )}
                </div>,
              ])}
          />
        </Panel>
      ) : (
        <>
          <Metrics
            items={[
              { label: "Active homework", value: y.records.homework.length },
              {
                label: "Syllabus pace",
                value: `${Math.round(
                  (y.records.units.reduce((s, u) => s + u.completedPeriods, 0) /
                    Math.max(
                      1,
                      y.records.units.reduce((s, u) => s + u.plannedPeriods, 0),
                    )) *
                    100,
                )}%`,
              },
              {
                label: "Lesson plans awaiting review",
                value: y.records.lessons.filter((l) => l.status === "submitted")
                  .length,
              },
              {
                label: "Submissions graded",
                value: y.records.submissions.filter(
                  (s) => s.status === "graded",
                ).length,
              },
            ]}
          />
          <div className="ws-two-column">
            <Panel title="Homework & assignments">
              <Table
                headers={[
                  "Homework",
                  "Cohort / subject",
                  "Due date",
                  "Submissions",
                  "Actions",
                ]}
                rows={y.records.homework
                  .filter((h) =>
                    h.title.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((h) => [
                    <>
                      {h.title}
                      <br />
                      <small>{h.instructions}</small>
                    </>,
                    <>
                      {labelFor(classes, h.classSectionId)}
                      <br />
                      {labelFor(subjects, h.subjectId)}
                    </>,
                    h.dueDate,
                    `${y.records.submissions.filter((s) => s.homeworkId === h.id && s.status !== "pending").length}/${y.records.submissions.filter((s) => s.homeworkId === h.id).length}`,
                    <div className="ws-actions">
                      <LinkButton href={`/academics/submissions?id=${h.id}`}>
                        View submissions
                      </LinkButton>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setEditor(
                            <RecordDialog
                              title="Edit assigned homework"
                              collection="homework"
                              initial={h}
                              fields={homeworkFields.filter(
                                (f) =>
                                  ![
                                    "classSectionId",
                                    "subjectId",
                                    "staffId",
                                  ].includes(f.name),
                              )}
                              onClose={() => setEditor(null)}
                            />,
                          )
                        }
                      >
                        Edit task
                      </Button>
                    </div>,
                  ])}
              />
            </Panel>
            <div>
              <Panel title="Syllabus readiness">
                <div className="ws-panel-body">
                  {y.records.units.slice(0, 4).map((u) => (
                    <div key={u.id}>
                      <h3>{u.title}</h3>
                      <div className="ws-progress">
                        <span
                          style={{
                            width:
                              (u.completedPeriods / u.plannedPeriods) * 100 +
                              "%",
                          }}
                        />
                      </div>
                      <small>
                        {u.completedPeriods}/{u.plannedPeriods} periods
                      </small>
                    </div>
                  ))}
                  <LinkButton href="/academics/syllabus">
                    Manage curriculum
                  </LinkButton>
                </div>
              </Panel>
              <Panel title="Lesson plan approvals">
                <div className="ws-panel-body">
                  <p>
                    {
                      y.records.lessons.filter((l) => l.status === "submitted")
                        .length
                    }{" "}
                    lesson plans require review.
                  </p>
                  <LinkButton href="/academics/lessons">
                    Review plans →
                  </LinkButton>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
      {editor}
    </>
  );
}
