import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "School workspace", template: "%s | School workspace" },
  description:
    "A connected workspace for school administration, teaching and families.",
  robots: { index: false, follow: false },
};

import { currentIdentity } from "@/features/identity/server/session";
import { IdentityProvider } from "@/features/identity/components/identity-context";
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await currentIdentity();
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground focus:translate-y-0"
        >
          Skip to content
        </a>
        <IdentityProvider
          actor={actor}
          testAccessEnabled={process.env.MIS_TEST_ACCOUNTS_ENABLED === "true"}
          backend={
            process.env.MIS_BACKEND === "supabase" ? "supabase" : "local"
          }
        >
          {children}
        </IdentityProvider>
      </body>
    </html>
  );
}
