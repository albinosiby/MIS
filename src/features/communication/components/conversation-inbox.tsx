"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { AccountIdentity } from "../../identity/models";
import type { ConversationResponse, InboxNotification } from "../models";
import {
  conversationResponseSchema,
  inboxNotificationSchema,
} from "../schemas/conversation.schema";
import { documentListSchema } from "../../documents/schemas/private-document.schema";
import type {PrivateDocumentSummary} from "../../documents/models";
import { useBackend } from "../../identity/components/identity-context";
export function ConversationInbox({ actor }: { actor: AccountIdentity }) {
  const { year } = useWorkspace();
  const cloud = useBackend() === "supabase";
  const [data, setData] = useState<ConversationResponse | null>(null),
    [thread, setThread] = useState<string | null>(null),
    [student, setStudent] = useState(year.setup.students[0]?.id ?? ""),
    [contact, setContact] = useState(""),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [notices, setNotices] = useState<InboxNotification[]>([]),
    [attachments, setAttachments] = useState<string[]>([]);
  const [files, setFiles] = useState<
    PrivateDocumentSummary[]
  >([]);
  const seq = useRef(0),
    createKey = useRef(crypto.randomUUID()),
    sendKey = useRef(crypto.randomUUID());
  const yearId = year.setup.calendar.year.id;
  async function load() {
    if (!cloud) return;
    const request = ++seq.current;
    try {
      const url = `/api/conversations?year=${encodeURIComponent(yearId)}${thread ? `&thread=${thread}` : ""}${student ? `&student=${encodeURIComponent(student)}` : ""}`;
      const [conversationResponse, inboxResponse] = await Promise.all([
        fetch(url, { cache: "no-store" }),
        fetch("/api/inbox", { cache: "no-store" }),
      ]);
      if (!conversationResponse.ok || !inboxResponse.ok)
        throw new Error(
          "Inbox unavailable. Your access may have changed; refresh or sign in again.",
        );
      const parsed = conversationResponseSchema.parse(
        await conversationResponse.json(),
      );
      const inbox = z
        .object({ notifications: inboxNotificationSchema.array() })
        .parse(await inboxResponse.json());
      if (request === seq.current) {
        setData(parsed);
        setNotices(inbox.notifications);
        setError("");
      }
    } catch (e) {
      if (request === seq.current)
        setError(e instanceof Error ? e.message : "Inbox unavailable.");
    }
  }
  useEffect(() => {
    setData(null);
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => {
      seq.current++;
      clearInterval(timer);
    };
  }, [yearId, thread, student, cloud]);
  async function action(input: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok)
        throw new Error(
          "Action unavailable. Check participants, current permissions, quiet hours and attachments, then retry.",
        );
      return await response.json();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (!cloud)
    return (
      <p className="op-notice">
        Private conversations require the connected school database.
      </p>
    );
  useEffect(() => {
    let current = true;
    void fetch(`/api/documents?year=${encodeURIComponent(yearId)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (r.ok) {
          const parsed = documentListSchema.parse(await r.json());
          if (current)
            setFiles(parsed.files.filter((f) => f.status === "ready"));
        }
      })
      .catch(() => {
        if (current) setFiles([]);
      });
    return () => {
      current = false;
    };
  }, [yearId]);
  const selected = data?.selected;
  return (
    <>
      <div className="op-heading">
        <div>
          <span className="op-eyebrow">Communication / your inbox</span>
          <h1>Messages & notifications</h1>
          <p>
            Private conversations use explicit participants and current school
            relationships.
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          Refresh inbox
        </Button>
      </div>
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
      {notices.some((n) => !n.read_at) && (
        <section className="op-card mb-5">
          <h2>Unread notifications</h2>
          {notices
            .filter((n) => !n.read_at)
            .slice(0, 10)
            .map((n) => (
              <div className="conversation-notice" key={n.id}>
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    const r = await fetch("/api/inbox", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: n.id }),
                    });
                    if (r.ok) await load();
                    else setError("Notification could not be marked read.");
                  }}
                >
                  Mark read
                </Button>
              </div>
            ))}
        </section>
      )}
      <div className="conversation-grid">
        <aside className="op-card">
          <h2>Your conversations</h2>
          {data?.conversations.length ? (
            data.conversations.map((c) => (
              <button
                className={`conversation-thread ${selected?.id === c.id ? "selected" : ""}`}
                key={c.id}
                onClick={() => {
                  setThread(c.id);
                  setAttachments([]);
                  setBody("");
                  sendKey.current = crypto.randomUUID();
                }}
              >
                <strong>{c.subject}</strong>
                <small>
                  {c.state} · {new Date(c.updated_at).toLocaleDateString()}
                </small>
              </button>
            ))
          ) : (
            <p className="op-empty">
              {data ? "No conversations yet." : "Loading conversations…"}
            </p>
          )}
          <form
            className="conversation-form mt-6"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const result = await action({
                  type: "create",
                  input: {
                    yearId,
                    studentId: student || null,
                    subject,
                    participantIds: [contact],
                    clientKey: createKey.current,
                  },
                });
                setThread(result.conversation.id);
                setSubject("");
                createKey.current = crypto.randomUUID();
                setStatus("Private conversation created.");
                await load();
              } catch {}
            }}
          >
            <h3>Start a conversation</h3>
            <label>
              Context
              <select
                aria-label="Conversation context"
                value={student}
                onChange={(e) => {
                  setStudent(e.target.value);
                  setContact("");
                }}
              >
                <option value="">School / staff conversation</option>
                {year.setup.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Participant
              <select
                aria-label="Conversation participant"
                value={contact}
                required
                onChange={(e) => setContact(e.target.value)}
              >
                <option value="">Choose a permitted school contact</option>
                {data?.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                aria-label="Conversation subject"
                value={subject}
                minLength={2}
                maxLength={160}
                required
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <Button disabled={busy || year.locked || !contact} type="submit">
              Start private conversation
            </Button>
          </form>
        </aside>
        <section className="op-card">
          <div className="flex justify-between gap-4">
            <div>
              <h2>{selected?.subject ?? "Select a conversation"}</h2>
              <p>
                {selected
                  ? `${data?.participants.length} explicit participants · ${selected.state}`
                  : "Choose an existing thread or start a new one."}
              </p>
            </div>
            {selected && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  try {
                    await action({ type: "read", id: selected.id });
                    setStatus("Conversation marked read.");
                    await load();
                  } catch {}
                }}
              >
                Mark thread read
              </Button>
            )}
          </div>
          <div className="conversation-messages" aria-live="polite">
            {data?.messages.map((m) => (
              <article
                className={`conversation-message ${m.sender_id === actor.id ? "own" : ""}`}
                key={m.id}
              >
                <small>
                  {m.sender_id === actor.id ? "You" : "School participant"} ·{" "}
                  {new Date(m.created_at).toLocaleString()} · {m.status}
                </small>
                <p>{m.body}</p>
                {m.attachment_ids.map((id) => (
                  <a key={id} href={`/api/documents/${id}`} download>
                    Download permitted attachment →
                  </a>
                ))}
              </article>
            ))}
            {selected && !data?.messages.length && (
              <p className="op-empty">No messages yet.</p>
            )}
          </div>
          {selected && (
            <form
              className="conversation-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await action({
                    type: "send",
                    input: {
                      conversationId: selected.id,
                      body,
                      attachmentIds: attachments,
                      clientKey: sendKey.current,
                    },
                  });
                  setBody("");
                  setAttachments([]);
                  sendKey.current = crypto.randomUUID();
                  setStatus(
                    "Message queued for delivery. Quiet hours may delay delivery.",
                  );
                  await load();
                } catch {}
              }}
            >
              <label>
                Message
                <textarea
                  aria-label="Private message"
                  value={body}
                  minLength={1}
                  maxLength={4000}
                  required
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <label>
                Attachments (optional, up to five)
                <select
                  aria-label="Message attachments"
                  multiple
                  value={attachments}
                  onChange={(e) =>
                    setAttachments(
                      Array.from(e.target.selectedOptions)
                        .map((o) => o.value)
                        .slice(0, 5),
                    )
                  }
                >
                  {files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.filename} · version {f.version}
                    </option>
                  ))}
                </select>
              </label>
              <p className="op-notice">
                Attach only files every participant can currently read.{" "}
                <Link href="/documents/files">Open private documents →</Link>
              </p>
              <Button
                disabled={busy || year.locked || selected.state !== "open"}
                type="submit"
              >
                Send private message
              </Button>
              <div className="op-links">
                <button
                  type="button"
                  disabled={busy || selected.state === "flagged"}
                  onClick={async () => {
                    try {
                      await action({
                        type: "state",
                        id: selected.id,
                        state: "flagged",
                      });
                      setStatus("Conversation flagged; sending is paused.");
                      await load();
                    } catch {}
                  }}
                >
                  Flag conversation
                </button>
                {["admin", "principal"].includes(actor.role) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        await action({
                          type: "state",
                          id: selected.id,
                          state:
                            selected.state === "closed" ||
                            selected.state === "flagged"
                              ? "open"
                              : "closed",
                        });
                        await load();
                      } catch {}
                    }}
                  >
                    {selected.state === "open" ? "Close" : "Reopen"}{" "}
                    conversation
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
      {["admin", "principal"].includes(actor.role) && data && (
        <form
          className="op-card conversation-form mt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            try {
              await action({
                type: "quiet-hours",
                input: {
                  enabled: form.has("enabled"),
                  start: Number(form.get("start")),
                  end: Number(form.get("end")),
                  timezone: String(form.get("timezone")),
                },
              });
              setStatus("School quiet hours saved.");
              await load();
            } catch {}
          }}
        >
          <h2>School quiet hours</h2>
          <p>
            Message delivery waits until the next permitted local hour. In-app
            messages use the durable school worker; external providers remain
            disconnected.
          </p>
          <label>
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={data.quietHours.enabled}
            />{" "}
            Enable quiet hours
          </label>
          <div className="grid grid-cols-3 gap-4">
            <label>
              Start hour
              <input
                name="start"
                type="number"
                min={0}
                max={23}
                defaultValue={data.quietHours.start}
              />
            </label>
            <label>
              End hour
              <input
                name="end"
                type="number"
                min={0}
                max={23}
                defaultValue={data.quietHours.end}
              />
            </label>
            <label>
              Timezone
              <input
                name="timezone"
                defaultValue={data.quietHours.timezone}
                required
              />
            </label>
          </div>
          <Button disabled={busy} type="submit">
            Save quiet hours
          </Button>
        </form>
      )}
    </>
  );
}
