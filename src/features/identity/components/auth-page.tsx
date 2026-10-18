import Link from "next/link";
import { SchoolLogo } from "@/components/branding/school-logo";
import { notFound } from "next/navigation";
import {
  RecoveryRequest,
  PasswordCompletion,
} from "@/features/identity/components/recovery-form";
import "@/features/identity/styles.css";
export async function AuthPage({
  screen,
  searchParams,
}: {
  screen: string;
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  if (
    ![
      "forgot-password",
      "reset-password",
      "accept-invitation",
      "verify-email",
      "access-denied",
    ].includes(screen)
  )
    notFound();
  const titles: Record<string, string> = {
    "forgot-password": "Reset your password",
    "reset-password": "Choose a new password",
    "accept-invitation": "Join your school workspace",
    "verify-email": "Email verification",
    "access-denied": "You don’t have access to this area",
  };
  return (
    <main id="main-content" className="identity-single">
      <div className="identity-card">
        <Link href="/login" className="identity-brand">
          <SchoolLogo size={36} /> Greenfield
        </Link>
        <div className="identity-banner">
          {process.env.MIS_BACKEND === "supabase"
            ? "Supabase authentication"
            : "Local · Supabase not connected"}
        </div>
        <h1>{titles[screen]}</h1>
        {screen === "forgot-password" ? (
          <RecoveryRequest />
        ) : ["reset-password", "accept-invitation"].includes(screen) ? (
          token ? (
            <PasswordCompletion
              token={token}
              purpose={screen === "reset-password" ? "recovery" : "invitation"}
            />
          ) : (
            <p role="alert">
              This page needs a valid invitation or recovery link. Ask your
              administrator or request another recovery link.
            </p>
          )
        ) : screen === "verify-email" ? (
          <p>
            {process.env.MIS_BACKEND === "supabase"
              ? "Use the confirmation link sent by your school or Supabase Auth. School accounts are pre-verified."
              : "accounts are pre-verified. Live email confirmation will be enabled with Supabase."}
          </p>
        ) : (
          <p>
            Your signed-in role cannot access this route. Sign in with an
            authorised account.
          </p>
        )}
        <p>
          <Link href="/login">Back to role sign in</Link>
        </p>
      </div>
    </main>
  );
}
