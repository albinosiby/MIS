"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  Panel,
  Badge,
  LinkButton,
} from "../../workspace/components/workspace-ui";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { scope, putRecord } from "../../workspace/domain/operations";
import { academicEventSchema } from "../schemas/communication.schema";
import type { AcademicEvent } from "../models";
import { readableError } from "../../school-setup/components/form-errors";

export function AcademicEventComposer({
  initialDate,
}: {
  initialDate?: string;
}) {
  const { year: y, mutate, busy } = useWorkspace();
  const router = useRouter();
  const year = y.setup.calendar.year;
  const validInitial =
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate ?? "") &&
    initialDate! >= year.startDate &&
    initialDate! <= year.endDate
      ? initialDate!
      : academicReferenceDate(year);
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<AcademicEvent["category"]>("Academic");
  const [start, setStart] = useState(validInitial),
    [end, setEnd] = useState(validInitial);
  const [startTime, setStartTime] = useState(""),
    [endTime, setEndTime] = useState("");
  const [venue, setVenue] = useState(""),
    [description, setDescription] = useState("");
  const [cohorts, setCohorts] = useState<string[]>([]);
  const [status, setStatus] = useState<AcademicEvent["status"]>("draft");
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const terms = y.setup.calendar.terms.filter(
    (t) => t.startDate <= end && t.endDate >= start,
  );
  return (
    <div className="fr-columns">
      <Panel
        title="Event details"
        action={<Badge>Academic year {year.name}</Badge>}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving || busy || y.locked) return;
            setSaving(true);
            setError("");
            try {
              const record = academicEventSchema.parse({
                ...scope(y),
                id: crypto.randomUUID(),
                title,
                category,
                dates: { startDate: start, endDate: end },
                startTime: startTime || null,
                endTime: endTime || null,
                venue,
                description,
                classSectionIds: cohorts,
                sourceUid: null,
                status,
              });
              await mutate(
                (current) => putRecord(current, "events", record),
                "Created academic calendar event",
              );
              router.push(`/dashboard/calendar?month=${start.slice(0, 7)}`);
            } catch (e) {
              setError(readableError(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving || busy || y.locked}>
            <section className="fr-form-section">
              <h3>01 · Event classification & identity</h3>
              <p>Choose a clear name and the category used in the calendar.</p>
              <Field id="event-title" label="Official event title">
                <Input
                  id="event-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={160}
                  required
                  placeholder="e.g. Annual science exhibition"
                />
              </Field>
              <label htmlFor="event-category">Event classification</label>
              <Select
                id="event-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as AcademicEvent["category"])
                }
              >
                {academicEventSchema.shape.category.options.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </section>
            <section className="fr-form-section">
              <h3>02 · Dates, time & term alignment</h3>
              <p>
                {terms.length
                  ? terms.map((t) => t.name).join(" · ")
                  : "Choose dates within the academic year."}
              </p>
              <div className="fr-grid">
                <Field id="event-start" label="Start date">
                  <Input
                    id="event-start"
                    type="date"
                    min={year.startDate}
                    max={year.endDate}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </Field>
                <Field id="event-end" label="End date">
                  <Input
                    id="event-end"
                    type="date"
                    min={start || year.startDate}
                    max={year.endDate}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    required
                  />
                </Field>
                <Field id="event-start-time" label="Start time (optional)">
                  <Input
                    id="event-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </Field>
                <Field id="event-end-time" label="End time (optional)">
                  <Input
                    id="event-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </Field>
              </div>
            </section>
            <section className="fr-form-section">
              <h3>03 · Target cohorts & campus venue</h3>
              <p>Leave cohorts unselected to include the whole school.</p>
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
              <label htmlFor="event-venue">Venue / room</label>
              <Input
                id="event-venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                maxLength={100}
                placeholder="e.g. School auditorium"
              />
            </section>
            <section className="fr-form-section">
              <h3>04 · Instructions & publication</h3>
              <label htmlFor="event-description">
                Description / instructions
              </label>
              <textarea
                className="fr-textarea"
                id="event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1500}
                rows={5}
              />
              <label htmlFor="event-status">Publication state</label>
              <Select
                id="event-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as AcademicEvent["status"])
                }
              >
                <option value="draft">Draft · keep for review</option>
                <option value="published">
                  Published · show in the school calendar
                </option>
              </Select>
            </section>
            {error && (
              <p role="alert" className="config-errors">
                {error}
              </p>
            )}
            <footer className="fr-form-footer">
              <LinkButton href="/dashboard/calendar">Cancel</LinkButton>
              <Button type="submit">
                {saving
                  ? "Saving event…"
                  : status === "published"
                    ? "Publish academic event"
                    : "Save event draft"}
                <ArrowRight aria-hidden="true" />
              </Button>
            </footer>
          </fieldset>
        </form>
      </Panel>
      <aside>
        <Panel title="Calendar preview">
          <div className="fr-help">
            <div className="fr-preview">
              <CalendarDays aria-hidden="true" />
              <h3>{title || "Your academic event"}</h3>
              <p>
                {category} · {start || "Start date"}
                {end !== start ? ` → ${end}` : ""}
              </p>
              <p>
                {startTime || "All day"}
                {endTime ? ` – ${endTime}` : ""}
                {venue ? ` · ${venue}` : ""}
              </p>
              <p>
                {cohorts.length
                  ? `${cohorts.length} selected cohorts`
                  : "Whole school"}
              </p>
              <Badge>{status}</Badge>
            </div>
            <h3>Before you publish</h3>
            <ul>
              <li>Check the date range and academic term.</li>
              <li>Confirm the venue and target cohorts.</li>
              <li>
                Published events appear on the calendar; drafts stay available
                for review.
              </li>
            </ul>
          </div>
        </Panel>
        <Panel title="School calendar">
          <div className="fr-help">
            <p>
              {year.startDate} → {year.endDate}
            </p>
            <p>
              Instructional-day counts use the configured working week and
              published holidays. No statutory certification is implied.
            </p>
            <LinkButton href="/dashboard/calendar">View calendar</LinkButton>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
