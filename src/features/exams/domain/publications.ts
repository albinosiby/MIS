import {publishResultsSchema,publishTranscriptSchema} from "../schemas/results.schema.ts";
import { classAtDate } from "../../students/domain/class-history.ts";
import { attendanceEligibilityBatch } from "../../attendance/domain/eligibility.ts";
import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { publicationSchema } from "../../reports/schemas/publication.schema.ts";
export function publishExamResults(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  const request = publishResultsSchema.parse(input);
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("Exam publication permission required.");
  const exam = y.records.exams.find((e) => e.id === request.examId);
  if (!exam || exam.status !== "published")
    throw new Error("Only a published assessment can have results issued.");
  if(y.workflows.resultReviews.some(r=>r.examId===exam.id&&r.status==="submitted"))throw new Error("Decide pending mark moderation before issuing results.");
  if (y.extensions.some(r => r.kind === "moderation" && r.values.examId === exam.id && ["draft", "submitted"].includes(r.status))) throw new Error("Complete or cancel outstanding moderation reviews before result publication.");
  const students = y.setup.students.filter(
    (s) =>
      exam.classSectionIds.includes(
        classAtDate(
          s.classSectionId,
          y.workflows.studentEvents,
          s.id,
          exam.dates.startDate,
        ),
      ) &&
      !y.records.studentProfiles.some(
        (p) => p.studentId === s.id && p.status !== "active",
      ),
  );
  if (!students.length) throw new Error("Assessment has no active students.");
  const eligibility=new Map(y.workflows.advanced.examEligibilityEnforced?attendanceEligibilityBatch(y,students.map(s=>s.id),exam.dates.startDate).map(r=>[r.studentId,r.status]):[]);
  const scales = request.publishedScaleIds.map(id => y.extensions.find(r => r.id === id && r.kind === "grading-scales" && r.status === "published"));
  if (scales.some(r => !r) || new Set(request.publishedScaleIds).size !== request.publishedScaleIds.length) throw new Error("Choose unique published grading scale rows.");
  const orderedScales=[...scales].sort((a,b)=>Number(a!.values.minimum)-Number(b!.values.minimum));
  if(orderedScales.some((r,i)=>Number(r!.values.maximum)!==(i===orderedScales.length-1?100:Number(orderedScales[i+1]!.values.minimum)-1)))throw new Error("Published grading rows must cover 0–100 without gaps or overlaps in whole-percent thresholds.");
  const bands = publishResultsSchema.parse({ examId: exam.id, gradeBands: scales.length ? scales.map(r => ({ label: String(r!.values.grade), minimum: Number(r!.values.minimum) })) : request.gradeBands }).gradeBands.sort((a,b) => b.minimum-a.minimum);
  const template = request.templateId ? y.extensions.find(r => r.id === request.templateId && r.kind === "report-templates" && r.status === "published") : null;
  if (request.templateId && !template) throw new Error("Choose a published report template.");
  let counter = y.workflows.counters["report-card"] ?? 0;
  const publications = students.map((student) => {
    if (
      y.workflows.advanced.examEligibilityEnforced &&
      eligibility.get(student.id) !==
        "eligible"
    )
      throw new Error(
        `Attendance eligibility is incomplete or below the school threshold for ${student.displayName}. Review the register before publication.`,
      );
    const subjects = exam.subjectIds.map((subjectId) => {
      const mark = y.records.marks.find(
          (m) =>
            m.examId === exam.id &&
            m.subjectId === subjectId &&
            m.studentId === student.id,
        ),
        subject = y.records.subjects.find((s) => s.id === subjectId);
      if (!mark || !subject)
        throw new Error(
          `Marks are incomplete for ${student.displayName}. Complete every subject before publication.`,
        );
      const percent = Math.round((mark.marks / exam.maxMarks) * 10000) / 100;
      return {
        subjectId,
        subject: subject.name,
        marks: mark.marks,
        maximum: exam.maxMarks,
        percent,
        grade: bands.find((b) => percent >= b.minimum)!.label,
        remark: mark.remark,
      };
    });
    const total = subjects.reduce((s, m) => s + m.marks, 0),
      maximum = exam.maxMarks * subjects.length,
      percent = Math.round((total / maximum) * 10000) / 100;
    return publicationSchema.parse({
      id: crypto.randomUUID(),
      kind: "report-card",
      sourceId: exam.id,
      ownerType: "student",
      ownerId: student.id,
      version:
        1 +
        y.workflows.publications.filter(
          (p) =>
            p.kind === "report-card" &&
            p.sourceId === exam.id &&
            p.ownerId === student.id,
        ).length,
      reference: `RC-${y.setup.calendar.year.id.slice(0, 60)}-${String(++counter).padStart(6, "0")}`,
      title: `${exam.name} report card`,
      issuedBy: a.id,
      issuedAt: new Date().toISOString(),
      revokedAt: null,
      revocationReason: "",
      snapshot: {
        school: y.setup.school.name,
        schoolId: a.schoolId,
        year: y.setup.calendar.year.name,
        student: student.displayName,
        admissionNumber: student.admissionNumber,
        exam: exam.name,
        gradingScale: scales.map(r => ({ id: r!.id, title: r!.title, ...r!.values })),
        template: template ? { id: template.id, ...template.values } : null,
        gradeBands: bands,
        subjects,
        total,
        maximum,
        percent,
        grade: bands.find((b) => percent >= b.minimum)!.label,
        passed: subjects.every((s) => s.marks >= exam.passMarks),
      },
    });
  });
  return {
    ...y,
    records: {
      ...y.records,
      exams: y.records.exams.map((e) =>
        e.id === exam.id ? { ...e, status: "completed" as const } : e,
      ),
    },
    workflows: {
      ...y.workflows,
      counters: { ...y.workflows.counters, "report-card": counter },
      publications: [...y.workflows.publications, ...publications],
    },
  };
}
export function publishTranscript(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  const request = publishTranscriptSchema.parse(input);
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("Transcript permission required.");
  if (
    request.weights.reduce((s, w) => s + w.weightBps, 0) !== 10000 ||
    new Set(request.weights.map((w) => w.examId)).size !==
      request.weights.length
  )
    throw new Error("Assessment weights must be unique and total 100%.");
  const student = y.setup.students.find((s) => s.id === request.studentId);
  if (!student) throw new Error("Student unavailable.");
  const results = request.weights.map((w) => {
    const report = [...y.workflows.publications]
      .reverse()
      .find(
        (p) =>
          p.kind === "report-card" &&
          p.ownerId === student.id &&
          p.sourceId === w.examId &&
          !p.revokedAt,
      );
    if (!report)
      throw new Error("Publish every weighted assessment report first.");
    const percent = z.number().min(0).max(100).parse(report.snapshot.percent);
    return {
      examId: w.examId,
      reference: report.reference,
      percent,
      weightBps: w.weightBps,
    };
  });
  const counter = (y.workflows.counters["transcript"] ?? 0) + 1;
  const published = publicationSchema.parse({
    id: crypto.randomUUID(),
    kind: "transcript",
    sourceId: student.id,
    ownerType: "student",
    ownerId: student.id,
    version:
      1 +
      y.workflows.publications.filter(
        (p) => p.kind === "transcript" && p.ownerId === student.id,
      ).length,
    reference: `TR-${y.setup.calendar.year.id.slice(0, 60)}-${counter}`,
    title: request.title,
    issuedBy: a.id,
    issuedAt: new Date().toISOString(),
    revokedAt: null,
    revocationReason: "",
    snapshot: {
      school: y.setup.school.name,
      student: student.displayName,
      admissionNumber: student.admissionNumber,
      year: y.setup.calendar.year.name,
      assessments: results,
      weightedPercent:
        Math.round(
          results.reduce((s, r) => s + (r.percent * r.weightBps) / 10000, 0) *
            100,
        ) / 100,
    },
  });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      counters: { ...y.workflows.counters, transcript: counter },
      publications: [...y.workflows.publications, published],
    },
  };
}
