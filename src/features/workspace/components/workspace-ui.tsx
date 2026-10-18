"use client";
import { useIdentity } from "../../identity/components/identity-context";
import { canAccess } from "../../identity/domain/access";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import type { SchoolYearWorkspace } from "../models";
import type { Collection } from "../domain/operations";
import { numberFromForm } from "../domain/form-values";
import { putRecord, scope, csvExport } from "../domain/operations";
import { useWorkspace } from "../hooks/workspace-provider";
import { downloadFile } from "../../school-setup/components/setup-ingestion";
import { readableError } from "../../school-setup/components/form-errors";
export type Option = { value: string; label: string };
export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "time"
    | "checkbox"
    | "select"
    | "multi"
    | "files";
  options?: Option[];
  factor?: number;
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
  emptyValue?: string | null;
};
export function classOptions(y: SchoolYearWorkspace) {
  return y.setup.classes.map((c) => ({
    value: c.id,
    label: `Grade ${c.grade} – ${c.section}`,
  }));
}
export function staffOptions(y: SchoolYearWorkspace) {
  return y.setup.staff.map((s) => ({ value: s.id, label: s.displayName }));
}
export function studentOptions(y: SchoolYearWorkspace) {
  return y.setup.students.map((s) => ({
    value: s.id,
    label: `${s.displayName} · ${s.admissionNumber}`,
  }));
}
export function subjectOptions(y: SchoolYearWorkspace) {
  return y.records.subjects.map((s) => ({ value: s.id, label: s.name }));
}
export function labelFor(options: Option[], id: string | null | undefined) {
  return options.find((o) => o.value === id)?.label ?? "—";
}
export function money(y: SchoolYearWorkspace, n: number) {
  return new Intl.NumberFormat(y.setup.school.locale, {
    style: "currency",
    currency: y.setup.school.currency,
  }).format(n / 100);
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`ws-badge ${tone}`}>{children}</span>;
}
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ws-panel ${className}`}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Metrics({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    tone?: string;
    icon?: ReactNode;
  }[];
}) {
  return (
    <section className="ws-metrics">
      {items.map((i) => (
        <article key={i.label}>
          {i.icon && <div className="ws-metric-icon">{i.icon}</div>}
          <span>{i.label}</span>
          <strong>{i.value}</strong>
          <small>{i.detail ?? "Selected academic year"}</small>
        </article>
      ))}
    </section>
  );
}
export function Tabs({
  items,
  route,
}: {
  items: readonly (readonly [string, string])[];
  route: string;
}) {
  const actor = useIdentity();
  return (
    <nav className="ws-tabs" aria-label="Module screens">
      {items
        .filter(([href]) => !actor || canAccess(actor.role, href))
        .map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={route === href ? "selected" : ""}
            aria-current={route === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
    </nav>
  );
}
export function Table({
  headers,
  rows,
  empty = "No matching records. Add a record or change the filters.",
  pageSize = 8,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const max = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, max);
  return (
    <div className="ws-table-wrap">
      <div className="ws-table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((current - 1) * pageSize, current * pageSize)
              .map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!rows.length && <p className="ws-empty">{empty}</p>}
      </div>
      <footer>
        <span>
          {rows.length
            ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, rows.length)}`
            : "0"}{" "}
          of {rows.length} records
        </span>
        <div>
          <Button
            variant="outline"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <Badge>
            {current} / {max}
          </Badge>
          <Button
            variant="outline"
            disabled={current === max}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </footer>
    </div>
  );
}
export function LinkButton({
  href,
  children,
  variant = "outline",
}: {
  href: string;
  children: ReactNode;
  variant?: "outline" | "default" | "secondary";
}) {
  const actor = useIdentity();
  if (actor && !canAccess(actor.role, href)) return null;
  return (
    <Button variant={variant} asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
function readPath(value: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (v, k) =>
        v && typeof v === "object"
          ? (v as Record<string, unknown>)[k]
          : undefined,
      value,
    );
}
function writePath(
  value: Record<string, unknown>,
  path: string,
  newValue: unknown,
) {
  const next = structuredClone(value);
  const keys = path.split(".");
  let obj = next;
  for (const key of keys.slice(0, -1)) {
    obj[key] ??= {};
    obj = obj[key] as Record<string, unknown>;
  }
  obj[keys.at(-1)!] = newValue;
  return next;
}
/** A shared presentation editor. Every submitted data contract is parsed by its feature schema and workspace boundary. */
export function DataForm({
  initial,
  fields,
  onSave,
  submitLabel = "Save changes",
}: {
  initial: Record<string, unknown>;
  fields: FormField[];
  onSave: (value: unknown) => Promise<void>;
  submitLabel?: string;
}) {
  const { year } = useWorkspace();
  const actor = useIdentity();
  const [value, setValue] = useState(() => structuredClone(initial)),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [done, setDone] = useState(false);
  return (
    <form
      className="ws-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (year.locked || pending) return;
        const controls = new FormData(e.currentTarget);
        let submission = structuredClone(value);
        for (const field of fields) {
          if (field.type === "files") continue;
          const raw = controls.get(field.name);
          const next =
            field.type === "multi"
              ? controls
                  .getAll(field.name)
                  .filter((v): v is string => typeof v === "string")
              : field.type === "checkbox"
                ? controls.has(field.name)
                : field.type === "number"
                  ? numberFromForm(
                      typeof raw === "string" ? raw : "",
                      field.factor,
                    )
                  : field.type === "date" ||
                      field.type === "time" ||
                      field.type === "select"
                    ? typeof raw === "string" && raw
                      ? raw
                      : (field.emptyValue ?? null)
                    : typeof raw === "string"
                      ? raw
                      : "";
          submission = writePath(submission, field.name, next);
        }
        setValue(submission);
        setDone(false);
        setPending(true);
        setError("");
        try {
          await onSave(submission);
          setDone(true);
        } catch (e) {
          setError(readableError(e));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending || year.locked}>
        <div className="ws-form-grid">
          {fields
            .filter(
              (f) =>
                actor?.role !== "hr" ||
                !["roleId", "personType"].includes(f.name),
            )
            .map((f) => {
              const id = `form-${f.name}`,
                v = readPath(value, f.name),
                change = (next: unknown) => {
                  setValue((old) => writePath(old, f.name, next));
                  setDone(false);
                  setError("");
                };
              return (
                <Field
                  key={f.name}
                  id={id}
                  label={f.label + (f.required ? " *" : "")}
                  description={f.description}
                >
                  {f.type === "checkbox" ? (
                    <input
                      id={id}
                      name={f.name}
                      type="checkbox"
                      checked={!!v}
                      onChange={(e) => change(e.target.checked)}
                    />
                  ) : f.type === "textarea" ? (
                    <textarea
                      id={id}
                      name={f.name}
                      value={String(v ?? "")}
                      onChange={(e) => change(e.target.value)}
                      rows={4}
                    />
                  ) : f.type === "multi" ? (
                    <div className="ws-check-list">
                      {f.options?.map((o) => (
                        <label key={o.value}>
                          <input
                            name={f.name}
                            value={o.value}
                            type="checkbox"
                            checked={Array.isArray(v) && v.includes(o.value)}
                            onChange={(e) =>
                              change(
                                e.target.checked
                                  ? [...(Array.isArray(v) ? v : []), o.value]
                                  : (Array.isArray(v) ? v : []).filter(
                                      (i) => i !== o.value,
                                    ),
                              )
                            }
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  ) : f.type === "select" ? (
                    <Select
                      id={id}
                      name={f.name}
                      value={v === null ? "" : String(v ?? "")}
                      onChange={(e) =>
                        change(e.target.value || (f.emptyValue ?? null))
                      }
                    >
                      <option value="">Choose…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === "files" ? (
                    <div>
                      <p className="ws-hint">
                        {Array.isArray(v) && v.length
                          ? `${v.length} existing document record(s). `
                          : ""}
                        Upload and manage actual files in the private document
                        register after saving this person record.
                      </p>
                      <Link href="/documents/files">
                        Open private documents →
                      </Link>
                    </div>
                  ) : (
                    <Input
                      id={id}
                      name={f.name}
                      type={f.type ?? "text"}
                      min={f.min}
                      max={f.max}
                      step={
                        f.factor
                          ? "0.01"
                          : f.type === "number"
                            ? "any"
                            : undefined
                      }
                      value={
                        typeof v === "number"
                          ? Number.isFinite(v)
                            ? v / (f.factor ?? 1)
                            : ""
                          : String(v ?? "")
                      }
                      onInput={(e) => {
                        if (f.type === "date" || f.type === "time")
                          change(
                            e.currentTarget.value || (f.emptyValue ?? null),
                          );
                      }}
                      onChange={(e) =>
                        change(
                          f.type === "date" || f.type === "time"
                            ? e.target.value || (f.emptyValue ?? null)
                            : f.type === "number"
                              ? e.target.value === ""
                                ? NaN
                                : numberFromForm(e.target.value, f.factor)
                              : e.target.value,
                        )
                      }
                    />
                  )}
                </Field>
              );
            })}
        </div>
      </fieldset>
      {year.locked && (
        <p className="ws-hint">
          This academic year is archived. Switch to the current year to edit.
        </p>
      )}
      {error && (
        <div className="config-errors" role="alert">
          {error}
        </div>
      )}
      {done && (
        <p className="config-success" role="status">
          Saved successfully.
        </p>
      )}
      <footer>
        <Button type="submit" disabled={pending || year.locked}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </footer>
    </form>
  );
}
export function RecordDialog({
  title,
  collection,
  initial,
  fields,
  onClose,
}: {
  title: string;
  collection: Collection;
  initial: Record<string, unknown>;
  fields: FormField[];
  onClose: () => void;
}) {
  const { mutate } = useWorkspace();
  const actor = useIdentity();
  return (
    <Dialog title={title} onClose={onClose}>
      <DataForm
        initial={initial}
        fields={fields}
        onSave={async (value) => {
          await mutate(
            (y) => putRecord(y, collection, value),
            `Saved ${title}`,
            collection === "inquiries"
              ? { type: "admission-save", input: value }
              : collection === "staffProfiles"
                ? { type: "staff-profile", input: value }
                : collection === "leaves" && actor?.role === "hr"
                  ? { type: "staff-leave-create", input: value }
                  : collection === "approvals" && actor?.role === "accountant"
                    ? { type: "billing-concession", input: value }
                    : undefined,
          );
          onClose();
        }}
      />
    </Dialog>
  );
}
export function ConfirmAction({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <Dialog title={title} onClose={onClose}>
      <p>{children}</p>
      {error && (
        <p role="alert" className="config-errors">
          {error}
        </p>
      )}
      <div className="ws-actions">
        <Button variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(readableError(e));
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Saving…" : "Confirm"}
        </Button>
      </div>
    </Dialog>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="ws-empty">{children}</p>;
}
export function newRecord(y: SchoolYearWorkspace) {
  return { ...scope(y), id: crypto.randomUUID() };
}
export function ExportButton({
  name,
  rows,
  report,
}: {
  name: string;
  rows: Record<string, unknown>[];
  report: (typeof import("../../communication/schemas/communication.schema").reportKeys)[number];
}) {
  const { mutate, year } = useWorkspace();
  const actor = useIdentity();
  const [error, setError] = useState("");
  return (
    <>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            const text = csvExport(rows);
            if (
              !year.locked &&
              (!actor || ["admin", "principal"].includes(actor.role))
            )
              await mutate(
                (y) =>
                  putRecord(
                    {
                      ...y,
                      records: {
                        ...y.records,
                        exports: y.records.exports.slice(-199),
                      },
                    },
                    "exports",
                    {
                      ...newRecord(y),
                      report,
                      format: "csv",
                      rowCount: rows.length,
                      status: "ready",
                      content: text,
                      filename: name + ".csv",
                      createdAt: new Date().toISOString(),
                    },
                  ),
                `Exported ${report} CSV`,
              );
            downloadFile(name + ".csv", text, "text/csv;charset=utf-8");
          } catch (e) {
            setError(readableError(e));
          }
        }}
      >
        Export CSV
      </Button>
      {error && (
        <p role="alert" className="config-errors">
          {error}
        </p>
      )}
    </>
  );
}
export const enumOptions = (items: readonly string[]) =>
  items.map((value) => ({ value, label: value.replaceAll("_", " ") }));
export const noteSchema = z.string().trim().min(8).max(500);
export function printSection(id: string) {
  const target = document.getElementById(id);
  if (!target) {
    window.print();
    return;
  }
  target.classList.add("ws-print-target");
  document.body.classList.add("ws-print-section");
  try {
    window.print();
  } finally {
    target.classList.remove("ws-print-target");
    document.body.classList.remove("ws-print-section");
  }
}
