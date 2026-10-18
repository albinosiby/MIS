import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { moderationRequestSchema, resultReviewRequestSchema, resultReviewDecisionSchema, resultReviewSchema, resultSubjectSnapshotSchema } from "../schemas/review.schema.ts";
import { publicationSchema } from "../../reports/schemas/publication.schema.ts";
import { publishResultsSchema } from "../schemas/results.schema.ts";
function context(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (y.locked || y.setup.school.id !== a.schoolId)
    throw new Error("Result review school/year inaccessible.");
}
function sourceReview(y: SchoolYearWorkspace, id: string | null, examId: string, studentId: string, subjectId: string) {
  if (!id)
    return;
  const row = y.extensions.find(r => r.id === id && ["moderation", "re-evaluations"].includes(r.kind) && ["draft", "submitted"].includes(r.status));
  if (!row || row.studentId !== studentId || row.values.examId !== examId || row.values.subjectId !== subjectId || y.workflows.resultReviews.some(r => r.sourceOperationId === id && r.status === "submitted"))
    throw new Error("Choose an undecided matching student/subject review request.");
}
export function requestMarkModeration(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown): SchoolYearWorkspace {
  context(y, a);
  const data = moderationRequestSchema.parse(input), exam = y.records.exams.find(e => e.id === data.examId && e.status !== "completed"), student = y.setup.students.find(s => s.id === data.studentId), subject = y.records.subjects.find(s => s.id === data.subjectId), mark = y.records.marks.find(m => m.examId === data.examId && m.studentId === data.studentId && m.subjectId === data.subjectId);
  if (!exam || !student || !subject || !mark || !exam.subjectIds.includes(subject.id))
    throw new Error("Choose an entered mark in an unlocked assessment.");
  if (!["admin", "principal"].includes(a.role) && !(a.role === "teacher" && y.setup.allocations.some(x => x.staffId === a.personId && x.classSectionId === student.classSectionId && x.subject === subject.name)))
    throw new Error("Allocated teacher or examination administrator required.");
  if (data.proposedMarks > exam.maxMarks || data.proposedMarks === mark.marks)
    throw new Error("Propose a changed mark within the assessment maximum.");
  if (y.workflows.resultReviews.some(r => r.examId === exam.id && r.studentId === student.id && r.subjectId === subject.id && r.status === "submitted"))
    throw new Error("A moderation review is already pending for this mark.");
  sourceReview(y, data.sourceOperationId, exam.id, student.id, subject.id);
  const review = resultReviewSchema.parse({ ...data, id: crypto.randomUUID(), publicationId: null, previousMarks: mark.marks, requestedBy: a.id, requestedAt: new Date().toISOString(), status: "submitted", decidedBy: null, decidedAt: null, decisionNote: "", correctedPublicationId: null });
  return { ...y, workflows: { ...y.workflows, resultReviews: [...y.workflows.resultReviews, review] } };
}
export function requestResultReview(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown): SchoolYearWorkspace {
  context(y, a);
  const data = resultReviewRequestSchema.parse(input), pub = y.workflows.publications.find(p => p.id === data.publicationId && p.kind === "report-card" && !p.revokedAt), student = y.setup.students.find(s => s.id === pub?.ownerId), subject = y.records.subjects.find(s => s.id === data.subjectId), exam = y.records.exams.find(e => e.id === pub?.sourceId && e.status === "completed");
  if (!pub || !student || !subject || !exam)
    throw new Error("Choose a current locked report card.");
  if (!["admin", "principal"].includes(a.role) && !(a.role === "teacher" && y.setup.allocations.some(x => x.staffId === a.personId && x.classSectionId === student.classSectionId && x.subject === subject.name)))
    throw new Error("Only an allocated teacher or examination administrator can propose a mark correction.");
  const subjects = z.array(resultSubjectSnapshotSchema).parse(pub.snapshot.subjects), current = subjects.find(s => s.subjectId === subject.id);
  if (!current || data.proposedMarks > current.maximum || data.proposedMarks === current.marks)
    throw new Error("Propose a changed mark within the assessment maximum.");
  if (y.workflows.resultReviews.some(r => r.publicationId === pub.id && r.subjectId === subject.id && r.status === "submitted"))
    throw new Error("This subject already has a pending review.");
  sourceReview(y, data.sourceOperationId, exam.id, student.id, subject.id);
  const review = resultReviewSchema.parse({ ...data, id: crypto.randomUUID(), examId: exam.id, studentId: student.id, previousMarks: current.marks, requestedBy: a.id, requestedAt: new Date().toISOString(), status: "submitted", decidedBy: null, decidedAt: null, decisionNote: "", correctedPublicationId: null });
  return { ...y, workflows: { ...y.workflows, resultReviews: [...y.workflows.resultReviews, review] } };
}
export function decideResultReview(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown): SchoolYearWorkspace {
  context(y, a);
  const data = resultReviewDecisionSchema.parse(input), review = y.workflows.resultReviews.find(r => r.id === data.id);
  if (!["admin", "principal"].includes(a.role))
    throw new Error("Examination reviewer required.");
  if (!review || review.status !== "submitted")
    throw new Error("Choose an undecided review.");
  if (review.requestedBy === a.id)
    throw new Error("A separate reviewer must decide this request.");
  const at = new Date().toISOString();
  const source = review.sourceOperationId ? y.extensions.find(r => r.id === review.sourceOperationId) : null;
  if (data.decision === "approved" && review.sourceOperationId && (!source || !["draft", "submitted"].includes(source.status) || source.studentId !== review.studentId || source.values.examId !== review.examId || source.values.subjectId !== review.subjectId))
    throw new Error("The linked review request changed. Reject this proposal and request a fresh review.");
  let next = y, correctedPublicationId: string | null = null;
  if (data.decision === "approved" && !review.publicationId) {
    const exam = y.records.exams.find(e => e.id === review.examId && e.status !== "completed"), mark = y.records.marks.find(m => m.examId === review.examId && m.studentId === review.studentId && m.subjectId === review.subjectId);
    if (!exam || !mark || mark.marks !== review.previousMarks || review.proposedMarks > exam.maxMarks)
      throw new Error("The assessment or mark changed. Request fresh moderation.");
    next = { ...y, records: { ...y.records, marks: y.records.marks.map(m => m.id === mark.id ? { ...m, marks: review.proposedMarks, remark: data.note.slice(0, 300) } : m) } };
  }
  if (data.decision === "approved" && review.publicationId) {
    const pub = y.workflows.publications.find(p => p.id === review.publicationId && !p.revokedAt), exam = y.records.exams.find(e => e.id === review.examId && e.status === "completed"), mark = y.records.marks.find(m => m.examId === review.examId && m.studentId === review.studentId && m.subjectId === review.subjectId);
    if (!pub || !exam || !mark || mark.marks !== review.previousMarks)
      throw new Error("The result changed or was revoked. Request a fresh review.");
    const bands = publishResultsSchema.parse({ examId: exam.id, gradeBands: pub.snapshot.gradeBands }).gradeBands.sort((a, b) => b.minimum - a.minimum);
    const subjects = z.array(resultSubjectSnapshotSchema).parse(pub.snapshot.subjects).map(s => {
      if (s.subjectId !== review.subjectId)
        return s;
      const percent = Math.round(review.proposedMarks / s.maximum * 10000) / 100;
      return { ...s, marks: review.proposedMarks, percent, grade: bands.find(b => percent >= b.minimum)!.label, remark: data.note.slice(0, 300) };
    });
    const total = subjects.reduce((s, m) => s + m.marks, 0), maximum = subjects.reduce((s, m) => s + m.maximum, 0), percent = Math.round(total / maximum * 10000) / 100, counter = (y.workflows.counters["report-card"] ?? 0) + 1;
    const corrected = publicationSchema.parse({ ...pub, id: crypto.randomUUID(), reference: `RC-${y.setup.calendar.year.id.slice(0, 60)}-${String(counter).padStart(6, "0")}`, version: 1 + Math.max(...y.workflows.publications.filter(p => p.kind === "report-card" && p.sourceId === exam.id && p.ownerId === review.studentId).map(p => p.version)), issuedAt: at, issuedBy: a.id, snapshot: { ...pub.snapshot, subjects, total, maximum, percent, grade: bands.find(b => percent >= b.minimum)!.label, passed: subjects.every(s => s.marks >= exam.passMarks), correction: { reviewId: review.id, replacesReference: pub.reference, reason: data.note } } });
    correctedPublicationId = corrected.id;
    next = { ...y, records: { ...y.records, marks: y.records.marks.map(m => m.id === mark.id ? { ...m, marks: review.proposedMarks, remark: data.note.slice(0, 300) } : m) }, workflows: { ...y.workflows, counters: { ...y.workflows.counters, "report-card": counter }, publications: [...y.workflows.publications.map(p => {
            const assessments = p.kind === "transcript" ? z.array(z.object({ reference: z.string() })).safeParse(p.snapshot.assessments) : null;
            const affected = p.id === pub.id || Boolean(assessments?.success && assessments.data.some(r => r.reference === pub.reference));
            return affected && !p.revokedAt ? { ...p, revokedAt: at, revocationReason: `Superseded by corrected result ${corrected.reference}` } : p;
          }), corrected] } };
  }
  return { ...next, extensions: next.extensions.map(row => row.id === review.sourceOperationId && ["draft", "submitted"].includes(row.status) ? { ...row, status: data.decision === "approved" ? "completed" : "cancelled", values: row.kind === "re-evaluations" ? { ...row.values, decision: data.note } : row.values, history: [...row.history, { at, actorId: a.id, action: `Result review ${data.decision}: ${review.id}`.slice(0, 200) }] } : row), workflows: { ...next.workflows, resultReviews: next.workflows.resultReviews.map(r => r.id === review.id ? { ...r, status: data.decision, decidedBy: a.id, decidedAt: at, decisionNote: data.note, correctedPublicationId } : r) } };
}
/** A locked exam may change only the exact mark and snapshot approved in this commit. */
export function assertApprovedResultChanges(old: SchoolYearWorkspace, next: SchoolYearWorkspace, examId: string) {
  const accepted = next.workflows.resultReviews.filter(r => r.examId === examId && r.status === "approved" && old.workflows.resultReviews.some(o => o.id === r.id && o.status === "submitted"));
  if (!accepted.length)
    return false;
  let expected = old;
  for (const review of accepted)
    expected = decideResultReview(expected, { id: review.decidedBy!, schoolId: old.setup.school.id, role: "admin", personId: null, email: "review-check@greenfield.test", name: "Review integrity" }, { id: review.id, decision: "approved", note: review.decisionNote });
  return JSON.stringify(expected.records.marks.filter(m => m.examId === examId)) === JSON.stringify(next.records.marks.filter(m => m.examId === examId)) && accepted.every(r => {
    const expectedReview = expected.workflows.resultReviews.find(v => v.id === r.id), expectedPub = expected.workflows.publications.find(p => p.id === expectedReview?.correctedPublicationId), actual = next.workflows.publications.find(p => p.id === r.correctedPublicationId);
    return actual && expectedPub && actual.sourceId === examId && actual.ownerId === r.studentId && actual.reference === expectedPub.reference && actual.version === expectedPub.version && JSON.stringify(actual.snapshot) === JSON.stringify(expectedPub.snapshot);
  });
}
