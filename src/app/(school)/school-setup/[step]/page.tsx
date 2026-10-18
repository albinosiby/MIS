import { notFound } from "next/navigation";
import { SetupWizard } from "@/features/school-setup/components/setup-wizard";
import { setupPhaseIds } from "@/features/school-setup/schemas/setup-wizard.schema";
import {requireIdentity} from "@/features/identity/server/session";
export default async function SetupStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  await requireIdentity("/school-setup");
  const { step } = await params;
  const id = setupPhaseIds.find((id) => id === step);
  if (!id) notFound();
  return <SetupWizard step={id} />;
}
