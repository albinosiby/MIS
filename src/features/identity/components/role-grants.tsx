"use client";
import { useEffect, useState } from "react";
import { roleGrantListResponseSchema as listSchema } from "../schemas/membership-context.schema";
import type { RoleGrantListResponse } from "../models";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { AccountIdentity, Role } from "../models";
import { schoolRoles, personKindForRole } from "../domain/permissions";
import { mayAssignSchoolRole } from "../domain/membership-context";
export function RoleGrants({
  actor,
  accounts,
}: {
  actor: AccountIdentity;
  accounts: AccountIdentity[];
}) {
  const { year } = useWorkspace(),
    [role, setRole] = useState<Role>("teacher"),
    [data, setData] = useState<RoleGrantListResponse | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch("/api/account/role-grants", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setData(listSchema.parse(await r.json()));
    } catch {
      setError("Additional role assignments could not be read.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(input: unknown) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const r = await fetch("/api/account/role-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error();
      setStatus(
        "Role assignment saved. The account can select it from Your schools & roles.",
      );
      await load();
    } catch {
      setError(
        "Assignment was not accepted. Check your permissions, the verified account and the linked person.",
      );
    } finally {
      setBusy(false);
    }
  }
  const kind = personKindForRole(role),
    people =
      kind === "student"
        ? year.setup.students
        : kind === "guardian"
          ? year.setup.guardians
          : year.setup.staff;
  return (
    <>
      <h2>Additional school roles</h2>
      <p>
        Grant an existing verified account another school role. Each role uses
        its own person link and must be selected before use.
      </p>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <form
        className="conversation-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save({
            userId: String(f.get("account")),
            role,
            personId: kind ? String(f.get("person")) : null,
            active: true,
          });
        }}
      >
        <label>
          Account
          <select name="account" required>
            <option value="">Choose existing school account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Additional role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {schoolRoles
              .filter((r) => mayAssignSchoolRole(actor.role, r))
              .map((r) => (
                <option key={r}>{r}</option>
              ))}
          </select>
        </label>
        {kind && (
          <label>
            Linked {kind}
            <select name="person" key={kind} required>
              <option value="">Choose person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit" disabled={busy}>
          Grant additional role
        </Button>
      </form>
      {data?.grants.map((g) => (
        <div key={g.id} className="conversation-notice">
          <p>
            {g.display_name} · {g.role} · {g.active ? "active" : "inactive"}
          </p>
          <Button
            variant="outline"
            disabled={busy || !mayAssignSchoolRole(actor.role, g.role)}
            onClick={() =>
              void save({
                userId: g.user_id,
                role: g.role,
                personId: g.person_id,
                active: !g.active,
              })
            }
          >
            {g.active ? "Revoke" : "Restore"} additional role
          </Button>
        </div>
      ))}
    </>
  );
}
