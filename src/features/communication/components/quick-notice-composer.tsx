"use client";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  Badge,
  Panel,
  LinkButton,
} from "../../workspace/components/workspace-ui";
import { scope, putRecord } from "../../workspace/domain/operations";
import { noticeSchema } from "../schemas/communication.schema";
import type { Notice } from "../models";
import { readableError } from "../../school-setup/components/form-errors";

export function QuickNoticeComposer() {
  const { year: y, mutate, busy } = useWorkspace();
  const [id] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(""),
    [body, setBody] = useState("");
  const [priority, setPriority] = useState<Notice["priority"]>("normal");
  const [audience, setAudience] = useState<Notice["audience"]>("guardians");
  const [channels, setChannels] = useState<Notice["channels"]>(["App"]);
  const [cohorts, setCohorts] = useState<string[]>([]),
    [scheduledFor, setScheduledFor] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const students = y.setup.students.filter(
    (s) =>
      (!cohorts.length || cohorts.includes(s.classSectionId)) &&
      !y.records.studentProfiles.some(
        (p) => p.studentId === s.id && p.status !== "active",
      ),
  );
  const guardians = new Set(
    y.setup.relationships
      .filter(
        (r) =>
          r.canReceiveNotices && students.some((s) => s.id === r.studentId),
      )
      .map((r) => r.guardianId),
  );
  const recipients =
    audience === "staff"
      ? y.setup.staff.length
      : guardians.size +
        (audience === "all" ? y.setup.staff.length + students.length : 0);
  return (
    <div className="fr-columns">
      <Panel
        title="Compose institutional notice"
        action={
          <Badge tone={priority === "urgent" ? "amber" : "blue"}>
            {priority} priority
          </Badge>
        }
      >
        <form
          onChange={() => setSaved(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending || busy || y.locked) return;
            setPending(true);
            setError("");
            try {
              const notice = noticeSchema.parse({
                ...scope(y),
                id,
                title,
                body,
                priority,
                audience,
                channels,
                classSectionIds: cohorts,
                scheduledFor: scheduledFor || null,
                status: "draft",
                recipientIds: [],
                acknowledgedIds: [],
              });
              await mutate(
                (current) => putRecord(current, "notices", notice),
                "Saved notice draft",
              );
              setSaved(true);
            } catch (e) {
              setError(readableError(e));
            } finally {
              setPending(false);
            }
          }}
        >
          <fieldset disabled={pending || busy || y.locked}>
            <section className="fr-form-section">
              <h3>01 · Classification & priority</h3>
              <p>Choose the urgency your school community should see.</p>
              <label htmlFor="notice-priority">Notice priority</label>
              <Select
                id="notice-priority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as Notice["priority"])
                }
              >
                <option value="normal">Normal · general circular</option>
                <option value="urgent">Urgent · immediate attention</option>
              </Select>
            </section>
            <section className="fr-form-section">
              <h3>02 · Target audience & scope</h3>
              <p>{recipients} eligible recipients from saved school records.</p>
              <label htmlFor="notice-audience">Target audience</label>
              <Select
                id="notice-audience"
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value as Notice["audience"])
                }
              >
                <option value="guardians">Guardians</option>
                <option value="staff">Staff</option>
                <option value="all">Students, guardians & staff</option>
              </Select>
              {audience !== "staff" && (
                <>
                  <label>Target cohorts (leave empty for all)</label>
                  <div className="fr-choice-list">
                    {y.setup.classes.map((c) => (
                      <label key={c.id}>
                        <input
                          type="checkbox"
                          checked={cohorts.includes(c.id)}
                          onChange={(e) =>
                            setCohorts((v) =>
                              e.target.checked
                                ? [...v, c.id]
                                : v.filter((id) => id !== c.id),
                            )
                          }
                        />
                        Grade {c.grade} · {c.section}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </section>
            <section className="fr-form-section">
              <h3>03 · Delivery channels</h3>
              <p>
                Choose the intended channels. Provider delivery status is
                tracked separately.
              </p>
              <div className="fr-choice-list">
                {(["App", "SMS", "WhatsApp", "Email"] as const).map(
                  (channel) => (
                    <label key={channel}>
                      <input
                        type="checkbox"
                        checked={channels.includes(channel)}
                        onChange={(e) =>
                          setChannels((v) =>
                            e.target.checked
                              ? [...v, channel]
                              : v.filter((c) => c !== channel),
                          )
                        }
                      />
                      {channel}
                    </label>
                  ),
                )}
              </div>
            </section>
            <section className="fr-form-section">
              <h3>04 · Notice content</h3>
              <label htmlFor="notice-title">Notice title</label>
              <Input
                id="notice-title"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Parent–teacher meeting this Saturday"
              />
              <label htmlFor="notice-body">Message body</label>
              <textarea
                id="notice-body"
                className="fr-textarea"
                required
                minLength={8}
                maxLength={3000}
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a clear announcement for your school community…"
              />
              <p className="ws-hint">{body.length} / 3,000 characters</p>
              <label htmlFor="notice-schedule">Schedule date (optional)</label>
              <Input
                id="notice-schedule"
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={y.setup.calendar.year.startDate}
                max={y.setup.calendar.year.endDate}
              />
            </section>
            {error && (
              <p className="config-errors" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="config-success" role="status">
                Notice draft saved. Review and publish or schedule it from the
                noticeboard.
              </p>
            )}
            <footer className="fr-form-footer">
              <LinkButton href="/communication">
                {saved ? "Review on noticeboard" : "Back to noticeboard"}
              </LinkButton>
              <Button type="submit">
                {pending ? "Saving draft…" : "Save notice draft"}
              </Button>
            </footer>
          </fieldset>
        </form>
      </Panel>
      <aside>
        <Panel title="Live notice preview">
          <div className="fr-help">
            <div className="fr-preview">
              <Megaphone aria-hidden="true" />
              <p>{y.setup.school.shortName}</p>
              <h3>{title || "Your notice headline"}</h3>
              <p>
                {body || "Your announcement will appear here as you write."}
              </p>
            </div>
            <h3>Dispatch summary</h3>
            <p>
              {recipients} eligible recipients · {audience}
            </p>
            <p>
              {channels.length
                ? channels.join(" · ")
                : "Select at least one delivery channel."}
            </p>
            <p>
              {scheduledFor
                ? `Proposed schedule: ${scheduledFor}`
                : "Draft awaiting review"}
            </p>
          </div>
        </Panel>
        <Panel title="Review before dispatch">
          <div className="fr-help">
            <ul>
              <li>
                Recipients respect active student records and guardian notice
                permissions.
              </li>
              <li>Saving creates a draft and sends no messages.</li>
              <li>
                Review the draft on the noticeboard before publishing or
                scheduling.
              </li>
            </ul>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
