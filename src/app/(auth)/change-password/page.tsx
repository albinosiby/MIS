import { redirect } from "next/navigation";
import { currentCloudIdentity } from "@/features/cloud/server/identity";
import { ActivationForm } from "@/features/admin/components/activation-form";
import "@/features/identity/styles.css";
export default async function Page() {
  const actor = await currentCloudIdentity({ allowPasswordChange: true });
  if (!actor) redirect("/login");
  return <ActivationForm />;
}
