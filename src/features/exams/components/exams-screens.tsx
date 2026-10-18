"use client";
import { useState, type ReactNode } from "react";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { useRouter } from "next/navigation";
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
  subjectOptions,
  studentOptions,
  labelFor,
  newRecord,
  type FormField,
  printSection,
} from "../../workspace/components/workspace-ui";
import { putRecord, scope } from "../../workspace/domain/operations";
import {
  autoScheduleExam,
  publishExam,
  completeExam,
  saveMarks,
  gradeBandForPercent,
} from "../domain/exam-workflow";
import { MarksImport } from "./marks-import";
import { examCycleSchema } from "../schemas/exams.schema";
import { readableError } from "../../school-setup/components/form-errors";
export default function ExamsScreens({
  route,
  query,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const router = useRouter();
  const initialExam =
    y.records.exams.find((e) => e.id === query.exam) ?? y.records.exams[0];
  const [examId, setExamId] = useState(
      query.exam ?? y.records.exams[0]?.id ?? "",
    ),
    [classId, setClassId] = useState(
      initialExam?.classSectionIds[0] ?? y.setup.classes[0].id,
    ),
    [subjectId, setSubjectId] = useState(
      initialExam?.subjectIds[0] ?? y.records.subjects[0]?.id ?? "",
    ),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [studentId, setStudentId] = useState(
      query.student ?? y.setup.students[0]?.id ?? "",
    ),
    [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const exam = y.records.exams.find((e) => e.id === examId);
  const classes = classOptions(y),
    staff = staffOptions(y),
    subjects = subjectOptions(y),
    students = studentOptions(y);
  const fields: FormField[] = [
    { name: "name", label: "Exam cycle title" },
    { name: "dates.startDate", label: "Start date", type: "date" },
    { name: "dates.endDate", label: "End date", type: "date" },
    {
      name: "classSectionIds",
      label: "Eligible cohorts",
      type: "multi",
      options: classes,
    },
    { name: "subjectIds", label: "Subjects", type: "multi", options: subjects },
    { name: "maxMarks", label: "Maximum marks per subject", type: "number" },
    { name: "passMarks", label: "Passing marks", type: "number" },
  ];
  async function act(work: () => Promise<void>) {
    try {
      await work();
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  if (route === "/exams/new")
    return (
      <Panel title="Create exam cycle">
        <DataForm
          initial={{
            ...newRecord(y),
            name: "",
            dates: {
              startDate: academicReferenceDate(y.setup.calendar.year, "10-20"),
              endDate: academicReferenceDate(y.setup.calendar.year, "10-30"),
            },
            classSectionIds: [y.setup.classes[0].id],
            subjectIds: y.records.subjects.slice(0, 3).map((s) => s.id),
            maxMarks: 100,
            passMarks: 33,
            status: "draft",
          }}
          fields={fields}
          submitLabel="Create exam cycle"
          onSave={async (value) => {
            const parsed = examCycleSchema.parse(value);
            await mutate(
              (current) => putRecord(current, "exams", parsed),
              "Created exam cycle",
            );
            router.push(`/exams?exam=${parsed.id}`);
          }}
        />
      </Panel>
    );
  const eligible = y.setup.students.filter(
    (s) =>
      exam?.classSectionIds.includes(s.classSectionId) &&
      s.classSectionId === classId &&
      !y.records.studentProfiles.some(
        (p) => p.studentId === s.id && p.status !== "active",
      ) &&
      s.displayName.toLowerCase().includes(search.toLowerCase()),
  );
  const gradeRows = exam
    ? exam.subjectIds.map((id) => {
        const marks = y.records.marks.find(
          (m) =>
            m.examId === exam.id &&
            m.subjectId === id &&
            m.studentId === studentId,
        );
        return {
          subject: labelFor(subjects, id),
          marks: marks?.marks ?? null,
          max: exam.maxMarks,
          grade: marks
            ? gradeBandForPercent((marks.marks / exam.maxMarks) * 100)
            : "Pending",
        };
      })
    : [];
  return (
    <>
      <div className="ws-actions">
        <LinkButton href="/exams/new" variant="default">
          + Create Exam Cycle
        </LinkButton>
        <LinkButton href={`/exams/marks?exam=${examId}`}>
          Marks entry
        </LinkButton>
        <LinkButton href="/exams/publications">Publish report cards</LinkButton>
        <LinkButton href="/exams/reviews">Moderation & result corrections</LinkButton>
        <LinkButton href={exam ? `/exams?exam=${exam.id}` : "/exams"}>
          Exam overview
        </LinkButton>
        <ExportButton
          name="exam-marks"
          report="marks"
          rows={y.records.marks.filter((m) => m.examId === examId)}
        />
      </div>
      <div className="ws-actions">
        <Button
          variant="outline"
          disabled={!exam || busy || exam.status === "completed"}
          onClick={() =>
            setEditor(
              <MarksImport examId={examId} onClose={() => setEditor(null)} />,
            )
          }
        >
          Import Marks (CSV)
        </Button>
      </div>
      <div className="ws-filter-bar">
        <Select
          aria-label="Exam cycle"
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value);
            setDraft({});
            const next = y.records.exams.find((ex) => ex.id === e.target.value);
            if (next) {
              setClassId(next.classSectionIds[0]);
              setSubjectId(next.subjectIds[0]);
            }
          }}
        >
          {y.records.exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        {exam && (
          <Badge tone={exam.status === "completed" ? "green" : "blue"}>
            {exam.status}
          </Badge>
        )}
      </div>
      {error && (
        <p className="config-errors" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="config-success">
          {notice}
        </p>
      )}
      {!exam ? (
        <Panel title="No exam cycle">
          <p className="ws-empty">
            Create a cycle to configure papers and enter marks.
          </p>
        </Panel>
      ) : route === "/exams/marks" ? (
        <>
          <div className="ws-filter-bar">
            <Select
              aria-label="Marks cohort"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setDraft({});
              }}
            >
              {classes
                .filter((c) => exam.classSectionIds.includes(c.value))
                .map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
            </Select>
            <Select
              aria-label="Marks subject"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setDraft({});
              }}
            >
              {subjects
                .filter((s) => exam.subjectIds.includes(s.value))
                .map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
            </Select>
            <Badge>Maximum: {exam.maxMarks}</Badge>
          </div>
          <Panel title="Component marks registry">
            <Table
              headers={["Student / GRN", "Marks", "Maximum", "Grade preview"]}
              rows={eligible.map((s) => {
                const saved = y.records.marks.find(
                  (m) =>
                    m.examId === examId &&
                    m.studentId === s.id &&
                    m.subjectId === subjectId,
                );
                const value = draft[s.id] ?? (saved ? String(saved.marks) : "");
                return [
                  <>
                    {s.displayName}
                    <br />
                    <small>{s.admissionNumber}</small>
                  </>,
                  <Input
                    aria-label={`Marks for ${s.displayName}`}
                    type="number"
                    min={0}
                    max={exam.maxMarks}
                    value={value}
                    disabled={exam.status === "completed"}
                    onChange={(e) =>
                      setDraft((v) => ({ ...v, [s.id]: e.target.value }))
                    }
                  />,
                  exam.maxMarks,
                  value === ""
                    ? "Pending"
                    : gradeBandForPercent((Number(value) / exam.maxMarks) * 100),
                ];
              })}
            />
          </Panel>
          <div className="ws-sticky-bar">
            <p>
              Blank marks remain pending. Clearing an existing mark removes that
              entry.
            </p>
            <Button
              disabled={busy || exam.status === "completed" || !eligible.length}
              onClick={() =>
                void act(async () => {
                  await mutate(
                    (current) =>
                      saveMarks(current, {
                        ...scope(current),
                        examId,
                        subjectId,
                        classSectionId: classId,
                        entries: eligible.map((s) => {
                          const saved = current.records.marks.find(
                            (m) =>
                              m.examId === examId &&
                              m.subjectId === subjectId &&
                              m.studentId === s.id,
                          );
                          const value =
                            draft[s.id] ?? (saved ? String(saved.marks) : "");
                          return {
                            studentId: s.id,
                            marks: value === "" ? null : Number(value),
                          };
                        }),
                      }),
                    "Saved class examination marks",
                  );
                  setDraft({});
                  setNotice("Marks saved.");
                })
              }
            >
              Save marks
            </Button>
            {exam.status === "completed" && (
              <Button
                variant="outline"
                onClick={() =>
                  setEditor(
                    <RecordDialog
                      title="Request marks unlock"
                      collection="approvals"
                      initial={{
                        ...newRecord(y),
                        title: `Unlock ${exam.name}`,
                        category: "exam_unlock",
                        requesterId: y.setup.staff[0].id,
                        targetId: exam.id,
                        reason: "",
                        amountMinor: 0,
                        status: "pending",
                        decisionNote: "",
                      }}
                      fields={[
                        {
                          name: "reason",
                          label: "Reason for unlock (8+ characters)",
                          type: "textarea",
                        },
                      ]}
                      onClose={() => setEditor(null)}
                    />,
                  )
                }
              >
                Request unlock
              </Button>
            )}
          </div>
          <Panel title="Student report-card preview">
            <div className="ws-panel-body">
              <Select
                aria-label="Report-card student"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                {students
                  .filter(
                    (s) =>
                      y.setup.students.find((p) => p.id === s.value) &&
                      exam.classSectionIds.includes(
                        y.setup.students.find((p) => p.id === s.value)!
                          .classSectionId,
                      ),
                  )
                  .map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </Select>
              <article className="ws-letterhead" id="report-card-print">
                <h3>{y.setup.school.name}</h3>
                <p>
                  {exam.name} · {y.setup.calendar.year.name}
                  <br />
                  {labelFor(students, studentId)}
                </p>
                <Table
                  headers={["Subject", "Marks", "Maximum", "grade band"]}
                  rows={gradeRows.map((g) => [
                    g.subject,
                    g.marks ?? "Pending",
                    g.max,
                    g.grade,
                  ])}
                />
                <p>
                  Total: {gradeRows.reduce((s, g) => s + (g.marks ?? 0), 0)} /{" "}
                  {gradeRows.reduce((s, g) => s + g.max, 0)} ·{" "}
                  {gradeRows.some((g) => g.marks === null)
                    ? "Incomplete"
                    : "All subject marks recorded"}
                </p>
                <p className="ws-hint">
                  workspace report card; no board certification or digital
                  signature.
                </p>
              </article>
              <Button
                variant="outline"
                onClick={() => printSection("report-card-print")}
              >
                Print report card / Save PDF
              </Button>
            </div>
          </Panel>
        </>
      ) : (
        <>
          <Metrics
            items={[
              { label: "Exam cycles", value: y.records.exams.length },
              {
                label: "Scheduled papers",
                value: y.records.papers.filter((p) => p.examId === examId)
                  .length,
              },
              {
                label: "Marks recorded",
                value: y.records.marks.filter((m) => m.examId === examId)
                  .length,
              },
              {
                label: "Eligible students",
                value: y.setup.students.filter((s) =>
                  exam.classSectionIds.includes(s.classSectionId),
                ).length,
              },
            ]}
          />
          <Panel
            title="Exam cycle configuration"
            action={
              <Button
                variant="outline"
                disabled={exam.status === "completed"}
                onClick={() =>
                  setEditor(
                    <RecordDialog
                      title="Edit exam cycle"
                      collection="exams"
                      initial={exam}
                      fields={fields}
                      onClose={() => setEditor(null)}
                    />,
                  )
                }
              >
                Edit cycle
              </Button>
            }
          >
            <div className="ws-panel-body">
              <p>
                {exam.name} · {exam.dates.startDate} → {exam.dates.endDate}
              </p>
              <p>
                {exam.classSectionIds.length} cohorts · {exam.subjectIds.length}{" "}
                subjects · {exam.maxMarks} maximum · {exam.passMarks} pass mark
              </p>
              <div className="ws-actions">
                <Button
                  variant="outline"
                  disabled={exam.status === "completed"}
                  onClick={() =>
                    void act(() =>
                      mutate(
                        (current) => autoScheduleExam(current, exam.id),
                        "Auto-scheduled examination papers",
                      ),
                    )
                  }
                >
                  Auto-schedule papers
                </Button>
                <Button
                  disabled={busy || exam.status === "completed"}
                  onClick={() =>
                    void act(() =>
                      mutate(
                        (current) => publishExam(current, exam.id),
                        "Published exam cycle",
                      ),
                    )
                  }
                >
                  Publish exam cycle
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || exam.status !== "published"}
                  onClick={() =>
                    void act(() =>
                      mutate(
                        (current) => completeExam(current, exam.id),
                        "Locked completed exam results",
                      ),
                    )
                  }
                >
                  Complete & lock results
                </Button>
              </div>
            </div>
          </Panel>
          <Panel
            title="Paper schedule & hall allocations"
            action={
              <Button
                disabled={exam.status === "completed"}
                onClick={() =>
                  setEditor(
                    <RecordDialog
                      title="Schedule exam paper"
                      collection="papers"
                      initial={{
                        ...newRecord(y),
                        examId: exam.id,
                        classSectionId: exam.classSectionIds[0],
                        subjectId: exam.subjectIds[0],
                        date: exam.dates.startDate,
                        periodId:
                          y.setup.bells.find((b) => b.kind === "period")?.id ??
                          "",
                        room: y.records.rooms[0]?.name ?? "Room 204",
                        invigilatorId: y.setup.staff[0].id,
                      }}
                      fields={[
                        {
                          name: "classSectionId",
                          label: "Cohort",
                          type: "select",
                          options: classes.filter((c) =>
                            exam.classSectionIds.includes(c.value),
                          ),
                        },
                        {
                          name: "subjectId",
                          label: "Subject",
                          type: "select",
                          options: subjects.filter((s) =>
                            exam.subjectIds.includes(s.value),
                          ),
                        },
                        { name: "date", label: "Date", type: "date" },
                        {
                          name: "periodId",
                          label: "Session",
                          type: "select",
                          options: y.setup.bells
                            .filter((b) => b.kind === "period")
                            .map((b) => ({
                              value: b.id,
                              label: `${b.name} ${b.start}`,
                            })),
                        },
                        {
                          name: "room",
                          label: "Room",
                          type: "select",
                          options: y.records.rooms.map((r) => ({
                            value: r.name,
                            label: r.name,
                          })),
                        },
                        {
                          name: "invigilatorId",
                          label: "Invigilator",
                          type: "select",
                          options: staff,
                        },
                      ]}
                      onClose={() => setEditor(null)}
                    />,
                  )
                }
              >
                + Add paper
              </Button>
            }
          >
            <Table
              headers={[
                "Date / session",
                "Cohort",
                "Subject",
                "Room",
                "Invigilator",
              ]}
              rows={y.records.papers
                .filter((p) => p.examId === examId)
                .map((p) => [
                  <>
                    {p.date}
                    <br />
                    {y.setup.bells.find((b) => b.id === p.periodId)?.name}
                  </>,
                  labelFor(classes, p.classSectionId),
                  labelFor(subjects, p.subjectId),
                  p.room,
                  labelFor(staff, p.invigilatorId),
                ])}
            />
          </Panel>
        </>
      )}
      {editor}
    </>
  );
}
