"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import { useWorkflowActions, workflowText as text, StudentOptions } from "../../workspace/hooks/workflow-actions";
import { resultSubjectSnapshotSchema } from "../schemas/review.schema";
import { z } from "zod";
export function ResultReviewPanel() {
  const { year:y, actor, unavailable, submit } = useWorkflowActions();
  const [publicationId,setPublicationId] = useState("");
  const report = y.workflows.publications.find(p => p.id === publicationId);
  const parsed = z.array(resultSubjectSnapshotSchema).safeParse(report?.snapshot.subjects);
  const subjects = parsed.success ? parsed.data : [];
  const reviewer = ["admin","principal"].includes(actor.role);
  const sourceRequests=y.extensions.filter(r=>["moderation","re-evaluations"].includes(r.kind)&&["draft","submitted"].includes(r.status));
  const sources=<><option value="">Independent review (no earlier request)</option>{sourceRequests.map(r=><option key={r.id} value={r.id}>{r.title} · {y.setup.students.find(s=>s.id===r.studentId)?.displayName}</option>)}</>;
  return <>
    <form className="op-card conversation-form" onSubmit={submit("result-moderation-request",f=>({examId:text(f,"exam"),studentId:text(f,"student"),subjectId:text(f,"subject"),proposedMarks:Number(f.get("marks")),reason:text(f,"reason"),sourceOperationId:text(f,"source")||null}))}>
      <h2>Moderate marks before publication</h2><p>Submit an entered mark for independent review. Pending moderation blocks result publication until a reviewer records a decision.</p>
      <Field label="Unlocked assessment"><select name="exam" required><option value="">Select assessment</option>{y.records.exams.filter(e=>e.status!=="completed").map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
      <Field label="Student for moderation"><select name="student" required><StudentOptions/></select></Field>
      <Field label="Subject for moderation"><select name="subject" required>{y.records.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="Moderated mark"><input name="marks" type="number" min={0} max={1000} step="0.01" required/></Field>
      <Field label="Moderation reason"><textarea name="reason" required minLength={8} maxLength={500}/></Field>
      <Field label="Linked review request"><select name="source">{sources}</select></Field>
      <Button type="submit" disabled={unavailable}>Submit mark moderation</Button>
    </form>
    <form className="op-card conversation-form mt-6" onSubmit={submit("result-review-request", f => ({ publicationId:text(f,"publication"), subjectId:text(f,"subject"), proposedMarks:Number(f.get("marks")), reason:text(f,"reason"),sourceOperationId:text(f,"source")||null }))}>
      <h2>Request a corrected result</h2><p>Propose a changed subject mark against a current report card. A different examination administrator must decide. Accepted corrections issue a new version and revoke the replaced report and transcripts that depend on it.</p>
      <Field label="Current report card"><select name="publication" required value={publicationId} onChange={e=>setPublicationId(e.target.value)}><option value="">Select report card</option>{y.workflows.publications.filter(p=>p.kind==="report-card"&&!p.revokedAt).map(p=><option key={p.id} value={p.id}>{p.reference} · {String(p.snapshot.student)} · {p.title}</option>)}</select></Field>
      <Field label="Subject to review"><select name="subject" required key={publicationId}>{subjects.map(s=><option key={s.subjectId} value={s.subjectId}>{s.subject} · {s.marks}/{s.maximum}</option>)}</select></Field>
      <Field label="Proposed mark"><input name="marks" type="number" required min={0} max={1000} step="0.01" /></Field>
      <Field label="Reason and evidence"><textarea name="reason" required minLength={8} maxLength={500} /></Field>
      <Field label="Linked re-evaluation request"><select name="source">{sources}</select></Field>
      <Button type="submit" disabled={unavailable || !subjects.length}>Submit result review</Button>
    </form>
    <section className="op-card mt-6"><h2>Result review register</h2>{!y.workflows.resultReviews.length && <p>No correction reviews submitted.</p>}{y.workflows.resultReviews.toReversed().map(r=><article key={r.id} className="mt-6"><h3>{y.setup.students.find(s=>s.id===r.studentId)?.displayName} · {y.records.subjects.find(s=>s.id===r.subjectId)?.name}</h3><p>{r.previousMarks} → {r.proposedMarks} · {r.status} · {r.reason}</p>{r.decisionNote && <p>{r.decisionNote}</p>}{r.status==="submitted"&&reviewer&&r.requestedBy!==actor.id&&<form className="conversation-form" onSubmit={submit("result-review-decide",f=>({id:r.id,decision:text(f,"decision"),note:text(f,"note")}))}><Field label="Review decision"><select name="decision"><option value="approved">Approve and issue corrected version</option><option value="rejected">Reject proposed correction</option></select></Field><Field label="Decision explanation"><textarea name="note" required minLength={8} maxLength={500}/></Field><Button type="submit" disabled={unavailable}>Record review decision</Button></form>}{r.status==="submitted"&&r.requestedBy===actor.id&&<p>A separate reviewer must decide this request.</p>}</article>)}</section>
  </>;
}
