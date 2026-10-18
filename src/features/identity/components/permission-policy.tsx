"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { AccountIdentity, Role, MutationPolicy } from "../models";
import { schoolRoles } from "../domain/permissions";
import { mayAssignSchoolRole } from "../domain/membership-context";
import {
  mutationCapabilitySchema,
  mutationPolicySchema,
} from "../schemas/mutation-policy.schema";
export function PermissionPolicy({ actor }: { actor: AccountIdentity }) {
  const [policies, setPolicies] = useState<MutationPolicy[]>([]),
    [role, setRole] = useState<Role>("teacher"),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch("/api/account/permission-policy", {
      cache: "no-store",
    });
    if (!r.ok) throw new Error();
    setPolicies(
      z.object({ policies: mutationPolicySchema.array() }).parse(await r.json())
        .policies,
    );
  }
  useEffect(() => {
    void load().catch(() =>
      setError("Permission policies could not be loaded."),
    );
  }, []);
  return (
    <>
      <h2>Role action restrictions</h2>
      <p>
        Assigned roles determine which records can be read. Restrict changes
        within those existing permissions; removing a restriction cannot grant
        an action the role does not already have. Administrators retain access
        to this policy editor.
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
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/account/permission-policy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role, blocked: f.getAll("blocked") }),
            });
            if (!r.ok) throw new Error();
            await load();
            setStatus(
              "Role restrictions saved. They apply to the next server request.",
            );
          } catch {
            setError("Policy could not be saved. Refresh and retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Role
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setStatus("");
            }}
          >
            {schoolRoles
              .filter((r) => mayAssignSchoolRole(actor.role, r))
              .map((r) => (
                <option key={r}>{r}</option>
              ))}
          </select>
        </label>
        <fieldset key={`${role}:${JSON.stringify(policies)}`}>
          <legend>Blocked changes</legend>
          {mutationCapabilitySchema.options.map((c) => (
            <label className="mr-4" key={c}>
              <input
                name="blocked"
                type="checkbox"
                value={c}
                defaultChecked={policies
                  .find((p) => p.role === role)
                  ?.blocked.includes(c)}
              />{" "}
              {c}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={busy}>
          Save action restrictions
        </Button>
      </form>
    </>
  );
}
