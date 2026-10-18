import "@/features/workspace/styles/workspace.css";
import type { ReactNode } from "react";
import { SetupWorkspaceProvider } from "@/features/school-setup/hooks/setup-workspace-provider";
import {requireIdentity} from "@/features/identity/server/session";
export default async function SchoolLayout({ children }: { children: ReactNode }) {
  await requireIdentity();
  return <SetupWorkspaceProvider>{children}</SetupWorkspaceProvider>;
}
