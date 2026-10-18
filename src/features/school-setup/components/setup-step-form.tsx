"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SetupConfig, SetupStepId } from "../models";
import { useSetupWorkspace } from "../hooks/setup-workspace-provider";
import {
  completeSetupStep,
  annualFeeMinor,
  setupPhases,
} from "../domain/setup-workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { IngestionEditor } from "./setup-ingestion";
import { readableError } from "./form-errors";

type Column<T> = {
  key: keyof T;
  label: string;
  type?: "text" | "number" | "date" | "time";
  options?: { value: string; label: string }[];
  factor?: number;
};
function Collection<T extends { id: string }>({
  label,
  rows,
  columns,
  onChange,
  create,
}: {
  label: string;
  rows: T[];
  columns: Column<T>[];
  onChange: (rows: T[]) => void;
  create: () => T;
}) {
  return (
    <section className="config-collection">
      <header>
        <h3>{label}</h3>
        <Button variant="outline" onClick={() => onChange([...rows, create()])}>
          + Add {label.toLowerCase().replace(/s$/, "")}
        </Button>
      </header>
      {rows.map((row, index) => (
        <fieldset key={row.id} className="config-row">
          <legend>
            {label} {index + 1}
          </legend>
          <div className="config-grid">
            {columns.map((col) => {
              const id = `${row.id}-${String(col.key)}`;
              const raw = row[col.key];
              const value =
                typeof raw === "number"
                  ? raw / (col.factor ?? 1)
                  : String(raw ?? "");
              const change = (value: string) =>
                onChange(
                  rows.map((r) =>
                    r.id === row.id
                      ? {
                          ...r,
                          [col.key]:
                            col.type === "number"
                              ? value === ""
                                ? NaN
                                : Math.round(
                                    Number(value) * (col.factor ?? 1) * 100,
                                  ) / 100
                              : value,
                        }
                      : r,
                  ),
                );
              return (
                <Field key={String(col.key)} id={id} label={col.label}>
                  {col.options ? (
                    <Select
                      id={id}
                      value={String(value)}
                      onChange={(e) => change(e.target.value)}
                    >
                      <option value="">Choose…</option>
                      {col.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      type={col.type ?? "text"}
                      step={
                        col.factor
                          ? "0.01"
                          : col.type === "number"
                            ? "1"
                            : undefined
                      }
                      value={
                        typeof value === "number" && !Number.isFinite(value)
                          ? ""
                          : value
                      }
                      onChange={(e) => change(e.target.value)}
                    />
                  )}
                </Field>
              );
            })}
          </div>
          <Button
            variant="ghost"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
          >
            Remove {index + 1}
          </Button>
        </fieldset>
      ))}
      {!rows.length && (
        <p className="config-empty">
          No records yet. Add the first one to continue.
        </p>
      )}
    </section>
  );
}
export function SetupStepForm({ step }: { step: SetupStepId }) {
  const { year, config, commit, busy, inactiveStudentIds } = useSetupWorkspace();
  const router = useRouter();
  const [draft, setDraft] = useState<SetupConfig>(() =>
    structuredClone(config),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const phases = setupPhases(config);
  const index = phases.findIndex((p) => p.id === step);
  const locked = index > config.completed.length;
  function update<K extends keyof SetupConfig>(key: K, value: SetupConfig[K]) {
    dirty.current = true;
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
    setMessage("");
  }
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const navigate = (e: MouseEvent) => {
      if (
        dirty.current &&
        (e.target as Element).closest("a[href]") &&
        !window.confirm("Leave this step and discard unsaved changes?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, []);
  async function save(advance: boolean) {
    setError("");
    try {
      await commit(
        (current) => completeSetupStep(current, step, draft, inactiveStudentIds),
        `Completed setup: ${phases[index].title}`,
      );
      dirty.current = false;
      setMessage("Saved to this browser.");
      if (advance)
        router.push(
          index === 7
            ? "/school-setup"
            : `/school-setup/${phases[index + 1].id}`,
        );
    } catch (e) {
      setError(readableError(e));
    }
  }
  const scope = {
    schoolId: config.school.id,
    academicYearId: config.calendar.year.id,
  };
  const classOptions = draft.classes.map((c) => ({
    value: c.id,
    label: `${c.grade} – ${c.section}`,
  }));
  function schoolField(
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
      <Field key={key} id={`school-${key}`} label={label}>
        <Input
          id={`school-${key}`}
          value={draft.school[key] ?? ""}
          onChange={(e) =>
            update("school", { ...draft.school, [key]: e.target.value })
          }
        />
      </Field>
    );
  }
  return (
    <section className="setup-panel config-step">
      <header className="config-step-heading">
        <div>
          <p className="config-eyebrow">SCHOOL SETUP · STEP {index + 1} OF 8</p>
          <h1>{phases[index].title}</h1>
          <p>{phases[index].description}</p>
        </div>
        <Link href="/school-setup">← Setup overview</Link>
      </header>
      <nav className="config-step-tabs" aria-label="Setup steps">
        {phases.map((p, i) => (
          <Link
            key={p.id}
            href={`/school-setup/${p.id}`}
            aria-current={p.id === step ? "step" : undefined}
            aria-disabled={i > config.completed.length}
            className={p.id === step ? "selected" : ""}
          >
            {i < config.completed.length ? "✓" : i + 1} {p.title}
          </Link>
        ))}
      </nav>
      {locked ? (
        <div className="config-empty">
          <h2>This step is locked</h2>
          <p>
            Complete {phases[config.completed.length].title} before continuing.
          </p>
          <Button asChild>
            <Link href={`/school-setup/${phases[config.completed.length].id}`}>
              Continue current step
            </Link>
          </Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          <fieldset disabled={year.locked} className="config-step-body">
            {year.locked && (
              <p className="config-note">
                Archived academic year · Read-only historical setup
              </p>
            )}
            <p className="config-note">
              Editing a completed step requires later steps to be signed off
              again.
            </p>
            {step === "school-profile" && (
              <>
                <h2>School identity</h2>
                <div className="config-grid">
                  {schoolField("name", "School name")}
                  {schoolField("shortName", "Short name")}
                  {schoolField("curriculum", "Curriculum / board")}
                  {schoolField("affiliationNumber", "Affiliation number")}
                  {schoolField("email", "Office email")}
                  {schoolField("phone", "Phone (with country code)")}
                </div>
                <h2>Campus address</h2>
                <div className="config-grid">
                  {(
                    [
                      "line1",
                      "line2",
                      "city",
                      "region",
                      "postalCode",
                      "countryCode",
                    ] as const
                  ).map((key, i) => (
                    <Field
                      key={key}
                      id={`address-${key}`}
                      label={
                        [
                          "Address line 1",
                          "Address line 2 (optional)",
                          "City",
                          "State / region",
                          "Postal code",
                          "Country code (IN)",
                        ][i]
                      }
                    >
                      <Input
                        id={`address-${key}`}
                        value={draft.school.address[key] ?? ""}
                        onChange={(e) =>
                          update("school", {
                            ...draft.school,
                            address: {
                              ...draft.school.address,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
                <h2>Regional settings & branding</h2>
                <div className="config-grid">
                  {schoolField("timezone", "Timezone")}
                  {schoolField("locale", "Locale")}
                  {schoolField("currency", "Currency code")}
                  <Field
                    id="school-logo"
                    label="School logo (PNG/JPEG, up to 150 KB)"
                  >
                    <Input
                      id="school-logo"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (
                          file.size > 150000 ||
                          !["image/png", "image/jpeg"].includes(file.type)
                        ) {
                          setError("Choose a PNG or JPEG smaller than 150 KB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () =>
                          update("branding", { logo: String(reader.result) });
                        reader.onerror = () =>
                          setError("Could not read the image.");
                        reader.readAsDataURL(file);
                      }}
                    />
                  </Field>
                </div>
                {draft.branding.logo && (
                  <div className="config-logo">
                    <img
                      src={draft.branding.logo}
                      alt="School logo preview"
                      width={64}
                      height={64}
                    />
                    <Button
                      variant="outline"
                      onClick={() => update("branding", { logo: null })}
                    >
                      Remove logo
                    </Button>
                  </div>
                )}
              </>
            )}
            {step === "academic-terms" && (
              <>
                <h2>Academic year</h2>
                <div className="config-grid">
                  {(["name", "startDate", "endDate"] as const).map((key, i) => (
                    <Field
                      key={key}
                      id={`year-${key}`}
                      label={["Year name", "Starts", "Ends"][i]}
                    >
                      <Input
                        id={`year-${key}`}
                        type={i ? "date" : "text"}
                        value={draft.calendar.year[key]}
                        onChange={(e) =>
                          update("calendar", {
                            ...draft.calendar,
                            year: {
                              ...draft.calendar.year,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
                <Collection
                  label="Terms"
                  rows={draft.calendar.terms}
                  columns={[
                    { key: "name", label: "Term name" },
                    { key: "startDate", label: "Start date", type: "date" },
                    { key: "endDate", label: "End date", type: "date" },
                  ]}
                  onChange={(terms) =>
                    update("calendar", { ...draft.calendar, terms })
                  }
                  create={() => ({
                    ...scope,
                    id: crypto.randomUUID(),
                    name: "New term",
                    startDate: draft.calendar.year.startDate,
                    endDate: draft.calendar.year.endDate,
                  })}
                />
              </>
            )}
            {step === "classes-sections" && (
              <>
                <Collection
                  label="Sections"
                  rows={draft.classes}
                  columns={[
                    { key: "grade", label: "Grade" },
                    { key: "section", label: "Section" },
                    { key: "capacity", label: "Capacity", type: "number" },
                  ]}
                  onChange={(rows) => update("classes", rows)}
                  create={() => ({
                    ...scope,
                    id: crypto.randomUUID(),
                    grade: "New grade",
                    section: "A",
                    capacity: 40,
                  })}
                />
                <p>
                  Existing students and staff allocations must keep a valid
                  section. Move their assignments before removing a section.
                </p>
              </>
            )}
            {step === "bell-schedule" && (
              <Collection
                label="Slots"
                rows={draft.bells}
                columns={[
                  { key: "name", label: "Label" },
                  {
                    key: "kind",
                    label: "Type",
                    options: [
                      { value: "period", label: "Teaching period" },
                      { value: "break", label: "Break" },
                    ],
                  },
                  { key: "start", label: "Starts", type: "time" },
                  { key: "end", label: "Ends", type: "time" },
                ]}
                onChange={(rows) => update("bells", rows)}
                create={() => ({
                  id: crypto.randomUUID(),
                  name: "New period",
                  kind: "period" as const,
                  start: "11:00",
                  end: "11:40",
                })}
              />
            )}
            {step === "fee-structure" && (
              <>
                <Collection
                  label="Fee heads"
                  rows={draft.fees}
                  columns={[
                    { key: "name", label: "Fee head" },
                    {
                      key: "amountMinor",
                      label: `Amount (${draft.school.currency})`,
                      type: "number",
                      factor: 100,
                    },
                    {
                      key: "frequency",
                      label: "Frequency",
                      options: [
                        { value: "annual", label: "Annual" },
                        { value: "quarterly", label: "Quarterly" },
                        { value: "monthly", label: "Monthly" },
                      ],
                    },
                  ]}
                  onChange={(rows) => update("fees", rows)}
                  create={() => ({
                    id: crypto.randomUUID(),
                    name: "New fee",
                    amountMinor: 0,
                    frequency: "annual" as const,
                  })}
                />
                <Field id="concession" label="concession (%)">
                  <Input
                    id="concession"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.concessionPercent}
                    onChange={(e) =>
                      update(
                        "concessionPercent",
                        e.target.value === "" ? NaN : Number(e.target.value),
                      )
                    }
                  />
                </Field>
                <p className="config-total">
                  Annual total per student after concession:{" "}
                  {Number.isFinite(annualFeeMinor(draft))
                    ? new Intl.NumberFormat(draft.school.locale, {
                        style: "currency",
                        currency: draft.school.currency,
                      }).format(annualFeeMinor(draft) / 100)
                    : "—"}
                </p>
                <p>
                  Payment processing is not connected; no payment gateway credentials are
                  needed.
                </p>
              </>
            )}
            {step === "staff-allocations" && (
              <>
                <Collection
                  label="Staff"
                  rows={draft.staff}
                  columns={[
                    { key: "displayName", label: "Full name" },
                    { key: "designation", label: "Designation" },
                  ]}
                  onChange={(rows) => update("staff", rows)}
                  create={() => ({
                    id: crypto.randomUUID(),
                    schoolId: config.school.id,
                    displayName: "New teacher",
                    designation: "Teacher",
                  })}
                />
                <Collection
                  label="Allocations"
                  rows={draft.allocations}
                  columns={[
                    {
                      key: "staffId",
                      label: "Teacher",
                      options: draft.staff.map((s) => ({
                        value: s.id,
                        label: s.displayName,
                      })),
                    },
                    {
                      key: "classSectionId",
                      label: "Section",
                      options: classOptions,
                    },
                    { key: "subject", label: "Subject" },
                  ]}
                  onChange={(rows) => update("allocations", rows)}
                  create={() => ({
                    id: crypto.randomUUID(),
                    staffId: draft.staff[0]?.id ?? "",
                    classSectionId: draft.classes[0]?.id ?? "",
                    subject: "New subject",
                  })}
                />
              </>
            )}
            {step === "data-ingestion" && <IngestionEditor />}
            {step === "portal-gateway" && (
              <>
                <h2>Portal availability</h2>
                <p>
                  Ingestion is signed off. Configure the workspace portals
                  below.
                </p>
                {(
                  [
                    { key: "parentEnabled", label: "Enable parent portal" },
                    { key: "staffEnabled", label: "Enable staff portal" },
                    {
                      key: "acknowledgeSimulation",
                      label:
                        "I have reviewed portal access settings and invitation recipients",
                    },
                  ] as const
                ).map((item) => (
                  <label className="config-check" key={item.key}>
                    <input
                      type="checkbox"
                      checked={draft.portal[item.key]}
                      onChange={(e) =>
                        update("portal", {
                          ...draft.portal,
                          [item.key]: e.target.checked,
                          invitationsPrepared: false,
                        })
                      }
                    />
                    {item.label}
                  </label>
                ))}
                <label className="config-check">
                  <input
                    type="checkbox"
                    disabled={
                      !draft.portal.parentEnabled ||
                      !draft.portal.acknowledgeSimulation
                    }
                    checked={draft.portal.invitationsPrepared}
                    onChange={(e) =>
                      update("portal", {
                        ...draft.portal,
                        invitationsPrepared: e.target.checked,
                      })
                    }
                  />
                  Prepare guardian invitations on save
                </label>
                <p>
                  {draft.guardians.length} guardians · {draft.staff.length}{" "}
                  staff · No messages will be sent.
                </p>
                <h2>Ready for operations</h2>
                <p>
                  {draft.school.name} · {draft.calendar.year.name} ·{" "}
                  {draft.classes.length} sections · {draft.students.length}{" "}
                  students.
                </p>
              </>
            )}
            {error && (
              <div
                role="alert"
                className="config-errors"
                ref={errorRef}
                tabIndex={-1}
              >
                {error}
              </div>
            )}
            {message && (
              <p role="status" className="config-success">
                {message}
              </p>
            )}
          </fieldset>
          <footer className="config-actions">
            <Button variant="outline" asChild>
              <Link
                href={
                  index
                    ? `/school-setup/${phases[index - 1].id}`
                    : "/school-setup"
                }
              >
                ← Back
              </Link>
            </Button>
            <span />
            <Button
              variant="outline"
              disabled={busy || year.locked}
              onClick={() => void save(false)}
            >
              {busy ? "Saving…" : "Save step"}
            </Button>
            <Button type="submit" disabled={busy || year.locked}>
              {busy
                ? "Saving…"
                : index === 7
                  ? "Complete setup"
                  : "Save & continue →"}
            </Button>
          </footer>
        </form>
      )}
    </section>
  );
}
