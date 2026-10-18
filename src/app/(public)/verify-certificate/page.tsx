import { SetupWorkspaceProvider } from "@/features/school-setup/hooks/setup-workspace-provider";
import { PublicSchool } from "@/features/operations/components/public-school";
import "@/features/identity/styles.css";
export default function Page() {
  return (
    <SetupWorkspaceProvider publicView>
      <PublicSchool slug="verify-certificate" />
    </SetupWorkspaceProvider>
  );
}
