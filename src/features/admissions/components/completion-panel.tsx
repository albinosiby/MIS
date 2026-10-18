"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import { useWorkflowActions, workflowText as text, StudentOptions } from "../../workspace/hooks/workflow-actions";
import { createAdmissionInvitation } from "../server/invitations";
export function AdmissionCompletionPanel() {
  const { year: y, unavailable, submit } = useWorkflowActions();
  const [applicationId, setApplicationId] = useState("");
  const [role, setRole] = useState("parent");
  const [personId,setPersonId]=useState("");
  const [invite, inviteAction, pending] = useActionState(createAdmissionInvitation, { error: "", link: "" });
  const application = y.records.inquiries.find(i => i.id === applicationId), people = role === "student" ? y.setup.students.filter(s => s.id === application?.studentId) : y.setup.guardians.filter(g => y.setup.relationships.some(r => r.studentId === application?.studentId && r.guardianId === g.id && r.canViewRecords));
  const activeStudents=y.setup.students.filter(s=>y.records.studentProfiles.some(p=>p.studentId===s.id&&p.status==="active"));
  const activeOptions=<><option value="">Select active student</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.displayName} · {s.admissionNumber}</option>)}</>;
  return <>
    <form action={inviteAction} className="op-card conversation-form">
      <h2>Admission portal handoff</h2><p>Verify identity and guardian authority before creating a linked, inactive invitation. The recipient chooses their password. Email delivery is not connected.</p>
      <Field label="Enrolled application"><select required name="applicationId" value={applicationId} onChange={e => setApplicationId(e.target.value)}><option value="">Select application</option>{y.records.inquiries.filter(i => i.stage === "enrolled").map(i => <option key={i.id} value={i.id}>{i.studentName}</option>)}</select></Field>
      <Field label="Portal role"><select name="role" value={role} onChange={e => setRole(e.target.value)}><option value="parent">Parent</option><option value="student">Student</option></select></Field>
      <Field label="Verified school person"><select required name="personId" key={`${role}:${applicationId}`} onChange={e=>setPersonId(e.target.value)}><option value="">Select linked person</option>{people.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></Field>
      <Field label="Recipient email"><input name="email" type="email" required key={`${applicationId}:${role}:${personId}`} defaultValue={role === "parent" ? y.setup.guardians.find(g=>g.id===personId)?.email : ""} /></Field>
      <label><input type="checkbox" required name="authorityVerified" /> I verified identity, contact details and authority to access these records.</label>
      <Button type="submit" disabled={unavailable || pending || !people.length}>Prepare private invitation</Button>
      <Link href="/settings/users">Existing accounts and invitations →</Link>
      {invite.error && <p role="alert" className="op-error">{invite.error}</p>}{invite.link && <p role="status"><Link href={invite.link}>Open one-use invitation</Link> · Share privately with the verified recipient; no email has been sent.</p>}
    </form>
    <form className="op-card conversation-form mt-6" onSubmit={submit("admission-continuation", f => ({ studentId: text(f,"student"), decision: text(f,"decision"), targetClassId: text(f,"class"), note: text(f,"note") }))}>
      <h2>Confirm next-year continuation</h2><p>This records re-enrolment intent and the promotion directive used by academic-year rollover. Current classes and fees stay effective until rollover.</p>
      <Field label="Student"><select name="student" required>{activeOptions}</select></Field>
      <Field label="Decision"><select name="decision"><option value="promote">Continue and promote</option><option value="retain">Continue in current class</option><option value="transfer">Leave at year end</option></select></Field>
      <Field label="Target class"><select name="class">{y.setup.classes.map(c => <option key={c.id} value={c.id}>{c.grade} {c.section}</option>)}</select></Field>
      <Field label="Continuation note"><textarea name="note" minLength={8} maxLength={500} required /></Field>
      <Button type="submit" disabled={unavailable}>Confirm continuation directive</Button><Link href="/settings/year-end">Review year rollover →</Link>
    </form>
    <form className="op-card conversation-form mt-6" onSubmit={submit("admission-withdrawal", f => ({ studentId: text(f,"student"), date: text(f,"date"), note: text(f,"note"), feeTreatment: text(f,"fees") }))}>
      <h2>Withdraw an active enrolment</h2><p>Close loans, hostel and outpasses first. Collected fees require a separate finance refund approval. This action preserves financial history and records the exit on the student timeline.</p>
      <Field label="Student to withdraw"><select name="student" required>{activeOptions}</select></Field>
      <Field label="Effective date"><input name="date" type="date" required min={y.setup.calendar.year.startDate} max={y.setup.calendar.year.endDate} /></Field>
      <Field label="Fee treatment"><select name="fees"><option value="retain-balance">Retain invoices and outstanding balances</option><option value="void-uncollected">Void issued invoices only if collections are fully returned</option></select></Field>
      <Field label="Withdrawal reason"><textarea name="note" required minLength={8} maxLength={500} /></Field>
      <label><input type="checkbox" required /> I reviewed the exit and selected fee treatment.</label>
      <Button type="submit" variant="outline" disabled={unavailable}>Record withdrawal</Button>
    </form>
    <section className="op-card mt-6"><h2>Admission decisions</h2>{!y.workflows.admissionDecisions.length && <p>No completion decisions recorded.</p>}{y.workflows.admissionDecisions.toReversed().map(d => <p key={d.id}>{y.setup.students.find(s => s.id === d.studentId)?.displayName} · {d.kind} · {d.feeTreatment ?? "Rollover directive"} · {d.note}</p>)}</section>
  </>;
}
