"use client";
import { connectSetupUpdate } from "../../workspace/domain/setup-bridge";
import type { SetupConfig } from "../models";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
export { WorkspaceProvider as SetupWorkspaceProvider } from "../../workspace/hooks/workspace-provider";
/** Compatibility adapter: existing setup screens use the same atomic workspace as other modules. */
export function useSetupWorkspace() {
  const { root, year, busy, error, mutate, reload, switchYear } =
    useWorkspace();
  return {
    root,
    year,
    switchYear,
    config: year.setup,
    inactiveStudentIds: year.records.studentProfiles.filter(p=>p.status!=="active").map(p=>p.studentId),
    busy,
    error,
    reload,
    commit: (update: (current: SetupConfig) => SetupConfig, action: string) =>
      mutate(
        (current) => connectSetupUpdate(current, update(current.setup), action),
        action,
      ),
  };
}
