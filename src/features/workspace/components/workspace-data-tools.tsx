"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../hooks/workspace-provider";
import { workspaceSchema } from "../schemas/workspace.schema";
import { createWorkspace } from "../data/workspace-seed";
import { setupConfigSchema } from "../../school-setup/schemas/setup-config.schema";
import { downloadFile } from "../../school-setup/components/setup-ingestion";
import { readableError } from "../../school-setup/components/form-errors";
import type { Workspace } from "../models";
export function WorkspaceDataTools() {
  const { root, year, busy, replace, reload } = useWorkspace();
  const file = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState<Workspace | null>(null),
    [error, setError] = useState("");
  return (
    <section className="setup-panel workspace-tools">
      <div>
        <strong>Persistent workspace</strong>
        <p>
          {year.setup.students.length} students · {year.setup.staff.length}{" "}
          staff · {root.years.length} academic year(s) · Revision{" "}
          {root.revision}
        </p>
      </div>
      <div className="config-toolbar">
        <Button
          variant="outline"
          onClick={() =>
            downloadFile(
              "school-workspace-backup.json",
              JSON.stringify(root, null, 2),
            )
          }
        >
          Export full backup
        </Button>
        <Button variant="outline" onClick={() => file.current?.click()}>
          Restore backup
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void reload()}>
          Reload saved data
        </Button>
      </div>
      <input
        ref={file}
        aria-label="Workspace backup JSON"
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (!selected) return;
          try {
            if (selected.size > 25_000_000)
              throw new Error("Backup must be smaller than 25 MB.");
            const raw: unknown = JSON.parse(await selected.text());
            const candidate = workspaceSchema.safeParse(raw);
            const parsed = candidate.success
              ? candidate.data
              : createWorkspace(setupConfigSchema.parse(raw));
            if (
              parsed.years[0].setup.school.id !== root.years[0].setup.school.id
            )
              throw new Error("Choose a backup for this school.");
            setRestore(parsed);
            setError("");
          } catch (e) {
            setError(readableError(e));
          }
        }}
      />
      {error && (
        <p role="alert" className="config-errors">
          {error}
        </p>
      )}
      {restore && (
        <Dialog
          title="Restore full workspace?"
          onClose={() => {
            setRestore(null);
          }}
        >
          <p>
            This restores records from the selected backup. Export a current
            backup before continuing. Archived academic years remain protected.
          </p>
          <div className="ws-actions">
            <Button
              variant="outline"
              onClick={() => {
                setRestore(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                try {
                  const backup = restore;
                  if (!backup) return;
                  await replace(
                    () => backup,
                    "Restored complete workspace backup",
                  );
                  try {
                    for (const key of Object.keys(sessionStorage))
                      if (
                        key.startsWith(
                          `student-selection:${root.years[0].setup.school.id}:`,
                        )
                      )
                        sessionStorage.removeItem(key);
                  } catch {}
                  setRestore(null);
                } catch (e) {
                  setError(readableError(e));
                }
              }}
            >
              Confirm replacement
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
