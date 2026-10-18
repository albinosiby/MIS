"use client";
import { useEffect, useState } from "react";
import type { AccountIdentity } from "../../identity/models";
import type { DocumentUpload, PrivateDocumentSummary } from "../models";
import {
  documentListSchema,
  documentCategorySchema,
  privateDocumentSummarySchema,
} from "../schemas/private-document.schema";
import { canAccessDocument } from "../domain/document-access";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import { useBackend } from "../../identity/components/identity-context";
import { Button } from "@/components/ui/button";
export function PrivateFiles({
  actor,
  initialOwner,
}: {
  actor: AccountIdentity;
  initialOwner?: string;
}) {
  const { year: y } = useWorkspace();
  const backend = useBackend();
  const [files, setFiles] = useState<PrivateDocumentSummary[]>([]),
    [next, setNext] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [owner, setOwner] = useState(
      initialOwner ?? "school:" + actor.schoolId,
    ),
    [category, setCategory] = useState<DocumentUpload["category"]>(
      initialOwner?.startsWith("admission:") ? "identity" : "general",
    ),
    [replacing, setReplacing] = useState<string | null>(null);
  const yearId = y.setup.calendar.year.id;
  const [ownerType, ownerId] = owner.split(":") as [
    DocumentUpload["ownerType"],
    string,
  ];
  const request = {
    yearId,
    ownerType,
    ownerId,
    category,
    replacesId: replacing,
  };
  const canUpload = canAccessDocument(y, actor, request, true);
  const owners = [
    ...y.records.inquiries.map((inquiry) => ({
      value: `admission:${inquiry.id}`,
      label: `${inquiry.studentName} · Application`,
    })),
    { value: `school:${actor.schoolId}`, label: "School" },
    ...y.setup.students.map((s) => ({
      value: `student:${s.id}`,
      label: `${s.displayName} · Student`,
    })),
    ...y.setup.staff.map((s) => ({
      value: `staff:${s.id}`,
      label: `${s.displayName} · Staff`,
    })),
  ];
  async function load(before?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/documents?year=${encodeURIComponent(yearId)}${before ? `&before=${encodeURIComponent(before)}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("Files could not be loaded. Sign in again or retry.");
      const result = documentListSchema.parse(await response.json());
      setFiles((previous) =>
        before ? [...previous, ...result.files] : result.files,
      );
      setNext(result.next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Files unavailable.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setFiles([]);
    setReplacing(null);
    if (backend === "supabase") void load();
  }, [yearId, backend]);
  if (backend !== "supabase")
    return (
      <div className="op-notice">
        Private files require the connected school database.
      </div>
    );
  async function change(
    id: string,
    action: "revoke" | "purge" | "resume" | "discard",
  ) {
    if (
      action !== "resume" &&
      !confirm(
        action === "revoke"
          ? "Revoke access to this file? Retained bytes remain private."
          : action === "discard"
            ? "Cancel this incomplete upload?"
            : "Permanently purge this file after its retention period?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await fetch(`/api/documents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!result.ok)
        throw new Error(
          "Action unavailable. Check your permissions and the retention date.",
        );
      setMessage(
        action === "revoke"
          ? "File access revoked."
          : action === "resume"
            ? "Upload recovered and available."
            : action === "discard"
              ? "Incomplete upload cancelled."
              : "File bytes purged.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="op-heading">
        <div>
          <span className="op-eyebrow">School / private files</span>
          <h1>Private documents</h1>
          <p>
            Files are available only to permitted school accounts. Downloads
            check your current access every time.
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          Refresh files
        </Button>
      </div>
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="op-notice">
          {message}
        </p>
      )}
      <form
        className="op-card private-file-form mb-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !canUpload) return;
          const formElement = e.currentTarget;
          const form = new FormData(formElement);
          form.set("yearId", yearId);
          form.set("ownerType", ownerType);
          form.set("ownerId", ownerId);
          form.set("category", category);
          if (replacing) form.set("replacesId", replacing);
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const response = await fetch("/api/documents", {
              method: "POST",
              body: form,
            });
            if (!response.ok)
              throw new Error(
                "Upload failed. Use a PDF, PNG or JPEG up to 5 MB and a permitted owner/category. Active PDFs are rejected.",
              );
            privateDocumentSummarySchema.parse((await response.json()).file);
            setReplacing(null);
            formElement.reset();
            setMessage("Private file uploaded and saved.");
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{replacing ? "Upload a new version" : "Upload a private file"}</h2>
        <label>
          File owner
          <select
            aria-label="File owner"
            disabled={busy || !!replacing}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            {owners.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          File category
          <select
            aria-label="File category"
            disabled={busy || !!replacing}
            value={category}
            onChange={(e) =>
              setCategory(documentCategorySchema.parse(e.target.value))
            }
          >
            {documentCategorySchema.options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          File (PDF, PNG or JPEG · up to 5 MB)
          <input
            name="file"
            aria-label="Private document file"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            required
            disabled={busy || !canUpload}
          />
        </label>
        {!canUpload && (
          <p className="op-notice">
            Choose an owner and category you can upload to. This account has
            read access only for some files.
          </p>
        )}
        <p>
          New versions preserve history. Revocation blocks downloads
          immediately. Files are retained for at least 30 days before
          administrator purge.
        </p>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || !canUpload}>
            {busy ? "Working…" : replacing ? "Save new version" : "Upload file"}
          </Button>
          {replacing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setReplacing(null)}
            >
              Cancel replacement
            </Button>
          )}
        </div>
      </form>
      <div className="op-table-wrap">
        <table className="op-table">
          <thead>
            <tr>
              <th>FILE</th>
              <th>OWNER / CATEGORY</th>
              <th>VERSION</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {files.map((d) => {
              const scope = {
                yearId,
                ownerType: d.owner_type,
                ownerId: d.owner_id,
                category: d.category,
                replacesId: null,
              };
              const write = canAccessDocument(y, actor, scope, true);
              const manage = canAccessDocument(
                { ...y, locked: false },
                actor,
                scope,
                true,
              );
              return (
                <tr key={d.id}>
                  <td>
                    {d.filename}
                    <br />
                    <small>
                      {Math.ceil(d.byte_size / 1024)} KB · {d.mime_type}
                    </small>
                  </td>
                  <td>
                    {owners.find(
                      (o) => o.value === `${d.owner_type}:${d.owner_id}`,
                    )?.label ?? d.owner_type}
                    <br />
                    {d.category}
                  </td>
                  <td>v{d.version}</td>
                  <td>
                    <span className="op-badge">{d.status}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-3">
                      {d.status === "uploading" && write && d.isUploader && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => void change(d.id, "resume")}
                          >
                            Recover upload
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void change(d.id, "discard")}
                          >
                            Cancel upload
                          </button>
                        </>
                      )}
                      {d.status === "ready" && (
                        <a href={`/api/documents/${d.id}`} download>
                          Download
                        </a>
                      )}
                      {write &&
                        (d.isUploader ||
                          [
                            "admin",
                            "principal",
                            "hr",
                            "accountant",
                            "nurse",
                            "counsellor",
                          ].includes(actor.role)) &&
                        d.status === "ready" && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              setOwner(`${d.owner_type}:${d.owner_id}`);
                              setCategory(d.category);
                              setReplacing(d.id);
                              setMessage("Choose a replacement file above.");
                            }}
                          >
                            New version
                          </button>
                        )}
                      {manage &&
                        (d.isUploader ||
                          [
                            "admin",
                            "principal",
                            "hr",
                            "accountant",
                            "nurse",
                            "counsellor",
                          ].includes(actor.role)) &&
                        ["ready", "superseded"].includes(d.status) && (
                          <button
                            disabled={busy}
                            onClick={() => void change(d.id, "revoke")}
                          >
                            Revoke
                          </button>
                        )}
                      {["admin", "principal"].includes(actor.role) &&
                        [
                          "revoked",
                          "superseded",
                          "deleting",
                          "deleted",
                        ].includes(d.status) && (
                          <button
                            disabled={
                              busy || Date.parse(d.retain_until) > Date.now()
                            }
                            title={`Retained until ${new Date(d.retain_until).toLocaleDateString()}`}
                            onClick={() => void change(d.id, "purge")}
                          >
                            Purge bytes
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!files.length && (
          <div className="op-empty">
            {busy
              ? "Loading private files…"
              : "No private files are available to this account."}
          </div>
        )}
      </div>
      {next && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void load(next)}
        >
          Load more files
        </Button>
      )}
    </>
  );
}
