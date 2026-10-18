"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  activationResponseSchema,
  temporaryPasswordSchema,
} from "../schemas/platform.schema";
import { z } from "zod";
import { signOut } from "../../identity/server/actions";
export function ActivationForm() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const f = new FormData(event.currentTarget),
        password = temporaryPasswordSchema.parse(f.get("password"));
      if (password !== f.get("confirm"))
        throw new Error("Passwords do not match.");
      const res = await fetch("/api/account/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok)
        throw new Error(
          "Choose a different strong password and retry. Your session may need a fresh sign-in.",
        );
      const data = activationResponseSchema.parse(await res.json());
      window.location.assign(data.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate account.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="identity-main min-h-screen">
      <div className="identity-card">
        <span className="identity-eyebrow">ACTIVATE YOUR ACCOUNT</span>
        <h1>Set your own password</h1>
        <p>
          Replace your temporary password before accessing your institution. Use
          at least 12 characters, uppercase, lowercase, a number and a symbol.
        </p>
        <form onSubmit={save}>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          <label>
            Confirm password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Activate account"}
          </Button>
        </form>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
