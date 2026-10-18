"use client";
import { useState, useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { OperationsShell } from "../../operations/components/operations-shell";
import type { AccountIdentity } from "../../identity/models";
import {
  supportCreateSchema,
  supportListSchema,
  ticketSchema,
} from "../schemas/platform.schema";
import { api, PlatformField, Status } from "./platform-ui";
import { TicketPanel } from "./platform-panel";
import { z } from "zod";
export function SupportPage({ actor }: { actor: AccountIdentity }) {
  const [list, setList] = useState<z.infer<typeof supportListSchema> | null>(
      null,
    ),
    [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void api(`/api/support?page=${page}`)
      .then((v) => {
        if (active) setList(supportListSchema.parse(v));
      })
      .catch(() => {
        if (active) setError("Support requests could not be loaded. Retry.");
      });
    return () => {
      active = false;
    };
  }, [page, refresh]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      const input = supportCreateSchema.parse({
        requestId,
        subject: f.get("subject"),
        description: f.get("description"),
        replyEmail: f.get("replyEmail"),
        category: f.get("category"),
      });
      const saved = ticketSchema.parse(await api("/api/support", input));
      form.reset();
      setRequestId(crypto.randomUUID());
      setSelected(saved.id);
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? e.issues.map((i) => i.message).join(". ")
          : e instanceof Error
            ? e.message
            : "Request failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsShell actor={actor} route="/support">
      <div className="platform-support">
        <div className="platform-heading">
          <div>
            <span className="platform-eyebrow">HERE TO HELP</span>
            <h1>Support centre</h1>
            <p>
              Tell the platform team what you need help with and track your
              request here.
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="platform-error">
            {error}
          </p>
        )}
        <form className="platform-card platform-form" onSubmit={save}>
          <h2>Request support</h2>
          <div className="platform-grid">
            <PlatformField label="Subject" name="subject" />
            <PlatformField
              label="Reply email"
              name="replyEmail"
              type="email"
              value={actor.email}
            />
            <PlatformField label="Category" name="category">
              <Select name="category">
                {["technical", "account", "data", "other"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </PlatformField>
          </div>
          <label className="platform-field">
            <span>How can we help?</span>
            <textarea
              name="description"
              minLength={10}
              maxLength={4000}
              required
              placeholder="Describe the issue, the page and what you expected to happen. Do not include passwords."
            />
          </label>
          <p className="platform-muted">
            Requests go to the platform support inbox. The team may contact your
            reply email manually.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </form>
        <section className="platform-card">
          <div className="platform-list-heading">
            <h2>Your requests</h2>
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setRefresh((r) => r + 1);
              }}
            >
              Refresh
            </Button>
          </div>
          {!list ? (
            <p role="status">Loading requests…</p>
          ) : list.tickets.length ? (
            <div className="platform-request-list">
              {list.tickets.map((t) => (
                <button key={t.id} onClick={() => setSelected(t.id)}>
                  <span>
                    <strong>{t.subject}</strong>
                    <small>{new Date(t.created_at).toLocaleDateString()}</small>
                  </span>
                  <Status value={t.status} />
                </button>
              ))}
            </div>
          ) : (
            <p className="platform-empty">No support requests yet.</p>
          )}
          <div className="platform-pagination">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              variant="outline"
              disabled={!list?.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </section>
        {selected && (
          <TicketPanel key={selected + refresh} id={selected} schoolView />
        )}
      </div>
    </OperationsShell>
  );
}
