"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { SchoolLogo } from "@/components/branding/school-logo";
import { signIn } from "../server/actions";
import { testAccounts } from "../data/test-accounts";
import { Button } from "@/components/ui/button";
export function LoginForm({ role = "admin" }: { role?: string }) {
  const chosen = testAccounts.find((x) => x.role === role) ?? testAccounts[0];
  const [state, action, pending] = useActionState(signIn, { error: "" });
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="identity-page">
      <aside className="identity-story">
        <Link href="/login" className="identity-brand">
          <SchoolLogo size={40} /> School workspace{" "}
          <span>
            {role === "platform"
              ? "Platform administration"
              : "Institution portals"}
          </span>
        </Link>
        <div>
          <span className="identity-eyebrow">
            {role === "platform"
              ? "EVERY INSTITUTION. ONE PLATFORM."
              : "ONE SCHOOL. EVERY CONNECTION."}
          </span>
          <h1>
            {role === "platform"
              ? "Your institutions, connected."
              : "A better school day starts here."}
          </h1>
          <p>
            Bring your people, learning and school operations together in one
            thoughtful workspace.
          </p>
          <div className="identity-tiles">
            <div>
              01 <strong>Connected classrooms</strong>
            </div>
            <div>
              02 <strong>Informed families</strong>
            </div>
            <div>
              03 <strong>Clear school operations</strong>
            </div>
          </div>
        </div>
        <small>
          {role === "platform"
            ? "Secure access for platform administrators"
            : "One connected institution workspace"}
        </small>
      </aside>
      <main id="main-content" className="identity-main">
        <div className="identity-card">
          <span className="identity-eyebrow">WELCOME BACK</span>
          <h2>{role.replaceAll("-", " ")} sign in</h2>
          <p>
            {role === "platform"
              ? "Sign in to platform administration."
              : "Sign in to your institution workspace."}
          </p>
          <form action={action} key={chosen.id}>
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label htmlFor="login-password">
              Password
              <div className="password-control">
                <input
                  type={visible ? "text" : "password"}
                  id="login-password"
                  aria-label="Password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "Hide password" : "Show password"}
                >
                  {visible ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <Link href="/forgot-password">Forgot password?</Link>
            {state.error && <p role="alert">{state.error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in to workspace →"}
            </Button>
          </form>
        </div>
        <div className="identity-footer">
          <small>Need help? Contact your school administrator.</small>
          <nav aria-label="Public school links">
            <Link href="/school-site">School website</Link>
            <Link href="/welcome/signup">School onboarding</Link>
          </nav>
        </div>
      </main>
    </div>
  );
}
