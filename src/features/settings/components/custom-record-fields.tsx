"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import { saveCustomValues } from "../domain/advanced-settings";
import type { AccountIdentity } from "../../identity/models";
export function CustomRecordFields({ actor }: { actor: AccountIdentity }) {
  const { year, mutate, busy } = useWorkspace(),
    [entity, setEntity] = useState<"student" | "staff" | "admission">(
      actor.role === "hr" ? "staff" : "student",
    ),
    [owner, setOwner] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const definitions = year.workflows.advanced.customFields.filter(
      (f) =>
        f.entity === entity &&
        (["admin", "principal"].includes(actor.role) ||
          f.readRoles.includes(actor.role)),
    ),
    values =
      year.workflows.customValues.find(
        (v) => v.entity === entity && v.ownerId === owner,
      )?.values ?? {};
  const choices =
    entity === "student"
      ? year.setup.students.map((s) => ({ id: s.id, name: s.displayName }))
      : entity === "staff"
        ? year.setup.staff.map((s) => ({ id: s.id, name: s.displayName }))
        : year.records.inquiries.map((i) => ({
            id: i.id,
            name: i.studentName,
          }));
  return (
    <section className="op-card">
      <h2>Custom record details</h2>
      <p>
        Fields follow the school definitions and the selected role's record
        permissions.
      </p>
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <form
        className="conversation-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const form = new FormData(e.currentTarget),
              input = {
                entity,
                ownerId: owner,
                values: Object.fromEntries(
                  definitions.map((f) => [
                    f.key,
                    f.type === "boolean"
                      ? form.has(f.key)
                      : f.type === "number" && form.get(f.key) !== ""
                        ? Number(form.get(f.key))
                        : String(form.get(f.key) ?? ""),
                  ]),
                ),
              };
            await mutate(
              (y) => saveCustomValues(y, actor, input),
              "Updated custom record details",
              { type: "workflow", input: { action: "custom-values", input } },
            );
            setStatus("Custom details saved.");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not save custom details.",
            );
          }
        }}
      >
        <label>
          Record type
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as typeof entity);
              setOwner("");
              setStatus("");
            }}
          >
            {(actor.role === "hr"
              ? ["staff"]
              : ["student", "staff", "admission"]
            ).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Record
          <select
            required
            value={owner}
            onChange={(e) => {
              setOwner(e.target.value);
              setStatus("");
            }}
          >
            <option value="">Choose record</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset
          key={`${entity}:${owner}`}
          disabled={!owner || busy || year.locked}
        >
          {!definitions.length && (
            <p>No custom fields are available for this record type.</p>
          )}
          {definitions.map((f) => (
            <label key={f.key}>
              {f.label}
              {f.required ? " *" : ""}
              {f.type === "choice" ? (
                <select
                  name={f.key}
                  defaultValue={String(values[f.key] ?? "")}
                  required={f.required}
                >
                  <option value="">Choose value</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "boolean" ? (
                <input
                  name={f.key}
                  type="checkbox"
                  defaultChecked={values[f.key] === true}
                />
              ) : (
                <input
                  name={f.key}
                  type={
                    f.type === "number"
                      ? "number"
                      : f.type === "date"
                        ? "date"
                        : "text"
                  }
                  step={f.type === "number" ? "any" : undefined}
                  defaultValue={String(values[f.key] ?? "")}
                  required={f.required}
                  maxLength={1000}
                />
              )}
            </label>
          ))}
          <Button
            type="submit"
            disabled={!definitions.length || !owner || busy || year.locked}
          >
            Save custom details
          </Button>
        </fieldset>
      </form>
    </section>
  );
}
