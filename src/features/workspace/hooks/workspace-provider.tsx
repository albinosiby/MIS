"use client";
import { repairFixtureLinks } from "../../operations/data/repair-fixture-links";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadCloudWorkspace,
  executeCloudCommand,
  replaceCloudWorkspace,
} from "../../cloud/server/actions";
import {
  loadCloudPublicWorkspace,
  submitCloudPublicRequest,
} from "../../cloud/server/public-actions";
import {
  cloudCommandSchema,
  cloudActionResultSchema,
} from "../../cloud/schemas/cloud.schema";
import { useBackend } from "../../identity/components/identity-context";
import { useIdentity } from "../../identity/components/identity-context";
import type { Workspace, SchoolYearWorkspace } from "../models";
import {
  workspaceSchema,
  schoolYearWorkspaceSchema,
} from "../schemas/workspace.schema";
import { createOperationsSeed } from "../../operations/data/operations-seed";
import { createWorkspace } from "../data/workspace-seed";
import { setupConfigSchema } from "../../school-setup/schemas/setup-config.schema";
import {
  readWorkspaceDocument,
  writeWorkspaceDocument,
} from "@/shared/data/indexed-db";
import { appendAudit } from "../../school-setup/domain/setup-workflow";
import { Button } from "@/components/ui/button";
import { readableError } from "../../school-setup/components/form-errors";
function unwrapCloudResult(input: unknown) {
  const result = cloudActionResultSchema.parse(input);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
const KEY = "workspace-v2";
type WorkspaceContext = {
  root: Workspace;
  year: SchoolYearWorkspace;
  busy: boolean;
  error: string;
  mutate: (
    update: (year: SchoolYearWorkspace) => SchoolYearWorkspace,
    action: string,
    command?: unknown,
  ) => Promise<void>;
  replace: (
    update: (root: Workspace) => Workspace,
    action: string,
  ) => Promise<void>;
  reload: () => Promise<void>;
  switchYear: (id: string) => Promise<void>;
};
const Context = createContext<WorkspaceContext | null>(null);
async function load() {
  const saved = await readWorkspaceDocument(KEY);
  if (saved !== undefined) {
    const repair = repairFixtureLinks(saved);
    const parsed = workspaceSchema.parse(repair.value);
    const source = (saved as { years: Record<string, unknown>[] }).years;
    if (
      repair.changed ||
      source.some(
        (row, i) =>
          !Object.hasOwn(row, "extensions") && !parsed.years[i].locked,
      )
    ) {
      const migrated = workspaceSchema.parse({
        ...parsed,
        revision: parsed.revision + 1,
        years: parsed.years.map((y, i) =>
          !Object.hasOwn(source[i], "extensions") && !y.locked
            ? { ...y, extensions: createOperationsSeed(y) }
            : y,
        ),
      });
      try {
        await writeWorkspaceDocument(KEY, migrated, parsed.revision);
        return migrated;
      } catch {
        return workspaceSchema.parse(await readWorkspaceDocument(KEY));
      }
    }
    return parsed;
  }
  const legacy = await readWorkspaceDocument("setup-v1");
  const next = createWorkspace(
    legacy === undefined ? undefined : setupConfigSchema.parse(legacy),
  );
  try {
    await writeWorkspaceDocument(KEY, next, -1);
    return next;
  } catch {
    return workspaceSchema.parse(await readWorkspaceDocument(KEY));
  }
}
export function WorkspaceProvider({
  children,
  publicView = false,
}: {
  children: ReactNode;
  publicView?: boolean;
}) {
  const actor = useIdentity();
  const cloud = useBackend() === "supabase";
  const [root, setRoot] = useState<Workspace | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const current = useRef<Workspace | null>(null),
    lock = useRef(false);
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const next = cloud
        ? publicView
          ? await loadCloudPublicWorkspace()
          : await loadCloudWorkspace()
        : await load();
      current.current = next;
      setRoot(next);
      setError("");
    } catch (e) {
      setError(
        "Saved workspace could not be read or validated. It has not been overwritten. " +
          readableError(e),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(""), 4000);
    return () => clearTimeout(timer);
  }, [saved]);
  async function replace(
    update: (root: Workspace) => Workspace,
    action: string,
  ) {
    if (lock.current || !current.current)
      throw new Error("Wait for the current save to finish.");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const previous = current.current;
      const next = update(structuredClone(previous));
      next.revision = previous.revision + 1;
      next.years = next.years.map((y) =>
        y.setup.calendar.year.id === next.activeYearId && !y.locked
          ? {
              ...y,
              setup: {
                ...appendAudit(
                  y.setup,
                  action,
                  action.startsWith("Public:")
                    ? {
                        accountId: "public-demo",
                        displayName: "Public intake",
                        role: "public",
                      }
                    : actor
                      ? {
                          accountId: actor.id,
                          displayName: actor.name,
                          role: actor.role,
                        }
                      : null,
                ),
                revision: next.revision,
              },
            }
          : y,
      );
      const parsed = workspaceSchema.parse(next);
      const savedRoot = cloud
        ? unwrapCloudResult(
            await replaceCloudWorkspace(parsed, previous.revision, action),
          )
        : parsed;
      if (!cloud) await writeWorkspaceDocument(KEY, parsed, previous.revision);
      current.current = savedRoot;
      setRoot(savedRoot);
      setSaved(
        cloud ? "Changes saved to Supabase." : "Changes saved to this browser.",
      );
    } catch (e) {
      setError(readableError(e));
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function mutate(
    update: (year: SchoolYearWorkspace) => SchoolYearWorkspace,
    action: string,
    command?: unknown,
  ) {
    if (cloud && command !== undefined) {
      if (lock.current || !current.current)
        throw new Error("Wait for the current save to finish.");
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        const previous = current.current;
        const publicCommand =
          typeof command === "object" &&
          command !== null &&
          "type" in command &&
          ["public-inquiry", "public-tenant"].includes(String(command.type));
        const result = publicCommand
          ? await submitCloudPublicRequest(command)
          : await executeCloudCommand({
              expectedRevision: previous.revision,
              yearId: previous.activeYearId,
              command: cloudCommandSchema.parse(command),
            });
        const next = unwrapCloudResult(result);
        current.current = next;
        setRoot(next);
        setSaved("Changes saved to Supabase.");
      } catch (e) {
        setError(readableError(e));
        throw e;
      } finally {
        lock.current = false;
        setBusy(false);
      }
      return;
    }
    if (cloud && !["admin", "principal"].includes(actor?.role ?? ""))
      throw new Error("Use an authorised portal action for this record.");
    await replace((value) => {
      const index = value.years.findIndex(
        (y) => y.setup.calendar.year.id === value.activeYearId,
      );
      if (value.years[index].locked)
        throw new Error(
          "This academic year is archived and read-only. Switch to the current year to make changes.",
        );
      const changed = schoolYearWorkspaceSchema.parse(
        update(value.years[index]),
      );
      value.years[index] = changed;
      value.years = value.years.map((y) =>
        y.locked
          ? y
          : {
              ...y,
              setup: {
                ...y.setup,
                school: changed.setup.school,
                branding: changed.setup.branding,
              },
            },
      );
      return value;
    }, action);
  }
  async function switchYear(id: string) {
    if (cloud) {
      if (!current.current?.years.some((y) => y.setup.calendar.year.id === id))
        throw new Error("Academic year not found.");
      const next = { ...current.current, activeYearId: id };
      current.current = next;
      setRoot(next);
      return;
    }
    await replace((value) => {
      if (!value.years.some((y) => y.setup.calendar.year.id === id))
        throw new Error("Academic year not found.");
      return { ...value, activeYearId: id };
    }, "Switched academic year");
  }
  if (!root)
    return (
      <main id="main-content" className="workspace-loading">
        <h1>School workspace</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button
              variant="outline"
              disabled={cloud}
              onClick={async () => {
                try {
                  const raw = await readWorkspaceDocument(KEY);
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(raw, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "school-unreadable-backup.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                  setError(readableError(e));
                }
              }}
            >
              Export unreadable backup
            </Button>
            <Button disabled={busy} onClick={() => void reload()}>
              Retry loading
            </Button>
          </>
        ) : (
          <p role="status">Loading your saved school workspace…</p>
        )}
      </main>
    );
  const year = root.years.find(
    (y) => y.setup.calendar.year.id === root.activeYearId,
  )!;
  return (
    <Context.Provider
      value={{ root, year, busy, error, mutate, replace, reload, switchYear }}
    >
      {children}
      {saved && (
        <div className="setup-toast workspace-save-toast" role="status">
          {saved}
          <button
            aria-label="Dismiss saved notification"
            onClick={() => setSaved("")}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("WorkspaceProvider is required");
  return ctx;
}
