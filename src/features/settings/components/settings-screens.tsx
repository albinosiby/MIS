"use client";
import { useBackend } from "../../identity/components/identity-context";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { schoolProfileSchema } from "@/shared/schemas/school";
import { classSectionSchema } from "@/shared/schemas/academics";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { WorkspaceScreenProps } from "../../workspace/components/workspace-screen";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  DataForm,
  LinkButton,
  ExportButton,
  staffOptions,
  labelFor,
  newRecord,
  money,
  enumOptions,
  printSection,
} from "../../workspace/components/workspace-ui";
import { DesignIcon } from "../../workspace/components/design-icon";
import { WorkspaceDataTools } from "../../workspace/components/workspace-data-tools";
import { putRecord } from "../../workspace/domain/operations";
import { preferenceSchema } from "../schemas/settings.schema";
import { rolloverBlockers, rolloverYear } from "../domain/rollover";
import { readableError } from "../../school-setup/components/form-errors";
export default function SettingsScreens({
  route,
  search,
}: WorkspaceScreenProps) {
  const backend = useBackend();
  const { root, year: y, mutate, replace, busy } = useWorkspace();
  const [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState(""),
    [category, setCategory] = useState("all"),
    [profile, setProfile] = useState(() => structuredClone(y.setup.school)),
    [prefs, setPrefs] = useState(() => structuredClone(y.records.preferences));
  const blockers = rolloverBlockers(root);
  if (route === "/notifications")
    return (
      <>
        <div className="ws-actions">
          <Button
            disabled={busy}
            onClick={async () => {
              try {
                await mutate(
                  (current) => ({
                    ...current,
                    records: {
                      ...current.records,
                      notifications: current.records.notifications.map((n) => ({
                        ...n,
                        read: true,
                      })),
                    },
                  }),
                  "Marked all notifications read",
                );
              } catch (e) {
                setError(readableError(e));
              }
            }}
          >
            Mark all as read
          </Button>
          <Select
            aria-label="Notification category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {enumOptions([
              "all",
              "urgent",
              "approvals",
              "statutory",
              "finance",
              "general",
            ]).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Panel title="Notifications & alerts · Local feed">
          {y.records.notifications
            .filter(
              (n) =>
                (category === "all" || category === n.category) &&
                `${n.title} ${n.body}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((n) => (
              <article
                key={n.id}
                className={`ws-notification ${n.read ? "" : "unread"}`}
              >
                <Badge tone={n.category === "urgent" ? "red" : "blue"}>
                  {n.category}
                </Badge>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <time>{new Date(n.createdAt).toLocaleString()}</time>
                </div>
                <div className="ws-actions">
                  <LinkButton href={n.href}>Open</LinkButton>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await mutate(
                          (current) =>
                            putRecord(current, "notifications", {
                              ...n,
                              read: !n.read,
                            }),
                          "Updated notification read status",
                        );
                      } catch (e) {
                        setError(readableError(e));
                      }
                    }}
                  >
                    {n.read ? "Mark unread" : "Mark read"}
                  </Button>
                </div>
              </article>
            ))}
        </Panel>
        {error && (
          <p role="alert" className="config-errors">
            {error}
          </p>
        )}
      </>
    );
  if (route === "/support")
    return (
      <>
        <Panel title="Using the school workspace">
          <div className="ws-panel-body">
            <h3>Where is my data saved?</h3>
            <p>
              In this browser, for this origin. Refresh keeps your changes.
              Export a full backup before clearing browser storage.
            </p>
            <h3>Are payments, messages or government sync real?</h3>
            <p>
              Payment processing and external delivery require configured
              providers. Your school workspace records are saved independently
              of those connections.
            </p>
            <h3>How do I test a complete school year?</h3>
            <p>
              Complete school setup, create students and staff, mark attendance,
              configure the timetable, assign coursework, enter results, record
              fee entries and review rollover blockers.
            </p>
            <h3>How do I recover from another tab changing data?</h3>
            <p>
              Export unsaved work if needed, then reload saved data from the
              workspace controls. A stale tab cannot silently overwrite newer
              data.
            </p>
          </div>
        </Panel>
        <WorkspaceDataTools />
      </>
    );
  if (route === "/settings/year-end") {
    const start = new Date(y.setup.calendar.year.startDate + "T00:00:00Z"),
      end = new Date(y.setup.calendar.year.endDate + "T00:00:00Z");
    start.setUTCFullYear(start.getUTCFullYear() + 1);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return (
      <>
        <Metrics
          items={[
            {
              label: "Promotion directives",
              value: y.records.promotions.length,
            },
            {
              label: "Outstanding carry-forward",
              value: money(
                y,
                y.records.invoices
                  .filter((i) => i.status === "issued")
                  .reduce(
                    (s, i) =>
                      s +
                      i.lines.reduce((n, l) => n + l.amountMinor, 0) -
                      i.concessionMinor -
                      y.records.payments
                        .filter(
                          (p) =>
                            p.invoiceId === i.id && p.status === "completed",
                        )
                        .reduce(
                          (n, p) => n + p.amountMinor - p.refundedMinor,
                          0,
                        ),
                    0,
                  ),
              ),
            },
            { label: "Blocking checks", value: blockers.length },
          ]}
        />
        <Panel title="Year-end rollover safeguards">
          <div className="ws-panel-body">
            {blockers.length ? (
              <ul>
                {blockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            ) : (
              <p className="config-success">All prerequisite checks passed.</p>
            )}
            <div className="ws-actions">
              <LinkButton href="/school-setup">Review setup</LinkButton>
              <LinkButton href="/students/promotions">
                Review cohort map
              </LinkButton>
              <LinkButton href="/dashboard/approvals">
                Review approvals
              </LinkButton>
              <LinkButton href="/exams">Review exam locks</LinkButton>
            </div>
          </div>
          <DataForm
            initial={{
              name: `${start.getUTCFullYear()}–${String(end.getUTCFullYear()).slice(-2)}`,
              startDate: start.toISOString().slice(0, 10),
              endDate: end.toISOString().slice(0, 10),
              acknowledged: false,
            }}
            fields={[
              { name: "name", label: "Upcoming academic year name" },
              { name: "startDate", label: "New year starts", type: "date" },
              { name: "endDate", label: "New year ends", type: "date" },
              {
                name: "acknowledged",
                label:
                  "I reviewed results, approvals and promotion directives. Create a separate year and archive this year.",
                type: "checkbox",
              },
            ]}
            submitLabel="Execute academic-year rollover"
            onSave={async (value) => {
              if (backend === "supabase") {
                await mutate((current) => current, "Created academic year", {
                  type: "year-rollover",
                  input: value,
                });
                return;
              }
              await replace(
                (current) => rolloverYear(current, value),
                "Created new academic year with retained historical records",
              );
            }}
          />
        </Panel>
        <WorkspaceDataTools />
      </>
    );
  }
  if (route === "/profile") {
    const principal = y.setup.staff[0],
      details = y.records.staffProfiles.find((p) => p.staffId === principal.id);
    return (
      <>
        <div className="ws-profile-hero">
          <div className="ws-avatar">{principal.displayName.slice(0, 1)}</div>
          <div>
            <h2>{principal.displayName}</h2>
            <p>{principal.designation}</p>
            <Badge>campus administrator</Badge>
          </div>
        </div>
        <Metrics
          items={[
            { label: "Students overseen", value: y.setup.students.length },
            { label: "Faculty members", value: y.setup.staff.length },
            { label: "Local academic years", value: root.years.length },
          ]}
        />
        <div className="ws-two-column">
          <div>
            <Panel title="Personal & contact details">
              <DataForm
                initial={{
                  name: principal.displayName,
                  email: details?.email ?? y.setup.school.email,
                  phone: details?.phone ?? y.setup.school.phone,
                }}
                fields={[
                  { name: "name", label: "Full name" },
                  { name: "email", label: "Official email" },
                  { name: "phone", label: "Official contact line" },
                ]}
                onSave={async (value) => {
                  const raw = value as Record<string, unknown>;
                  const person = { ...principal, displayName: raw.name };
                  await mutate((current) => {
                    const next = {
                      ...current,
                      setup: {
                        ...current.setup,
                        staff: current.setup.staff.map((s) =>
                          s.id === principal.id ? person : s,
                        ),
                      },
                    };
                    if (details)
                      return putRecord(
                        next as typeof current,
                        "staffProfiles",
                        { ...details, email: raw.email, phone: raw.phone },
                      );
                    throw new Error("Complete this staff profile first.");
                  }, "Updated principal profile");
                }}
              />
            </Panel>
            <Panel title="Credentials, biography & preferences">
              <DataForm
                initial={y.records.preferences}
                fields={[
                  { name: "qualification", label: "Highest qualification" },
                  {
                    name: "principalBio",
                    label: "Institutional biography",
                    type: "textarea",
                  },
                  {
                    name: "emergencyAlerts",
                    label: "Emergency substitution alerts",
                    type: "checkbox",
                  },
                  {
                    name: "auditAlerts",
                    label: "Audit trail alerts",
                    type: "checkbox",
                  },
                  {
                    name: "weeklyDigest",
                    label: "Weekly executive digest",
                    type: "checkbox",
                  },
                ]}
                onSave={async (value) => {
                  const preferences = preferenceSchema.parse(value);
                  await mutate(
                    (current) => ({
                      ...current,
                      records: { ...current.records, preferences },
                    }),
                    "Updated profile preferences",
                  );
                }}
              />
            </Panel>
          </div>
          <aside>
            <Panel title="Governance & MFA">
              <div className="ws-panel-body">
                <h3>
                  {details
                    ? labelFor(
                        y.records.roles.map((r) => ({
                          value: r.id,
                          label: r.name,
                        })),
                        details.roleId,
                      )
                    : "Profile incomplete"}
                </h3>
                <p>
                  Role presets describe staff responsibilities. Account
                  permissions control access to school records.
                </p>
                <Badge tone="gray">MFA not configured</Badge>
                <LinkButton href="/account/security">
                  Account security
                </LinkButton>
                <LinkButton href="/staff/roles">Roles & permissions</LinkButton>
              </div>
            </Panel>
          </aside>
        </div>
        {editor}
      </>
    );
  }
  function field(
    key:
      | "name"
      | "shortName"
      | "curriculum"
      | "affiliationNumber"
      | "email"
      | "phone"
      | "timezone"
      | "locale"
      | "currency",
    label: string,
  ) {
    return (
      <label className="ws-setting-field" key={key}>
        {label}
        <Input
          aria-label={label}
          value={profile[key] ?? ""}
          onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
        />
      </label>
    );
  }
  return (
    <>
      <header className="ws-page-header">
        <div>
          <h1>Settings</h1>
          <p>
            <Badge tone="green">
              Master Console · Active AY {y.setup.calendar.year.name}
            </Badge>
          </p>
          <p>
            Institutional parameters, academic term schedules, class capacity
            matrix, roles, regional localization, and year-end rollover
            controls.
          </p>
        </div>
        <div className="ws-actions">
          <ExportButton
            name="settings-audit"
            report="audit"
            rows={y.setup.audit}
          />
          <Button
            type="submit"
            form="settings-master-form"
            disabled={busy || y.locked}
          >
            <DesignIcon group="settings" name="imgContainer1" />
            Save All Settings
          </Button>
        </div>
      </header>
      {error && (
        <p role="alert" className="config-errors">
          {error}
        </p>
      )}
      <div className="ws-two-column">
        <form
          id="settings-master-form"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const school = schoolProfileSchema.parse(profile),
                preferences = preferenceSchema.parse(prefs);
              await mutate((current) => {
                const changed =
                  JSON.stringify(school) !==
                  JSON.stringify(current.setup.school);
                return {
                  ...current,
                  setup: {
                    ...current.setup,
                    school,
                    completed: changed ? [] : current.setup.completed,
                    portal: {
                      ...current.setup.portal,
                      invitationsPrepared: changed
                        ? false
                        : current.setup.portal.invitationsPrepared,
                    },
                  },
                  records: { ...current.records, preferences },
                };
              }, "Saved institutional settings");
              setError("");
            } catch (e) {
              setError(readableError(e));
            }
          }}
        >
          <Panel
            title={
              <>
                <DesignIcon group="settings" name="imgContainer2" />
                School Profile, Affiliation & Official Seal
              </>
            }
          >
            <div className="ws-panel-body">
              <div className="ws-form-grid">
                {field("name", "Official institution name")}
                {field("shortName", "Short name")}
                {field("curriculum", "Curriculum / board")}
                {field("affiliationNumber", "Affiliation number")}
                {field("email", "Administrative email")}
                {field("phone", "Registrar contact number")}
                {(
                  [
                    "line1",
                    "line2",
                    "city",
                    "region",
                    "postalCode",
                    "countryCode",
                  ] as const
                ).map((key) => (
                  <label className="ws-setting-field" key={key}>
                    {key}
                    <Input
                      aria-label={`School address ${key}`}
                      value={profile.address[key] ?? ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          address: { ...p.address, [key]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
                <label className="ws-setting-field">
                  School code
                  <Input
                    aria-label="School code"
                    value={prefs.schoolCode}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, schoolCode: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="ws-sticky-bar">
                <DesignIcon group="settings" name="imgContainer3" />
                <span>Institutional crest & watermark</span>
                <LinkButton href="/school-setup/school-profile">
                  Update crest / seal
                </LinkButton>
                <Badge>preview only</Badge>
              </div>
            </div>
          </Panel>
          <Panel
            title={
              <>
                <DesignIcon group="settings" name="imgContainer5" />
                Academic Year & Term Configuration
              </>
            }
            action={
              <LinkButton href="/school-setup/academic-terms">
                Configure terms
              </LinkButton>
            }
          >
            <Table
              headers={["Term identification", "Date span", "Lifecycle"]}
              rows={y.setup.calendar.terms.map((t) => [
                t.name,
                `${t.startDate} → ${t.endDate}`,
                <Badge>{y.locked ? "Archived" : "Configured"}</Badge>,
              ])}
            />
            <div className="ws-panel-body">
              <DesignIcon group="settings" name="imgContainer6" /> Daily bell
              structure ·{" "}
              {y.setup.bells.filter((b) => b.kind === "period").length} periods
              <LinkButton href="/school-setup/bell-schedule">
                Configure bells
              </LinkButton>
            </div>
          </Panel>
          <Panel
            title={
              <>
                <DesignIcon group="settings" name="imgContainer7" />
                Class & Section Capacity Matrix
              </>
            }
            action={
              <Button
                variant="outline"
                onClick={() =>
                  setEditor(
                    <Dialog title="New section" onClose={() => setEditor(null)}>
                      <DataForm
                        initial={{
                          id: crypto.randomUUID(),
                          schoolId: y.setup.school.id,
                          academicYearId: y.setup.calendar.year.id,
                          grade: "",
                          section: "A",
                          capacity: 40,
                        }}
                        fields={[
                          { name: "grade", label: "Grade level" },
                          { name: "section", label: "Section" },
                          {
                            name: "capacity",
                            label: "Capacity",
                            type: "number",
                          },
                        ]}
                        onSave={async (value) => {
                          const section = classSectionSchema.parse(value);
                          await mutate(
                            (current) => ({
                              ...current,
                              setup: {
                                ...current.setup,
                                classes: [...current.setup.classes, section],
                                completed: current.setup.completed.slice(0, 2),
                                portal: {
                                  ...current.setup.portal,
                                  invitationsPrepared: false,
                                },
                              },
                            }),
                            "Created class section",
                          );
                          setEditor(null);
                        }}
                      />
                    </Dialog>,
                  )
                }
              >
                + New section
              </Button>
            }
          >
            <Table
              headers={[
                "Grade & section",
                "Roster / capacity",
                "Utilization",
                "Actions",
              ]}
              rows={y.setup.classes.map((c) => {
                const count = y.setup.students.filter(
                  (s) => s.classSectionId === c.id,
                ).length;
                return [
                  `${c.grade}-${c.section}`,
                  `${count}/${c.capacity}`,
                  <div className="ws-progress">
                    <span style={{ width: (count / c.capacity) * 100 + "%" }} />
                  </div>,
                  <LinkButton href="/school-setup/classes-sections">
                    Edit matrix
                  </LinkButton>,
                ];
              })}
            />
          </Panel>
          <Panel
            title={
              <>
                <DesignIcon group="settings" name="imgContainer8" />
                Roles & RBAC Quick Governance
              </>
            }
            action={
              <LinkButton href="/staff/roles">
                Configure granular ACL
              </LinkButton>
            }
          >
            <Table
              headers={["Role preset", "Permission scopes"]}
              rows={y.records.roles.map((r) => [
                r.name,
                <div className="ws-actions">
                  {r.permissions.map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </div>,
              ])}
            />
          </Panel>
          <Panel
            title={
              <>
                <DesignIcon group="settings" name="imgContainer9" />
                Language, Timezone & Regional Localization
              </>
            }
          >
            <div className="ws-panel-body">
              <div className="ws-form-grid">
                <label className="ws-setting-field">
                  Default document language
                  <Select
                    aria-label="Document language"
                    value={prefs.language}
                    onChange={(e) => {
                      const language = e.target.value as "English" | "Hindi";
                      setPrefs((p) => ({ ...p, language }));
                      setProfile((p) => ({
                        ...p,
                        locale: language === "Hindi" ? "hi-IN" : "en-IN",
                      }));
                    }}
                  >
                    {["English", "Hindi"].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </Select>
                </label>
                <label className="ws-setting-field">
                  Date display pattern
                  <Select
                    aria-label="Date display pattern"
                    value={prefs.dateFormat}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        dateFormat: e.target.value as typeof p.dateFormat,
                      }))
                    }
                  >
                    {["DD MMM YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </Select>
                </label>
                {field("timezone", "Campus timezone")}
                {field("locale", "Formatting locale")}
                {field("currency", "Currency code")}
                <label className="ws-setting-field">
                  Letterhead footer
                  <Input
                    aria-label="Letterhead footer"
                    value={prefs.letterheadFooter}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        letterheadFooter: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <h3>Working week</h3>
              <div className="ws-check-list">
                {(
                  [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ] as const
                ).map((day) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={prefs.workingDays.includes(day)}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          workingDays: e.target.checked
                            ? [...p.workingDays, day]
                            : p.workingDays.filter((d) => d !== day),
                        }))
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
          </Panel>
        </form>
        <aside>
          <Panel
            title={
              <>
                <DesignIcon group="settings" name="imgContainer14" />
                Live Letterhead & Bonafide Preview
              </>
            }
            action={
              <Button
                variant="outline"
                onClick={() => printSection("settings-letterhead")}
              >
                Print sample PDF
              </Button>
            }
          >
            <article id="settings-letterhead" className="ws-letterhead">
              <h3>{profile.name.toUpperCase()}</h3>
              <p style={{ textAlign: "center" }}>
                Affiliation #{profile.affiliationNumber} · {prefs.schoolCode}
                <br />
                {profile.address.line1}, {profile.address.city}
              </p>
              <hr />
              <p>Ref:/{y.setup.calendar.year.name}/001</p>
              <h3>
                {prefs.language === "Hindi"
                  ? "प्रमाण पत्र"
                  : "TO WHOMSOEVER IT MAY CONCERN"}
              </h3>
              <p>
                This is a workspace student certificate preview for{" "}
                {y.setup.students[0]?.displayName ?? "a student"} in academic
                year {y.setup.calendar.year.name}.
              </p>
              <div className="ws-stamp">
                {y.setup.staff[0].displayName}
                <br />
                Principal · workspace preview
              </div>
              <small>{prefs.letterheadFooter}</small>
            </article>
            <div className="ws-panel-body">
              <LinkButton href="/students/certificates">
                Issue student certificate
              </LinkButton>
            </div>
          </Panel>
          <Panel
            title={
              <>
                <DesignIcon group="settings" name="imgContainer18" />
                Year-End Rollover Safeguard
              </>
            }
          >
            <div className="ws-panel-body">
              <Metrics
                items={[
                  {
                    label: "Cohort directives",
                    value: y.records.promotions.length,
                  },
                  { label: "Blocking checks", value: blockers.length },
                ]}
              />
              {blockers.length ? (
                <div className="config-errors">
                  {blockers.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                </div>
              ) : (
                <Badge tone="green">Ready for reviewed rollover</Badge>
              )}
              <LinkButton href="/settings/year-end">
                Review & execute rollover →
              </LinkButton>
            </div>
          </Panel>
        </aside>
      </div>
      <WorkspaceDataTools />
      {editor}
    </>
  );
}
