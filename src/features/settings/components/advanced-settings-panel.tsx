"use client";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
} from "../../workspace/hooks/workflow-actions";
export function AdvancedSettingsPanel() {
  const { year: y, unavailable, submit } = useWorkflowActions();
  return (
    <>
      <form
        className="op-card conversation-form"
        onSubmit={submit("settings", (f) => ({
          ...y.workflows.advanced,
          curricula: f.getAll("curricula"),
          instructionalWeekdays: f.getAll("weekdays").map(Number),
          locale: text(f, "locale"),
          timezone: text(f, "timezone"),
          absenceEscalationDays: Number(f.get("escalation")),
          examEligibilityPercent: Number(f.get("eligibility")),
          examEligibilityEnforced: f.has("enforce"),
        }))}
      >
        <h2>Academic configuration</h2>
        <div className="op-links">
          {["CBSE", "ICSE", "State", "IB", "IGCSE"].map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                name="curricula"
                value={c}
                defaultChecked={y.workflows.advanced.curricula.includes(
                  c as "CBSE",
                )}
              />
              {c}
            </label>
          ))}
        </div>
        <fieldset>
          <legend>Instructional weekdays</legend>
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((d, i) => (
            <label className="mr-4" key={d}>
              <input
                name="weekdays"
                type="checkbox"
                value={i}
                defaultChecked={y.workflows.advanced.instructionalWeekdays.includes(
                  i,
                )}
              />{" "}
              {d}
            </label>
          ))}
        </fieldset>
        <Field label="Document locale">
          <select name="locale" defaultValue={y.workflows.advanced.locale}>
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi (India)</option>
          </select>
        </Field>
        <Field label="School timezone">
          <input
            required
            name="timezone"
            defaultValue={y.workflows.advanced.timezone}
          />
        </Field>
        <Field label="Consecutive absence escalation days">
          <input
            name="escalation"
            required
            type="number"
            min={1}
            max={30}
            defaultValue={y.workflows.advanced.absenceEscalationDays}
          />
        </Field>
        <Field label="Minimum exam attendance (%)">
          <input
            name="eligibility"
            required
            type="number"
            min={0}
            max={100}
            defaultValue={y.workflows.advanced.examEligibilityPercent}
          />
        </Field>
        <label>
          <input
            name="enforce"
            type="checkbox"
            defaultChecked={y.workflows.advanced.examEligibilityEnforced}
          />{" "}
          Require complete attendance eligibility before publishing results
        </label>
        <Button type="submit" disabled={unavailable}>
          Save configuration
        </Button>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("settings", (f) => ({
          ...y.workflows.advanced,
          customFields: [
            ...y.workflows.advanced.customFields,
            {
              key: text(f, "key"),
              label: text(f, "label"),
              entity: text(f, "entity"),
              type: text(f, "type"),
              required: f.has("required"),
              options: text(f, "options")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              readRoles: [
                "admin",
                "principal",
                ...(f.has("hr-access") ? ["hr"] : []),
              ],
            },
          ],
        }))}
      >
        <h2>Add a custom field</h2>
        <p>
          New fields are visible to school administrators. Required fields are
          checked when saving custom record details.
        </p>
        <Field label="Field name">
          <input name="label" required minLength={2} />
        </Field>
        <Field label="Field key">
          <input
            name="key"
            required
            pattern="[a-z][a-z0-9_]{1,39}"
            placeholder="previous_school"
          />
        </Field>
        <Field label="Record type">
          <select name="entity">
            <option value="student">Student</option>
            <option value="staff">Staff</option>
            <option value="admission">Admission</option>
          </select>
        </Field>
        <Field label="Value type">
          <select name="type">
            {["text", "number", "date", "choice", "boolean"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Choice options (comma separated)">
          <input name="options" />
        </Field>
        <label>
          <input type="checkbox" name="required" /> Required
        </label>
        <label>
          <input type="checkbox" name="hr-access" /> Allow HR to read this field
          on permitted records
        </label>
        <Button type="submit" disabled={unavailable}>
          Add custom field
        </Button>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("settings", (f) => ({
          ...y.workflows.advanced,
          approvalPolicies: [
            ...y.workflows.advanced.approvalPolicies,
            {
              id: crypto.randomUUID(),
              name: text(f, "name"),
              kind: text(f, "kind"),
              roles: [text(f, "first"), text(f, "second")].filter(Boolean),
              slaHours: Number(f.get("hours")),
              enabled: true,
            },
          ],
        }))}
      >
        <h2>Configure an approval chain</h2>
        <Field label="Policy name">
          <input name="name" required minLength={2} />
        </Field>
        <Field label="Workflow">
          <select name="kind">
            {[
              "purchase-orders",
              "expenses",
              "outpasses",
              "training",
              "refunds",
              "payment-plans",
              "contracts",
              "moderation",
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="First reviewer">
          <select name="first">
            {[
              "principal",
              "admin",
              "accountant",
              "hr",
              "inventory",
              "warden",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Second reviewer (optional)">
          <select name="second">
            <option value="">One review step</option>
            {[
              "principal",
              "admin",
              "accountant",
              "hr",
              "inventory",
              "warden",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Review target (hours)">
          <input
            name="hours"
            type="number"
            required
            min={1}
            max={720}
            defaultValue={24}
          />
        </Field>
        <Button type="submit" disabled={unavailable}>
          Add approval policy
        </Button>
        {y.workflows.advanced.approvalPolicies.map((p) => (
          <p key={p.id}>
            {p.name} · {p.kind} · {p.roles.join(" → ")} · {p.slaHours} hours
          </p>
        ))}
      </form>
      <section className="op-card mt-6">
        <h2>Custom fields</h2>
        {y.workflows.advanced.customFields.map((f) => (
          <p key={`${f.entity}:${f.key}`}>
            {f.label} · {f.entity} · {f.type}
            {f.required ? " · required" : ""}
          </p>
        ))}
      </section>
    </>
  );
}
