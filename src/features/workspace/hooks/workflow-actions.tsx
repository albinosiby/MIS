"use client";
import {
  createContext,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useWorkspace } from "./workspace-provider";
import { useBackend } from "../../identity/components/identity-context";
import type { AccountIdentity } from "../../identity/models";
import type { WorkflowCommand } from "../models";
function useActions(actor: AccountIdentity) {
  const workspace = useWorkspace(),
    cloud = useBackend() === "supabase",
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  async function run(action: WorkflowCommand["action"], input: unknown) {
    setError("");
    setStatus("");
    try {
      const command = { action, input };
      const local = cloud ? null : await import("../domain/workflow-commands");
      await workspace.mutate(
        (y) => (local ? local.applyWorkflowCommand(y, actor, command) : y),
        `Workflow: ${action}`,
        { type: "workflow", input: command },
      );
      setStatus("Changes saved.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Refresh and retry.",
      );
    }
  }
  function submit(
    action: WorkflowCommand["action"],
    build: (data: FormData) => unknown,
  ) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void run(action, build(new FormData(event.currentTarget)));
    };
  }
  return {
    ...workspace,
    actor,
    error,
    status,
    run,
    submit,
    unavailable: workspace.busy || workspace.year.locked,
  };
}
const Context = createContext<ReturnType<typeof useActions> | null>(null);
export function WorkflowActionsProvider({
  actor,
  children,
}: {
  actor: AccountIdentity;
  children: ReactNode;
}) {
  const value = useActions(actor);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkflowActions() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkflowActionsProvider required.");
  return value;
}
export function StaffOptions() {
  const { year } = useWorkflowActions();
  return year.setup.staff.map((s) => (
    <option key={s.id} value={s.id}>
      {s.displayName}
    </option>
  ));
}
export function StudentOptions() {
  const { year } = useWorkflowActions();
  return year.setup.students.map((s) => (
    <option key={s.id} value={s.id}>
      {s.displayName} · {s.admissionNumber}
    </option>
  ));
}
export function workflowText(form: FormData, key: string) {
  return String(form.get(key) ?? "");
}
