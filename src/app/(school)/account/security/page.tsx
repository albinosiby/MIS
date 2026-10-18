import Link from "next/link";
import { requireIdentity } from "@/features/identity/server/session";
import { signOut } from "@/features/identity/server/actions";
import { revokeSessions } from "@/features/identity/server/account-actions";
import { OperationsShell } from "@/features/operations/components/operations-shell";
import { Button } from "@/components/ui/button";
export default async function Page() {
  const actor = await requireIdentity();
  const cloud = process.env.MIS_BACKEND === "supabase";
  return (
    <OperationsShell actor={actor} route="/account/security">
      <div className="op-heading">
        <div>
          <span className="op-eyebrow">Your account</span>
          <h1>Account & security</h1>
          <p>
            {actor.name} · {actor.email}
          </p>
        </div>
        <span className="op-badge">{actor.role}</span>
      </div>
      <div className="op-cards">
        <section className="op-card">
          <h2>Password recovery</h2>
          <p>
            {cloud
              ? "Request a private recovery email through Supabase Auth."
              : "Reset the local password through a one-use recovery link."}
          </p>
          <div className="op-links">
            <Link href="/forgot-password">
              {cloud ? "Reset password →" : "Reset password →"}
            </Link>
          </div>
        </section>
        <section className="op-card">
          <h2>Sessions</h2>
          <p>
            {cloud
              ? "Supabase manages your session. Revoking sessions signs out all devices; the server checks active sessions before granting access."
              : "The current session expires after eight hours. Revoking sessions also signs this browser out."}
          </p>
          <form action={revokeSessions} className="mt-5">
            <Button type="submit" variant="outline">
              Revoke all my sessions
            </Button>
          </form>
        </section>
        <section className="op-card">
          <h2>Multi-factor authentication</h2>
          <span className="op-badge warning">
            {cloud
              ? "Authenticator verification available"
              : "Supabase connection required"}
          </span>
          <p className="mt-4">
            Enroll an authenticator and verify a code to enable multi-factor
            sign-in. Verified accounts must complete a challenge before
            accessing school data.
          </p>
          <Link href="/mfa/enroll">View authenticator setup →</Link>
        </section>
        <section className="op-card">
          <h2>School membership</h2>
          <p>{actor.schoolId}</p>
          <p>Role: {actor.role}</p>
          <p>Linked person: {actor.personId ?? "Not assigned"}</p>
          <Link href="/select-school">Review school context →</Link>
        </section>
        <section className="op-card">
          <h2>Sign out</h2>
          <p>
            {cloud
              ? "End this browser’s Supabase session."
              : "End this browser’s session."}
          </p>
          <form action={signOut} className="mt-5">
            <Button type="submit">Sign out</Button>
          </form>
        </section>
      </div>
    </OperationsShell>
  );
}
