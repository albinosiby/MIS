"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import { useWorkflowActions, workflowText as text, StaffOptions } from "../../workspace/hooks/workflow-actions";
export function TimetablePublicationPanel() {
  const { year:y, actor, unavailable, run, submit } = useWorkflowActions();
  const reviewer = ["admin","principal"].includes(actor.role);
  return <>
    {reviewer&&<section className="op-card conversation-form"><h2>Timetable publication history</h2><p>Publication saves an immutable copy of the full timetable. Substitutions require a separate review and publication.</p><Link href="/timetable">Edit the working timetable →</Link><Button type="button" disabled={unavailable||!y.records.slots.length} onClick={()=>void run("timetable-publish",{})}>Publish timetable version</Button>{y.workflows.timetableVersions.toReversed().map(v=><details key={v.id}><summary>Version {v.version} · {new Date(v.publishedAt).toLocaleString()} · {v.slots.length} periods</summary>{v.slots.map(s=><p key={s.id}>{s.weekday} · {s.className} · {s.periodName} · {s.subjectName} · {s.teacherName} · {s.room}</p>)}</details>)}</section>}
    <form className="op-card conversation-form mt-6" onSubmit={submit("substitution-request",f=>({slotId:text(f,"slot"),date:text(f,"date"),substituteStaffId:text(f,"staff"),reason:text(f,"reason")}))}>
      <h2>Request a teacher substitution</h2><p>The date must match the published slot weekday. Availability, leave and clashes are checked again at publication.</p>
      <Field label="Published teaching slot"><select name="slot" required><option value="">Select slot</option>{y.records.slots.filter(s=>s.status==="published"&&(reviewer||s.staffId===actor.personId)).map(s=><option key={s.id} value={s.id}>{s.weekday} · {y.setup.classes.find(c=>c.id===s.classSectionId)?.grade} {y.setup.classes.find(c=>c.id===s.classSectionId)?.section} · {y.setup.bells.find(b=>b.id===s.periodId)?.name} · {y.setup.staff.find(t=>t.id===s.staffId)?.displayName}</option>)}</select></Field>
      <Field label="Substitution date"><input name="date" type="date" required min={y.setup.calendar.year.startDate} max={y.setup.calendar.year.endDate}/></Field>
      <Field label="Substitute teacher"><select name="staff" required><StaffOptions/></select></Field>
      <Field label="Reason"><textarea name="reason" required minLength={8} maxLength={500}/></Field>
      <Button type="submit" disabled={unavailable}>Submit substitution for review</Button>
    </form>
    <section className="op-card mt-6"><h2>Substitution reviews</h2>{!y.workflows.substitutionReviews.length&&<p>No substitution requests recorded.</p>}{y.workflows.substitutionReviews.toReversed().map(r=><article key={r.id} className="mt-6"><h3>{r.substitution.date} · {r.status}</h3><p>{y.setup.staff.find(s=>s.id===r.substitution.absentStaffId)?.displayName} → {y.setup.staff.find(s=>s.id===r.substitution.substituteStaffId)?.displayName} · {r.substitution.reason}</p>{r.decisions.map((d,i)=><p key={i}>{d.decision}: {d.note}</p>)}{reviewer&&!["rejected","cancelled"].includes(r.status)&&<form className="conversation-form" onSubmit={submit("substitution-decide",f=>({id:r.id,decision:text(f,"decision"),note:text(f,"note")}))}><Field label="Substitution decision"><select name="decision">{r.status==="submitted"&&r.requestedBy!==actor.id&&<><option value="approved">Approve</option><option value="rejected">Reject</option></>}{r.status==="approved"&&<option value="published">Publish approved substitution</option>}<option value="cancelled">Cancel with recorded reason</option></select></Field><Field label="Reviewer note"><textarea name="note" required minLength={8} maxLength={500}/></Field><Button type="submit" disabled={unavailable}>Record substitution decision</Button></form>}{r.status==="submitted"&&r.requestedBy===actor.id&&<p>A separate reviewer must approve this request.</p>}</article>)}</section>
  </>;
}
