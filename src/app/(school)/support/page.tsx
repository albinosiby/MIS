import { requireIdentity } from "@/features/identity/server/session";
import { SupportPage } from "@/features/admin/components/support-page";
import "@/features/operations/styles.css";
import "@/features/admin/styles/platform.css";
export default async function Page() {
  const actor = await requireIdentity("/support");
  return <SupportPage actor={actor} />;
}
