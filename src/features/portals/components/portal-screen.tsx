"use client";
import { LearningProgressPanel } from "../../learning/components/learning-progress-panel";
import { ConversationInbox } from "../../communication/components/conversation-inbox";
import { canReadPortalNotice } from "../domain/notice-access";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useBackend } from "../../identity/components/identity-context";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { AccountIdentity } from "../../identity/models";
import { scopedStudentIds } from "../../operations/domain/operations";
import { CollectionScreen } from "../../operations/components/collection-screen";
import { definition } from "../../operations/data/module-definitions";
import {
  DataForm,
  Table,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { balance, scope } from "../../workspace/domain/operations";
import {
  createTeacherWork,
  submitTeacherLesson,
  requestPortalLeave,
  submitPortalHomework,
  savePortalAttendance,
  gradePortalSubmission,
  savePortalMark,
  acknowledgePortalNotice,
} from "../domain/portal-operations";
export function PortalScreen({
  actor,
  section,
}: {
  actor: AccountIdentity;
  section: string;
}) {
  const { year: y, mutate, busy } = useWorkspace();
  const cloud = useBackend() === "supabase";
  const ids = scopedStudentIds(y, actor);
  const [child, setChild] = useState(ids[0] ?? ""),
    [editor, setEditor] = useState<ReactNode>(null),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [attendanceDate, setAttendanceDate] = useState(
      academicReferenceDate(y.setup.calendar.year),
    ),
    [classId, setClassId] = useState(
      y.setup.allocations.find((a) => a.staffId === actor.personId)
        ?.classSectionId ?? "",
    ),
    [marks, setMarks] = useState<Record<string, string>>({});
  const family = ["parent", "student"].includes(actor.role);
  const student = y.setup.students.find(
    (s) => s.id === (ids.includes(child) ? child : ids[0]),
  );
  const students = y.setup.students.filter((s) =>
    family
      ? s.id === student?.id
      : actor.role === "teacher" && ids.includes(s.id),
  );
  const ownIds = students.map((s) => s.id);
  const classes = family
    ? [student?.classSectionId ?? ""]
    : actor.role === "teacher"
      ? y.setup.allocations
          .filter((a) => a.staffId === actor.personId)
          .map((a) => a.classSectionId)
      : [];
  const title =
    section === "overview"
      ? `Welcome, ${actor.name.split(" ")[0]}`
      : section.replaceAll("-", " ");
  const portal = actor.role === "staff" ? "staff-portal" : actor.role;
  async function run(
    update: (v: typeof y) => typeof y,
    action: string,
    command?: unknown,
  ) {
    setError("");
    try {
      await mutate(update, action, command);
      setFeedback("Changes saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }
  function leave() {
    const people = family
      ? students.map((s) => ({ value: s.id, label: s.displayName }))
      : y.setup.staff
          .filter((s) => s.id === actor.personId)
          .map((s) => ({ value: s.id, label: s.displayName }));
    setEditor(
      <Dialog title="Request leave" onClose={() => setEditor(null)}>
        <DataForm
          initial={{
            personId: people[0]?.value ?? "",
            startDate: academicReferenceDate(y.setup.calendar.year),
            endDate: academicReferenceDate(y.setup.calendar.year),
            reason: "",
            ...(!family
              ? {
                  leaveType:
                    y.workflows.payrollPolicy.leaveTypes[0]?.name ??
                    "Casual leave",
                }
              : {}),
          }}
          fields={[
            { name: "personId", label: "For", type: "select", options: people },
            ...(!family
              ? [
                  {
                    name: "leaveType",
                    label: "Leave type",
                    type: "select" as const,
                    options: y.workflows.payrollPolicy.leaveTypes.map((t) => ({
                      value: t.name,
                      label: `${t.name} · ${t.annualDays} days · ${t.paid ? "paid" : "unpaid"}`,
                    })),
                  },
                ]
              : []),
            { name: "startDate", label: "From", type: "date" },
            { name: "endDate", label: "Until", type: "date" },
            { name: "reason", label: "Reason", type: "textarea" },
          ]}
          onSave={async (v) => {
            await mutate(
              (c) => requestPortalLeave(c, actor, v),
              "Portal: request leave",
              { type: "leave", input: v },
            );
            setEditor(null);
            setFeedback("Leave request submitted for school review.");
          }}
        />
      </Dialog>,
    );
  }
  function teacherCreate(kind: "homework" | "lessons") {
    const assigned = y.setup.classes.filter((c) => classes.includes(c.id));
    const assignedSubjects = y.records.subjects.filter((s) =>
      y.setup.allocations.some(
        (a) => a.staffId === actor.personId && a.subject === s.name,
      ),
    );
    const assignedUnits = y.records.units.filter((u) => {
      const subject = y.records.subjects.find((s) => s.id === u.subjectId);
      return y.setup.allocations.some(
        (a) =>
          a.staffId === actor.personId &&
          a.classSectionId === u.classSectionId &&
          a.subject === subject?.name,
      );
    });
    const common = {
      ...scope(y),
      id: crypto.randomUUID(),
      staffId: actor.personId,
      title: "",
    };
    const initial =
      kind === "homework"
        ? {
            ...common,
            classSectionId: assigned[0]?.id ?? "",
            subjectId: assignedSubjects[0]?.id ?? "",
            instructions: "",
            dueDate: academicReferenceDate(y.setup.calendar.year),
            maxScore: 10,
            attachments: [],
          }
        : {
            ...common,
            unitId: assignedUnits[0]?.id ?? "",
            date: academicReferenceDate(y.setup.calendar.year),
            objectives: "",
            status: "draft",
          };
    const fields: FormField[] =
      kind === "homework"
        ? [
            { name: "title", label: "Title" },
            {
              name: "classSectionId",
              label: "Class",
              type: "select",
              options: assigned.map((c) => ({
                value: c.id,
                label: `${c.grade}-${c.section}`,
              })),
            },
            {
              name: "subjectId",
              label: "Subject",
              type: "select",
              options: assignedSubjects.map((s) => ({
                value: s.id,
                label: s.name,
              })),
            },
            { name: "instructions", label: "Instructions", type: "textarea" },
            { name: "dueDate", label: "Due date", type: "date" },
            { name: "maxScore", label: "Maximum score", type: "number" },
          ]
        : [
            { name: "title", label: "Title" },
            {
              name: "unitId",
              label: "Syllabus unit",
              type: "select",
              options: assignedUnits.map((u) => ({
                value: u.id,
                label: u.title,
              })),
            },
            { name: "date", label: "Date", type: "date" },
            { name: "objectives", label: "Objectives", type: "textarea" },
          ];
    setEditor(
      <Dialog
        title={`Create ${kind === "homework" ? "homework" : "lesson plan"}`}
        onClose={() => setEditor(null)}
      >
        <DataForm
          initial={initial}
          fields={fields}
          onSave={async (v) => {
            await mutate(
              (current) => createTeacherWork(current, actor, kind, v),
              `Teacher: create ${kind}`,
              { type: "teacher-create", kind, input: v },
            );
            setEditor(null);
          }}
        />
      </Dialog>,
    );
  }
  const collections: Record<string, string[]> = {
    resources: ["resources"],
    learning: ["resources", "live-classes", "quizzes", "quiz-attempts"],
    messages: ["messages"],
    ptm: ["ptm"],
    consents: ["consents", "outpasses"],
    documents:
      actor.role === "staff" ? ["document-register"] : ["document-requests"],
    requests: ["document-requests", "re-evaluations", "outpasses"],
    library: ["books", "loans", "reservations", "library-fines"],
    activities: ["clubs", "activity-enrolments", "achievements"],
    payroll: ["payroll"],
    expenses: ["expenses"],
    training: ["training"],
    trips: ["trips"],
    boarding: ["boarding"],
    vehicles: ["vehicles"],
    alerts: ["transport-alerts"],
  };
  let content: ReactNode;
  if (section === "messages") return <ConversationInbox actor={actor} />;
  if (section === "learning-progress")
    return <LearningProgressPanel actor={actor} />;
  if (section === "payroll" && actor.role === "staff") {
    content = (
      <>
        <h2>Finalised payroll</h2>
        <Table
          headers={["Month", "Gross", "Unpaid days", "Net pay"]}
          rows={y.workflows.payrollRuns
            .filter((r) => r.status === "finalised")
            .flatMap((r) =>
              r.lines
                .filter((l) => l.staffId === actor.personId)
                .map((l) => [
                  r.period,
                  l.grossMinor / 100,
                  l.unpaidDays,
                  l.netMinor / 100,
                ]),
            )}
        />
        <Link href="/documents/publications">
          Download your issued payslips →
        </Link>
      </>
    );
  } else if (section === "documents" && actor.role === "staff") {
    const profile = y.records.staffProfiles.find(
      (p) => p.staffId === actor.personId,
    );
    content = (
      <Table
        headers={["Document", "Review status", "Size"]}
        rows={(profile?.documents ?? []).map((d) => [
          d.name,
          d.status,
          `${d.size} bytes`,
        ])}
      />
    );
  } else if (collections[section]) {
    content = (
      <div className="grid gap-8">
        {section === "learning" && <LearningProgressPanel actor={actor} />}
        {collections[section].map((kind) => (
          <CollectionScreen key={kind} actor={actor} kind={kind} compact />
        ))}
      </div>
    );
  } else if (section === "overview") {
    const attendance = y.records.attendance.filter((a) =>
      family ? ownIds.includes(a.personId) : a.personId === actor.personId,
    );
    const invoices = y.records.invoices.filter((i) =>
      ownIds.includes(i.studentId),
    );
    const hw = y.records.homework.filter((h) =>
      classes.includes(h.classSectionId),
    );
    content = (
      <>
        <div className="op-metrics">
          {[
            ["Linked students", students.length],
            ["Attendance records", attendance.length],
            ["Assignments", hw.length],
            [
              "Outstanding fees",
              `${y.setup.school.currency} ${(invoices.reduce((s, i) => s + balance(y, i.id), 0) / 100).toFixed(2)}`,
            ],
          ].map(([label, value]) => (
            <div className="op-card" key={label}>
              <small>{label}</small>
              <div className="op-stat">{value}</div>
              <small>Selected academic year</small>
            </div>
          ))}
        </div>
        <div className="op-cards">
          {(family
            ? ["attendance", "homework", "results", "fees", "notices", "leave"]
            : actor.role === "teacher"
              ? [
                  "classes",
                  "attendance",
                  "homework",
                  "submissions",
                  "marks",
                  "leave",
                ]
              : actor.role === "driver"
                ? ["trips", "boarding", "vehicles", "alerts"]
                : [
                    "attendance",
                    "leave",
                    "payroll",
                    "documents",
                    "expenses",
                    "training",
                  ]
          ).map((s) => (
            <Link className="op-card" href={`/${portal}/${s}`} key={s}>
              <h2 className="capitalize">{s}</h2>
              <p>
                Open your linked {s.replaceAll("-", " ")} records and tasks.
              </p>
              <span className="text-primary text-xs">View workspace →</span>
            </Link>
          ))}
        </div>
        {!actor.personId && (
          <div className="op-notice">
            This account has no verified person link. An administrator must
            assign one before private records appear.
          </div>
        )}
      </>
    );
  } else if (section === "classes") {
    content = (
      <>
        <div className="op-cards">
          {y.setup.classes
            .filter((c) => classes.includes(c.id))
            .map((c) => (
              <div className="op-card" key={c.id}>
                <h2>
                  Grade {c.grade} · {c.section}
                </h2>
                <p>
                  {students.filter((s) => s.classSectionId === c.id).length}{" "}
                  students
                </p>
              </div>
            ))}
        </div>
        <Table
          headers={["Student", "Admission number", "Class"]}
          rows={students.map((s) => [
            s.displayName,
            s.admissionNumber,
            s.classSectionId,
          ])}
        />
      </>
    );
  } else if (section === "attendance") {
    if (actor.role === "teacher") {
      const roster = students.filter((s) => s.classSectionId === classId);
      const registerInput = {
        classSectionId: classId,
        date: attendanceDate,
        entries: roster.map((s) => ({
          studentId: s.id,
          status:
            marks[s.id] ??
            y.records.attendance.find(
              (a) =>
                a.personType === "student" &&
                a.personId === s.id &&
                a.date === attendanceDate &&
                !a.periodId,
            )?.status ??
            "present",
        })),
      };
      content = (
        <>
          <div className="op-tools">
            <select
              aria-label="Assigned class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setMarks({});
              }}
            >
              {y.setup.classes
                .filter((c) => classes.includes(c.id))
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    Grade {c.grade}–{c.section}
                  </option>
                ))}
            </select>
            <input
              aria-label="Attendance date"
              type="date"
              value={attendanceDate}
              onInput={(e) => {
                setAttendanceDate(e.currentTarget.value);
                setMarks({});
              }}
              min={y.setup.calendar.year.startDate}
              max={y.setup.calendar.year.endDate}
              onChange={(e) => {
                setAttendanceDate(e.target.value);
                setMarks({});
              }}
            />
            <Button
              disabled={busy || !roster.length || y.locked}
              onClick={() =>
                void run(
                  (v) => savePortalAttendance(v, actor, registerInput),
                  "Teacher: save attendance",
                  { type: "attendance-save", input: registerInput },
                )
              }
            >
              Save register
            </Button>
          </div>
          <Table
            headers={["Student", "Admission", "Status"]}
            rows={roster.map((s) => [
              s.displayName,
              s.admissionNumber,
              <select
                key={s.id}
                aria-label={`Attendance for ${s.displayName}`}
                value={
                  marks[s.id] ??
                  y.records.attendance.find(
                    (a) =>
                      a.personType === "student" &&
                      a.personId === s.id &&
                      a.date === attendanceDate &&
                      !a.periodId,
                  )?.status ??
                  "present"
                }
                onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
              >
                {["present", "absent", "late", "excused"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>,
            ])}
          />
        </>
      );
    } else {
      const records = y.records.attendance.filter((a) =>
        family ? ownIds.includes(a.personId) : a.personId === actor.personId,
      );
      content = (
        <Table
          headers={["Date", "Person", "Register", "Status", "Note"]}
          rows={records.map((a) => [
            a.date,
            y.setup.students.find((s) => s.id === a.personId)?.displayName ??
              actor.name,
            a.periodId ?? "Daily",
            a.status,
            a.note,
          ])}
        />
      );
    }
  } else if (section === "leave") {
    const leaves = y.records.leaves.filter((l) =>
      family ? ownIds.includes(l.personId) : l.personId === actor.personId,
    );
    content = (
      <>
        <div className="op-tools">
          <Button
            disabled={
              y.locked ||
              (!family && !actor.personId) ||
              (family && !students.length)
            }
            onClick={leave}
          >
            Request leave
          </Button>
        </div>
        <Table
          headers={[
            "Person",
            "From",
            "Until",
            "Reason",
            "Status",
            "School decision",
          ]}
          rows={leaves.map((l) => [
            y.setup.students.find((s) => s.id === l.personId)?.displayName ??
              actor.name,
            l.dates.startDate,
            l.dates.endDate,
            l.reason,
            l.status,
            l.decisionNote,
          ])}
        />
      </>
    );
  } else if (section === "timetable") {
    content = (
      <>
        {actor.role === "teacher" && (
          <div className="op-links">
            <Link href="/timetable/substitutions">
              Request or review teaching cover →
            </Link>
            <Link href="/exams/reviews">Mark moderation & corrections →</Link>
          </div>
        )}
        <Table
          headers={[
            "Day",
            "Period",
            "Class",
            "Subject",
            "Teacher",
            "Room",
            "Status",
          ]}
          rows={y.records.slots
            .filter(
              (t) =>
                classes.includes(t.classSectionId) &&
                (actor.role !== "teacher" || t.staffId === actor.personId) &&
                t.status === "published",
            )
            .map((t) => [
              t.weekday,
              y.setup.bells.find((b) => b.id === t.periodId)?.name,
              t.classSectionId,
              y.records.subjects.find((s) => s.id === t.subjectId)?.name,
              y.setup.staff.find((s) => s.id === t.staffId)?.displayName,
              t.room,
              t.status,
            ])}
        />
        <h2 className="mt-6">Published teacher cover</h2>
        <Table
          headers={[
            "Date",
            "Class",
            "Period",
            "Regular teacher",
            "Cover teacher",
            "Reason",
          ]}
          rows={y.records.substitutions
            .filter(
              (s) =>
                s.status === "published" &&
                (actor.role === "teacher"
                  ? s.absentStaffId === actor.personId ||
                    s.substituteStaffId === actor.personId
                  : classes.includes(
                      y.records.slots.find((t) => t.id === s.slotId)
                        ?.classSectionId ?? "",
                    )),
            )
            .map((s) => {
              const slot = y.records.slots.find((t) => t.id === s.slotId),
                cohort = y.setup.classes.find(
                  (c) => c.id === slot?.classSectionId,
                );
              return [
                s.date,
                cohort ? `${cohort.grade} ${cohort.section}` : "Teaching cover",
                y.setup.bells.find((b) => b.id === slot?.periodId)?.name,
                y.setup.staff.find((t) => t.id === s.absentStaffId)
                  ?.displayName,
                y.setup.staff.find((t) => t.id === s.substituteStaffId)
                  ?.displayName,
                s.reason,
              ];
            })}
        />
      </>
    );
  } else if (section === "homework") {
    const hw = y.records.homework.filter(
      (h) =>
        classes.includes(h.classSectionId) &&
        (actor.role !== "teacher" || h.staffId === actor.personId),
    );
    content = (
      <>
        {actor.role === "teacher" && (
          <Button disabled={y.locked} onClick={() => teacherCreate("homework")}>
            Create homework
          </Button>
        )}
        <div className="op-cards mt-5">
          {hw.map((h) => {
            const submission = y.records.submissions.find(
              (s) => s.homeworkId === h.id && s.studentId === student?.id,
            );
            return (
              <div className="op-card" key={h.id}>
                <span className="op-badge">Due {h.dueDate}</span>
                <h2 className="mt-4">{h.title}</h2>
                <p>{h.instructions}</p>
                <p>
                  {submission?.status ?? "Not submitted"}{" "}
                  {submission?.score !== null && submission?.score !== undefined
                    ? `· ${submission.score}/${h.maxScore}`
                    : ""}
                </p>
                {submission?.feedback && <p>Feedback: {submission.feedback}</p>}
                {actor.role === "student" &&
                  submission?.status !== "graded" && (
                    <Button
                      className="mt-4"
                      disabled={y.locked}
                      onClick={() =>
                        setEditor(
                          <Dialog
                            title={`Submit ${h.title}`}
                            onClose={() => setEditor(null)}
                          >
                            <DataForm
                              initial={{
                                homeworkId: h.id,
                                studentId: student?.id ?? "",
                                answer: submission?.answer ?? "",
                              }}
                              fields={[
                                {
                                  name: "answer",
                                  label: "Your answer",
                                  type: "textarea",
                                },
                              ]}
                              onSave={async (v) => {
                                await mutate(
                                  (c) => submitPortalHomework(c, actor, v),
                                  "Student: submit homework",
                                  { type: "homework-submit", input: v },
                                );
                                setEditor(null);
                              }}
                            />
                          </Dialog>,
                        )
                      }
                    >
                      Submit answer
                    </Button>
                  )}
              </div>
            );
          })}
        </div>
        {!hw.length && (
          <div className="op-empty">
            No assignments for your selected class.
          </div>
        )}
      </>
    );
  } else if (section === "submissions") {
    const submissions = y.records.submissions.filter((s) =>
      y.records.homework.some(
        (h) => h.id === s.homeworkId && h.staffId === actor.personId,
      ),
    );
    content = (
      <Table
        headers={["Homework", "Student", "Answer", "Status", "Score", "Review"]}
        rows={submissions.map((s) => [
          y.records.homework.find((h) => h.id === s.homeworkId)?.title,
          y.setup.students.find((p) => p.id === s.studentId)?.displayName,
          s.answer || "No answer entered",
          s.status,
          s.score ?? "—",
          <button
            key={s.id}
            className="text-primary"
            disabled={y.locked || s.status === "pending"}
            onClick={() =>
              setEditor(
                <Dialog
                  title="Review submission"
                  onClose={() => setEditor(null)}
                >
                  <DataForm
                    initial={{
                      submissionId: s.id,
                      score: s.score ?? 0,
                      feedback: s.feedback,
                    }}
                    fields={[
                      { name: "score", label: "Score", type: "number" },
                      { name: "feedback", label: "Feedback", type: "textarea" },
                    ]}
                    onSave={async (v) => {
                      await mutate(
                        (c) => gradePortalSubmission(c, actor, v),
                        "Teacher: grade submission",
                        { type: "submission-grade", input: v },
                      );
                      setEditor(null);
                    }}
                  />
                </Dialog>,
              )
            }
          >
            Review
          </button>,
        ])}
      />
    );
  } else if (section === "lessons") {
    content = (
      <>
        <Button disabled={y.locked} onClick={() => teacherCreate("lessons")}>
          Create lesson plan
        </Button>
        <Table
          headers={["Lesson", "Date", "Objectives", "Status", "Action"]}
          rows={y.records.lessons
            .filter((l) => l.staffId === actor.personId)
            .map((l) => [
              l.title,
              l.date,
              l.objectives,
              l.status,
              l.status === "draft" || l.status === "returned" ? (
                <button
                  key={l.id}
                  onClick={() =>
                    void run(
                      (v) => submitTeacherLesson(v, actor, l.id),
                      "Teacher: submit lesson",
                      { type: "lesson-submit", id: l.id },
                    )
                  }
                >
                  Submit for approval
                </button>
              ) : (
                "Awaiting review"
              ),
            ])}
        />
      </>
    );
  } else if (section === "results" || section === "marks") {
    const marksRows = y.records.marks.filter(
      (m) =>
        ownIds.includes(m.studentId) &&
        (section === "marks" ||
          y.records.exams.find((e) => e.id === m.examId)?.status ===
            "completed"),
    );
    content = (
      <>
        {section === "marks" && (
          <Button
            disabled={y.locked}
            onClick={() => {
              const subjects = y.records.subjects.filter((s) =>
                y.setup.allocations.some(
                  (a) => a.staffId === actor.personId && a.subject === s.name,
                ),
              );
              setEditor(
                <Dialog title="Enter exam mark" onClose={() => setEditor(null)}>
                  <DataForm
                    initial={{
                      examId:
                        y.records.exams.find((e) => e.status !== "completed")
                          ?.id ?? "",
                      studentId: students[0]?.id ?? "",
                      subjectId: subjects[0]?.id ?? "",
                      marks: 0,
                      remark: "",
                    }}
                    fields={[
                      {
                        name: "examId",
                        label: "Exam cycle",
                        type: "select",
                        options: y.records.exams
                          .filter((e) => e.status !== "completed")
                          .map((e) => ({ value: e.id, label: e.name })),
                      },
                      {
                        name: "studentId",
                        label: "Student",
                        type: "select",
                        options: students.map((s) => ({
                          value: s.id,
                          label: s.displayName,
                        })),
                      },
                      {
                        name: "subjectId",
                        label: "Subject",
                        type: "select",
                        options: subjects.map((s) => ({
                          value: s.id,
                          label: s.name,
                        })),
                      },
                      { name: "marks", label: "Marks", type: "number" },
                      { name: "remark", label: "Remark" },
                    ]}
                    onSave={async (v) => {
                      await mutate(
                        (c) => savePortalMark(c, actor, v),
                        "Teacher: enter mark",
                        { type: "mark-save", input: v },
                      );
                      setEditor(null);
                    }}
                  />
                </Dialog>,
              );
            }}
          >
            Enter mark
          </Button>
        )}
        <Table
          headers={["Student", "Exam", "Subject", "Marks", "Remark"]}
          rows={marksRows.map((m) => [
            y.setup.students.find((s) => s.id === m.studentId)?.displayName,
            y.records.exams.find((e) => e.id === m.examId)?.name,
            y.records.subjects.find((s) => s.id === m.subjectId)?.name,
            m.marks,
            m.remark,
          ])}
        />
        {section === "results" && (
          <Link href="/documents/publications">
            Download issued report cards and transcripts →
          </Link>
        )}
        {section === "results" && (
          <>
            <p className="op-notice">
              Only completed, locked exam results are visible here.
            </p>
            <Button variant="outline" onClick={() => window.print()}>
              Print report / Save PDF
            </Button>
          </>
        )}
      </>
    );
  } else if (section === "fees") {
    const invoices = y.records.invoices.filter((i) =>
      ownIds.includes(i.studentId),
    );
    content = (
      <>
        <Table
          headers={[
            "Invoice",
            "Student",
            "Due",
            "Total",
            "Outstanding",
            "Status",
          ]}
          rows={invoices.map((i) => [
            i.reference,
            y.setup.students.find((s) => s.id === i.studentId)?.displayName,
            i.dueDate,
            (i.lines.reduce((s, l) => s + l.amountMinor, 0) -
              i.concessionMinor) /
              100,
            balance(y, i.id) / 100,
            i.status,
          ])}
        />
        <h2 className="text-lg font-semibold mt-8 mb-4">
          Receipts & payment history
        </h2>
        <Table
          headers={[
            "Reference",
            "Date",
            "Collected",
            "Refunded",
            "Method",
            "Status",
          ]}
          rows={y.records.payments
            .filter((p) => invoices.some((i) => i.id === p.invoiceId))
            .map((p) => [
              p.reference,
              p.paidOn,
              p.amountMinor / 100,
              p.refundedMinor / 100,
              p.method,
              p.status,
            ])}
        />
        {!!y.workflows.feePlans.length && (
          <>
            <h2 className="text-lg font-semibold mt-8 mb-4">
              Approved instalment plans
            </h2>
            <Table
              headers={["Plan", "Due date", "Amount"]}
              rows={y.workflows.feePlans.flatMap((p) =>
                p.instalments.map((i) => [
                  p.name,
                  i.dueDate,
                  i.amountMinor / 100,
                ]),
              )}
            />
          </>
        )}
        <div className="op-tools">
          <Button variant="outline" onClick={() => window.print()}>
            Print statement / Save PDF
          </Button>
        </div>
        {actor.role === "parent" && (
          <CollectionScreen actor={actor} kind="payment-attempts" compact />
        )}
      </>
    );
  } else if (section === "notices") {
    const notices = y.records.notices.filter((n) =>
      cloud ? n.status === "published" : canReadPortalNotice(y, actor, n),
    );
    content = (
      <div className="grid gap-4">
        {notices.map((n) => (
          <article className="op-card" key={n.id}>
            <span className="op-badge">{n.priority}</span>
            <h2 className="mt-4">{n.title}</h2>
            <p>{n.body}</p>
            {n.recipientIds.includes(actor.personId ?? "") && (
              <Button
                variant="outline"
                disabled={
                  y.locked || n.acknowledgedIds.includes(actor.personId ?? "")
                }
                onClick={() =>
                  void run(
                    (v) => acknowledgePortalNotice(v, actor, n.id),
                    "Portal: acknowledge notice",
                    { type: "notice-ack", id: n.id },
                  )
                }
              >
                {n.acknowledgedIds.includes(actor.personId ?? "")
                  ? "Acknowledged"
                  : "Acknowledge"}
              </Button>
            )}
          </article>
        ))}
        {!notices.length && (
          <div className="op-empty">
            No published notices addressed to this account.
          </div>
        )}
      </div>
    );
  } else if (section === "events") {
    content = (
      <Table
        headers={["Event", "Category", "From", "Until", "Venue", "Details"]}
        rows={y.records.events
          .filter(
            (e) =>
              e.status === "published" &&
              (!e.classSectionIds.length ||
                e.classSectionIds.some((c) => classes.includes(c))),
          )
          .map((e) => [
            e.title,
            e.category,
            e.dates.startDate,
            e.dates.endDate,
            e.venue,
            e.description,
          ])}
      />
    );
  } else if (section === "transport") {
    const profile = y.records.studentProfiles.find(
      (p) => p.studentId === student?.id,
    );
    const allocation = y.extensions.find(
      (r) =>
        r.kind === "transport-allocations" &&
        r.studentId === student?.id &&
        r.status === "active",
    );
    const assignedStop = y.extensions.find(
      (r) => r.kind === "stops" && r.id === allocation?.values.stopId,
    );
    const route = y.records.routes.find(
      (r) => r.id === (allocation?.values.routeId ?? profile?.routeId),
    );
    content = route ? (
      <div className="op-card">
        <h2>{route.name}</h2>
        <p>Vehicle: {route.vehicle}</p>
        <Table
          headers={["Stop", "Time"]}
          rows={
            assignedStop
              ? [[assignedStop.title, String(assignedStop.values.pickupTime)]]
              : route.stops.map((s) => [s.name, s.time])
          }
        />
        <p className="op-notice">
          Live GPS is not connected. This is the saved route and pickup
          schedule.
        </p>
      </div>
    ) : (
      <div className="op-empty">No transport route is assigned.</div>
    );
  } else if (section === "profile") {
    const person = family
      ? student
      : y.setup.staff.find((s) => s.id === actor.personId);
    content = (
      <div className="op-card">
        <h2>{person?.displayName ?? actor.name}</h2>
        <p>{actor.email}</p>
        <p>Role: {actor.role}</p>
        <p>Person link: {actor.personId ?? "Not assigned"}</p>
        <p>School: {y.setup.school.name}</p>
        <p>
          Changes to verified relationships are reviewed by your school
          administrator.
        </p>
        <Link href="/account/security">Manage account security →</Link>
      </div>
    );
  } else
    content = (
      <div className="op-empty">No records are available for this view.</div>
    );
  return (
    <>
      <div className="op-heading">
        <div>
          <span className="op-eyebrow">{actor.role} workspace</span>
          <h1 className="capitalize">{title}</h1>
          <p>
            {actor.role === "parent"
              ? "Your linked child’s school day, learning and important updates."
              : actor.role === "student"
                ? "Your school day, learning and important updates."
                : "Your assigned school records, tasks and requests."}
          </p>
        </div>
        {actor.role === "parent" && (
          <label>
            Child
            <select
              className="ml-3 border rounded p-2"
              aria-label="Linked child"
              value={student?.id ?? ""}
              onChange={(e) => setChild(e.target.value)}
            >
              {y.setup.students
                .filter((s) => ids.includes(s.id))
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.displayName}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="op-notice">
          {feedback}
        </p>
      )}
      {content}
      {editor}
    </>
  );
}
