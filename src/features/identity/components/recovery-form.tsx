"use client";
import { useBackend } from "./identity-context";
import { useActionState } from "react";
import Link from "next/link";
import {
  recoveryRequest,
  completeRecovery,
  inviteAccount,
} from "../server/account-actions";
import { Button } from "@/components/ui/button";
import { testAccounts } from "../data/test-accounts";
export function RecoveryRequest() {
  const cloud = useBackend() === "supabase";
  const [state, action, pending] = useActionState(recoveryRequest, {
    error: "",
    link: "",
  });
  return (
    <form action={action}>
      <label>
        Email address
        <input name="email" type="email" required />
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {cloud ? "Send recovery email" : "Create recovery link"}
      </Button>
      {state.link && (
        <div role="status" className="identity-banner">
          {cloud
            ? "If this account exists, check its email for recovery instructions."
            : "If this account exists, a recovery request is ready. No email was sent."}
          {state.link !== "none" && (
            <p>
              <Link href={state.link}>Open recovery link →</Link>
            </p>
          )}
          {!cloud && (
            <small>
              Recovery links are shown only in this local. Supabase will deliver
              them privately.
            </small>
          )}
        </div>
      )}
    </form>
  );
}
export function PasswordCompletion({
  token,
  purpose,
}: {
  token: string;
  purpose: "invitation" | "recovery";
}) {
  const [state, action, pending] = useActionState(completeRecovery, {
    error: "",
    done: false,
  });
  return state.done ? (
    <div role="status">
      <p>Password saved. Existing sessions have been revoked.</p>
      <Link href="/login">Return to sign in →</Link>
    </div>
  ) : (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="purpose" value={purpose} />
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <label>
        Confirm password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        Save password & activate
      </Button>
    </form>
  );
}
export function InviteForm() {
  const cloud = useBackend() === "supabase";
  const [state, action, pending] = useActionState(inviteAccount, {
    error: "",
    link: "",
  });
  return (
    <form action={action}>
      <label>
        Full name
        <input name="name" required minLength={2} />
      </label>
      <label>
        Email address
        <input name="email" type="email" required />
      </label>
      <label>
        Role
        <select name="role">
          {testAccounts
            .filter((x) => !["platform", "group"].includes(x.role))
            .map((x) => (
              <option key={x.role}>{x.role}</option>
            ))}
        </select>
      </label>
      <p>
        New accounts have no student or staff link. An administrator must
        explicitly verify and assign that relationship before private portal
        records become available.
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {cloud ? "Create school invitation" : "Create invitation"}
      </Button>
      {state.link && (
        <p role="status">
          <Link href={state.link}>Open invitation →</Link> ·{" "}
          {cloud
            ? "Share this one-use invitation privately. No invitation email is sent by this screen."
            : "One use, expires in one hour. No email sent."}
        </p>
      )}
    </form>
  );
}
