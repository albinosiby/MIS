import { SetupWorkspaceProvider } from "@/features/school-setup/hooks/setup-workspace-provider";
import { PublicSchool } from "@/features/operations/components/public-school";
import "@/features/operations/styles.css";
import "@/features/identity/styles.css";
import "@/features/workspace/styles/workspace.css";
import "@/features/school-setup/styles/setup-config.css";
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return (
    <SetupWorkspaceProvider publicView>
      <PublicSchool slug={slug?.join("/") ?? ""} />
    </SetupWorkspaceProvider>
  );
}
