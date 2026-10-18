"use client";
import { useActionState } from "react";
import { toggleAccount } from "../server/account-actions";
export function AccountStatusForm({
  id,
  active,
  disabled,
}: {
  id: string;
  active: boolean;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(toggleAccount, { error: "" });
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={disabled || pending}>
        {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
      </button>
      {state.error && (
        <p role="alert" className="text-red-700 whitespace-normal">
          {state.error}
        </p>
      )}
    </form>
  );
}
