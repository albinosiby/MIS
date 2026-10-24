"use client";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  Badge,
  classOptions,
  labelFor,
  subjectOptions,
} from "../../workspace/components/workspace-ui";
import { academicWeekdayDate } from "../../workspace/domain/form-values";
import { scope } from "../../workspace/domain/operations";
import { assignmentCandidates, assignSubstitute } from "../domain/assignment";
import { readableError } from "../../school-setup/components/form-errors";

export function SubstituteAssignmentDialog({
  onClose,
  initialSlotId,
}: {
  onClose: () => void;
  initialSlotId?: string;
}) {
  const { year: y, mutate, busy } = useWorkspace();
  const [slotId, setSlotId] = useState(
    initialSlotId ?? y.records.slots[0]?.id ?? "",
  );
  const slot = y.records.slots.find((s) => s.id === slotId);
  const [date, setDate] = useState(
    academicWeekdayDate(y.setup.calendar.year, slot?.weekday ?? "Monday"),
  );
  const [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [query, setQuery] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const candidates = useMemo(
    () => assignmentCandidates(y, slotId, date),
    [y, slotId, date],
  );
  const visible = candidates.filter((c) =>
    `${c.staff.displayName} ${c.staff.designation}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const chosen = candidates.find(
    (c) => c.staff.id === selected && !c.unavailableReason,
  );
  return (
    <Dialog title="Assign substitute teacher" onClose={onClose}>
      <form
        className="fr-assignment"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending || busy || y.locked) return;
          setPending(true);
          setError("");
          try {
            await mutate(
              (current) =>
                assignSubstitute(current, {
                  ...scope(y),
                  slotId,
                  date,
                  substituteStaffId: selected,
                  reason,
                }),
              "Assigned substitute teacher",
            );
            onClose();
          } catch (e) {
            setError(readableError(e));
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending || busy || y.locked}>
          <div className="fr-grid">
            <label>
              Target class & period
              <Select
                value={slotId}
                onChange={(e) => {
                  setSlotId(e.target.value);
                  setSelected("");
                  const next = y.records.slots.find(
                    (s) => s.id === e.target.value,
                  );
                  if (next)
                    setDate(
                      academicWeekdayDate(y.setup.calendar.year, next.weekday),
                    );
                }}
              >
                {y.records.slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {labelFor(classOptions(y), s.classSectionId)} · {s.weekday}{" "}
                    · {y.setup.bells.find((b) => b.id === s.periodId)?.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Substitution date
              <Input
                type="date"
                required
                min={y.setup.calendar.year.startDate}
                max={y.setup.calendar.year.endDate}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelected("");
                }}
              />
            </label>
          </div>
          {slot && (
            <div className="fr-note">
              <span>
                <strong>
                  {labelFor(subjectOptions(y), slot.subjectId)} · {slot.room}
                </strong>
                <br />
                Assigned teacher:{" "}
                {y.setup.staff.find((s) => s.id === slot.staffId)?.displayName}
                <br />
                {slot.weekday} ·{" "}
                {y.setup.bells.find((b) => b.id === slot.periodId)?.start}–
                {y.setup.bells.find((b) => b.id === slot.periodId)?.end}
              </span>
            </div>
          )}
          <h3>Available faculty</h3>
          <p className="dialog-hint">
            Subject experience is based on saved timetable slots. Availability
            is checked again when the assignment is saved.
          </p>
          <label>
            Find a teacher
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or designation…"
              maxLength={100}
            />
          </label>
          <div
            className="fr-candidates"
            role="radiogroup"
            aria-label="Substitute teacher"
          >
            {visible.map((c) => (
              <label className="fr-candidate" key={c.staff.id}>
                <input
                  type="radio"
                  name="substitute-teacher"
                  value={c.staff.id}
                  checked={selected === c.staff.id}
                  disabled={!!c.unavailableReason}
                  onChange={() => setSelected(c.staff.id)}
                />
                <span>
                  <strong>{c.staff.displayName}</strong>
                  <small>
                    {c.staff.designation} · {c.scheduledPeriods} scheduled
                    periods / week
                  </small>
                  <small>
                    {c.unavailableReason || "Available in this period"}
                  </small>
                  {c.teachesSubject && <Badge>Teaches this subject</Badge>}
                </span>
              </label>
            ))}
          </div>
          {!visible.length && (
            <p className="fr-empty">
              No candidates for this date or search. Choose the slot weekday and
              check the academic-year range.
            </p>
          )}
          <label>
            Reason / handover notes
            <textarea
              required
              minLength={8}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the cover requirement and lesson handover."
            />
          </label>
          <p className="dialog-hint">
            This saves a draft allotment. Review and publish it from the ledger.
            No SMS or WhatsApp message is sent by this dialog.
          </p>
          {error && (
            <p className="config-errors" role="alert">
              {error}
            </p>
          )}
          <div className="fr-form-footer">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!chosen}>
              {pending ? "Saving assignment…" : "Confirm assignment"}
            </Button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
