"use client";
import { useBackend } from "./identity-context";
import { useActionState, useState } from "react";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { AccountIdentity } from "../models";
import { linkAccount } from "../server/account-actions";
import { Button } from "@/components/ui/button";
export function AccountLinkForm({ accounts }: { accounts: AccountIdentity[] }) {
  const cloud = useBackend() === "supabase";
  const { year } = useWorkspace();
  const [selected, setSelected] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === selected);
  const people =
    account?.role === "parent"
      ? year.setup.guardians
      : account?.role === "student"
        ? year.setup.students
        : year.setup.staff;
  const [state, action, pending] = useActionState(linkAccount, {
    error: "",
    done: false,
  });
  return (
    <form action={action}>
      <label>
        Account
        <select
          name="id"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {accounts.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name} · {a.role}
            </option>
          ))}
        </select>
      </label>
      <label>
        Link to existing school record
        <select
          name="personId"
          key={selected}
          defaultValue={account?.personId ?? people[0]?.id}
        >
          {people.map((p) => (
            <option value={p.id} key={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </label>
      <p>
        {cloud
          ? "The server checks school and person type. Verify identity and guardian authority before assigning this link."
          : "Local relationship assignment only. Verify identity and guardian rights before using live data."}
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      {state.done && (
        <p role="status">Person link saved. The account must sign in again.</p>
      )}
      <Button type="submit" disabled={pending || !account || !people.length}>
        Save person link
      </Button>
    </form>
  );
}
