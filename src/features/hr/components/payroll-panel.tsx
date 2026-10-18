"use client";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
  StaffOptions,
} from "../../workspace/hooks/workflow-actions";
export function PayrollPanel() {
  const { year: y, actor, unavailable, submit, run } = useWorkflowActions();
  const staffOptions = <StaffOptions />;
  return (
    <>
      <form
        className="op-card conversation-form"
        onSubmit={submit("payroll-policy", (f) => ({
          ...y.workflows.payrollPolicy,
          state: text(f, "state"),
          approvedBySchool: f.has("approved"),
        }))}
      >
        <h2>School payroll policy</h2>
        <p>
          India scope. Deductions require your school's approved rules;
          statutory rates are not assumed.
        </p>
        <Field label="State">
          <input name="state" defaultValue={y.workflows.payrollPolicy.state} />
        </Field>
        <label>
          <input
            name="approved"
            type="checkbox"
            defaultChecked={y.workflows.payrollPolicy.approvedBySchool}
          />{" "}
          School has reviewed and approved these rules
        </label>
        {y.workflows.payrollPolicy.rules.map((r) => (
          <p key={r.id}>
            {r.label} · {r.basis} ·{" "}
            {r.basis === "fixed"
              ? `${r.amountMinor / 100} INR`
              : `${r.rateBps / 100}%`}
            {r.employerOnly ? " (employer contribution)" : ""}
          </p>
        ))}
        <Button type="submit" disabled={unavailable}>
          Save payroll policy
        </Button>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("payroll-policy", (f) => ({
          ...y.workflows.payrollPolicy,
          approvedBySchool: false,
          rules: [
            ...y.workflows.payrollPolicy.rules,
            {
              id: crypto.randomUUID(),
              label: text(f, "label"),
              basis: text(f, "basis"),
              amountMinor: Math.round(Number(f.get("amount")) * 100),
              rateBps: Math.round(Number(f.get("rate")) * 100),
              employerOnly: f.has("employer"),
            },
          ],
        }))}
      >
        <h2>Add deduction or contribution</h2>
        <Field label="Rule name">
          <input required name="label" minLength={2} />
        </Field>
        <Field label="Basis">
          <select name="basis">
            <option value="fixed">Fixed amount</option>
            <option value="gross">Gross salary</option>
            <option value="basic">Basic salary</option>
          </select>
        </Field>
        <Field label="Fixed amount (INR)">
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
          />
        </Field>
        <Field label="Rate (%)">
          <input
            name="rate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={0}
          />
        </Field>
        <label>
          <input name="employer" type="checkbox" /> Employer contribution
        </label>
        <Button type="submit" disabled={unavailable}>
          Add rule for review
        </Button>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("payroll-policy", (f) => ({
          ...y.workflows.payrollPolicy,
          approvedBySchool: false,
          leaveTypes: [
            ...y.workflows.payrollPolicy.leaveTypes,
            {
              name: text(f, "name"),
              annualDays: Number(f.get("days")),
              paid: f.has("paid"),
            },
          ],
        }))}
      >
        <h2>Add a leave allowance</h2>
        <p>
          Allowances apply within the academic year and count configured
          instructional weekdays, excluding school-wide published holidays.
        </p>
        <Field label="Leave type">
          <input name="name" required minLength={2} maxLength={60} />
        </Field>
        <Field label="Working-day allowance">
          <input
            name="days"
            type="number"
            required
            min={0}
            max={366}
            defaultValue={12}
          />
        </Field>
        <label>
          <input name="paid" type="checkbox" defaultChecked /> Paid leave
        </label>
        <Button type="submit" disabled={unavailable}>
          Add leave type for review
        </Button>
        {y.workflows.payrollPolicy.leaveTypes.map((t) => (
          <p key={t.name}>
            {t.name} · {t.annualDays} working days ·{" "}
            {t.paid ? "paid" : "unpaid"}
          </p>
        ))}
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("salary-plan", (f) => ({
          staffId: text(f, "staff"),
          basicMinor: Math.round(Number(f.get("basic")) * 100),
          grossMinor: Math.round(Number(f.get("gross")) * 100),
          effectiveFrom: text(f, "effective"),
        }))}
      >
        <h2>Salary plan</h2>
        <Field label="Employee">
          <select name="staff">{staffOptions}</select>
        </Field>
        <Field label="Monthly basic (INR)">
          <input name="basic" type="number" min={1} step="0.01" required />
        </Field>
        <Field label="Monthly gross (INR)">
          <input name="gross" type="number" min={1} step="0.01" required />
        </Field>
        <Field label="Effective from">
          <input
            name="effective"
            type="date"
            required
            min={y.setup.calendar.year.startDate}
            max={y.setup.calendar.year.endDate}
          />
        </Field>
        <Button type="submit" disabled={unavailable}>
          Save salary plan
        </Button>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("payroll-prepare", (f) => ({
          period: text(f, "period"),
        }))}
      >
        <h2>Prepare monthly payroll</h2>
        <p>
          A different authorised reviewer must review the draft before
          finalisation. Earnings use calendar-day proration, with recorded
          absences and approved unpaid leave deducted.
        </p>
        <Field label="Payroll month">
          <input type="month" name="period" required />
        </Field>
        <Button type="submit" disabled={unavailable}>
          Prepare payroll draft
        </Button>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("employment", (f) => ({
          staffId: text(f, "staff"),
          kind: text(f, "kind"),
          date: text(f, "date"),
          note: text(f, "note"),
        }))}
      >
        <h2>Joining, exit & contract history</h2>
        <p>
          Effective exits stop staff-role access and salary accrual. A separate
          parent role remains independent. A recorded rejoining makes existing
          assigned staff roles eligible again.
        </p>
        <Field label="Employee">
          <select name="staff">{staffOptions}</select>
        </Field>
        <Field label="Employment event">
          <select name="kind">
            <option value="joined">Joined / rejoined</option>
            <option value="exited">Exited</option>
            <option value="contract-renewed">Contract renewed</option>
          </select>
        </Field>
        <Field label="Effective date">
          <input
            name="date"
            type="date"
            required
            min={y.setup.calendar.year.startDate}
            max={y.setup.calendar.year.endDate}
          />
        </Field>
        <Field label="Reason / record note">
          <textarea name="note" required minLength={8} maxLength={500} />
        </Field>
        <Button type="submit" disabled={unavailable}>
          Record employment event
        </Button>
        {y.workflows.employmentEvents.map((e) => (
          <p key={e.id}>
            {y.setup.staff.find((s) => s.id === e.staffId)?.displayName} ·{" "}
            {e.date} · {e.kind} · {e.note}
          </p>
        ))}
      </form>
      <section className="op-card mt-6">
        <h2>Payroll runs</h2>
        {!y.workflows.payrollRuns.length && <p>No payroll runs yet.</p>}
        {y.workflows.payrollRuns.map((r) => (
          <div key={r.id} className="mb-5">
            <h3>
              {r.period} · {r.status}
            </h3>
            <p>
              {r.lines.length} employees · net INR{" "}
              {(
                r.lines.reduce((s, l) => s + l.netMinor, 0) / 100
              ).toLocaleString("en-IN")}
            </p>
            {r.status !== "finalised" && (
              <Button
                disabled={
                  unavailable ||
                  (r.status === "draft" && r.createdBy === actor.id)
                }
                onClick={() => void run("payroll-progress", { id: r.id })}
              >
                {r.status === "draft"
                  ? "Review payroll"
                  : "Finalise & issue payslips"}
              </Button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
