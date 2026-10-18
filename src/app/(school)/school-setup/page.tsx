import type { Metadata } from "next";
import { SetupWizard } from "@/features/school-setup/components/setup-wizard";

export const metadata: Metadata = { title: "Setup Wizard" };

import {requireIdentity} from "@/features/identity/server/session";
export default async function SchoolSetupPage() {
  await requireIdentity("/school-setup");
  return <SetupWizard />;
}
