"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SchoolLogo } from "@/components/branding/school-logo";
import { mfaSummarySchema, mfaEnrollmentSchema } from "../schemas/mfa.schema";
import type { AccountIdentity } from "../models";
import { roleHome } from "../domain/access";
import type { MfaSummary, MfaEnrollment } from "../models";
export function MfaScreen({
  actor,
  mode,
}: {
  actor: AccountIdentity;
  mode: "enroll" | "challenge";
}) {
  const [data, setData] = useState<MfaSummary | null>(null),
    [pending, setPending] = useState<MfaEnrollment | null>(null),
    [factor, setFactor] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false);
  async function load() {
    try {
      const r = await fetch("/api/account/mfa", { cache: "no-store" });
      if (!r.ok) throw new Error("Sign in again to manage your authenticator.");
      setData(mfaSummarySchema.parse(await r.json()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "MFA unavailable.");
    }
  }
  useEffect(() => {
    void load();
    return () => setPending(null);
  }, []);
  async function action(input: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok)
        throw new Error(
          "Action was not accepted. Check your code and sign-in, then retry.",
        );
      return await r.json();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="identity-single">
      <section className="identity-card">
        <Link className="identity-brand" href={roleHome(actor.role)}>
          <SchoolLogo size={36} /> {actor.name}
        </Link>
        <h1>
          {mode === "enroll" ? "Authenticator security" : "Verify your sign-in"}
        </h1>
        <p>
          Use a time-based authenticator app. Verification is required at future
          sign-ins after enrollment.
        </p>
        {error && (
          <p className="identity-error" role="alert">
            {error}
          </p>
        )}
        {verified || data?.currentLevel === "aal2" ? (
          <p role="status">
            This session has verified an authenticator.{" "}
            <Link href={roleHome(actor.role)}>
              Continue to your workspace →
            </Link>
          </p>
        ) : null}
        {mode === "enroll" && !pending && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const f = new FormData(e.currentTarget),
                  result = await action({
                    action: "enroll",
                    name: String(f.get("name")),
                  });
                setPending(mfaEnrollmentSchema.parse(result));
                setFactor(result.factorId);
                await load();
              } catch {}
            }}
          >
            <label>
              Authenticator name
              <input
                name="name"
                required
                minLength={2}
                maxLength={60}
                placeholder="My authenticator"
              />
            </label>
            <Button type="submit" disabled={busy}>
              Set up an authenticator
            </Button>
          </form>
        )}
        {pending && (
          <div className="mt-5">
            <p>
              Scan this QR code privately, or enter the setup key in your
              authenticator.
            </p>
            <img
              alt="Authenticator enrollment QR code"
              width={220}
              height={220}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pending.qrCode)}`}
            />
            <details>
              <summary>Manual setup key</summary>
              <code>{pending.secret}</code>
            </details>
            <p>
              Keep the setup key private. The authenticator is enabled only
              after code verification.
            </p>
          </div>
        )}
        {data && (
          <form
            className="mt-5"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const form = new FormData(e.currentTarget);
                await action({
                  action: "verify",
                  factorId: factor,
                  code: String(form.get("code")),
                });
                setPending(null);
                setVerified(true);
                await load();
              } catch {}
            }}
          >
            <label>
              Authenticator
              <select
                required
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
              >
                <option value="">Choose authenticator</option>
                {data.factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendlyName} · {f.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Six-digit code
              <input
                required
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
              />
            </label>
            <Button type="submit" disabled={busy || !factor}>
              Verify authenticator
            </Button>
          </form>
        )}
        {mode === "enroll" &&
          data?.factors.map((f) => (
            <div className="mt-5" key={f.id}>
              <strong>{f.friendlyName}</strong>
              <p>{f.status}</p>
              <Button
                variant="outline"
                disabled={
                  busy ||
                  (f.status === "verified" && data.currentLevel !== "aal2")
                }
                onClick={async () => {
                  try {
                    await action({ action: "remove", factorId: f.id });
                    if (pending?.factorId === f.id) setPending(null);
                    await load();
                  } catch {}
                }}
              >
                Remove authenticator
              </Button>
            </div>
          ))}
        <Link className="mt-5 block" href="/login">
          Return to sign in →
        </Link>
      </section>
    </main>
  );
}
