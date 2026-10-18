"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkflowActions } from "../../workspace/hooks/workflow-actions";
import { useBackend } from "../../identity/components/identity-context";
import { publicationListResponseSchema } from "../../reports/schemas/publication-register.schema";
import type { PublicationListResponse } from "../../reports/models";
import { canViewPublicationMetadata } from "../../reports/domain/publication-access";
import { revokePublication } from "../../reports/domain/report-builder";
export function PublicationRegisterPanel() {
  const { year: y, actor, mutate } = useWorkflowActions(),
    cloud = useBackend() === "supabase",
    yearId = y.setup.calendar.year.id;
  const [data, setData] = useState<PublicationListResponse | null>(null),
    [search, setSearch] = useState(""),
    [applied, setApplied] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  async function load(offset = 0, append = false, filter = applied) {
    const request = ++sequence.current;
    try {
      let parsed: PublicationListResponse;
      if (cloud) {
        const response = await fetch(
          `/api/publications?year=${encodeURIComponent(yearId)}&offset=${offset}&search=${encodeURIComponent(filter)}`,
          { cache: "no-store" },
        );
        if (!response.ok)
          throw new Error(
            "Published records are unavailable. Refresh your sign-in and retry.",
          );
        parsed = publicationListResponseSchema.parse(await response.json());
      } else {
        const all = y.workflows.publications
          .filter((p) => canViewPublicationMetadata(y, actor, p))
          .map(({ snapshot: _snapshot, issuedBy: _issuer, ...p }) => ({
            ...p,
            ownerName:
              p.ownerType === "school"
                ? y.setup.school.name
                : ([...y.setup.students, ...y.setup.staff].find(
                    (s) => s.id === p.ownerId,
                  )?.displayName ?? "School record"),
          }))
          .filter((p) =>
            `${p.title} ${p.reference} ${p.ownerName}`
              .toLowerCase()
              .includes(filter.toLowerCase()),
          );
        parsed = publicationListResponseSchema.parse({
          publications: all.slice(offset, offset + 100),
          next: offset + 100 < all.length ? offset + 100 : null,
        });
      }
      if (request === sequence.current) {
        setData((previous) =>
          append && previous
            ? {
                ...parsed,
                publications: [
                  ...previous.publications,
                  ...parsed.publications.filter(
                    (p) =>
                      !previous.publications.some((old) => old.id === p.id),
                  ),
                ],
              }
            : parsed,
        );
        setError("");
      }
    } catch (e) {
      if (request === sequence.current) {
        setData(null);
        setError(
          e instanceof Error ? e.message : "Published records unavailable.",
        );
      }
    }
  }
  useEffect(() => {
    setData(null);
    setApplied("");
    setSearch("");
    void load(0, false, "");
    return () => {
      sequence.current++;
    };
  }, [yearId, cloud]);
  async function revoke(id: string, reason: string) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (cloud) {
        const r = await fetch(`/api/publications/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yearId, reason }),
        });
        if (!r.ok)
          throw new Error(
            "Revocation was not accepted. Check your permissions and retry.",
          );
        await load();
      } else {
        await mutate(
          (year) => revokePublication(year, actor, id, reason),
          "Revoked publication",
        );
        setData((previous) =>
          previous
            ? {
                ...previous,
                publications: previous.publications.map((p) =>
                  p.id === id
                    ? {
                        ...p,
                        revokedAt: new Date().toISOString(),
                        revocationReason: reason,
                      }
                    : p,
                ),
              }
            : previous,
        );
      }
      setStatus(
        "Publication revoked. Its saved contents remain unchanged and protected downloads are blocked.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not revoke publication.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="op-card">
      <div className="flex justify-between gap-4">
        <div>
          <h2>Issued records</h2>
          <p>
            Downloads use the issued snapshot. Revocation changes its status
            without rewriting saved contents.
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          Refresh publications
        </Button>
      </div>
      {y.locked && cloud && (
        <p className="op-notice">
          Archived contents are read only. Authorised revocations are recorded
          separately.
        </p>
      )}
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="op-notice" role="status">
          {status}
        </p>
      )}
      <form
        className="op-tools"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search);
          void load(0, false, search);
        }}
      >
        <label>
          Search issued records
          <input
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Student, employee, title or reference"
          />
        </label>
        <Button type="submit" disabled={busy}>
          Search publications
        </Button>
      </form>
      {!data?.publications.length && (
        <p>
          {data
            ? "No published records match your current access and search."
            : "Loading published records…"}
        </p>
      )}
      {data?.publications.map((p) => (
        <div key={p.id} className="conversation-notice">
          <div>
            <strong>{p.title}</strong>
            <p>
              {p.ownerName} · {p.reference} · v{p.version} ·{" "}
              {p.issuedAt.slice(0, 10)}
              {p.revokedAt ? ` · Revoked: ${p.revocationReason}` : ""}
            </p>
            {!p.revokedAt && (
              <div className="op-links">
                {cloud ? (
                  ["pdf", "xlsx"].map((format) => (
                    <a
                      key={format}
                      href={`/api/publications/${p.id}?year=${encodeURIComponent(yearId)}&format=${format}`}
                      download
                    >
                      Download {format.toUpperCase()}
                    </a>
                  ))
                ) : (
                  <span>
                    Protected downloads require the connected school database.
                  </span>
                )}
              </div>
            )}
          </div>
          {!p.revokedAt && ["admin", "principal"].includes(actor.role) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void revoke(
                  p.id,
                  String(new FormData(e.currentTarget).get("reason")),
                );
              }}
            >
              <input
                aria-label={`Revocation reason for ${p.reference}`}
                name="reason"
                required
                minLength={8}
                maxLength={500}
                placeholder="Revocation reason"
              />
              <Button
                type="submit"
                disabled={busy || (!cloud && y.locked)}
                variant="outline"
              >
                Revoke publication
              </Button>
            </form>
          )}
        </div>
      ))}
      {data?.next !== null && data?.next !== undefined && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void load(data.next!, true)}
        >
          Load more publications
        </Button>
      )}
    </section>
  );
}
