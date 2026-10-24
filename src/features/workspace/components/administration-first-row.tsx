"use client";
import { useState, type ReactNode } from "react";
import { ShieldCheck, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../hooks/workspace-provider";
import { decideApproval, decideLeave } from "../domain/operations";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  DataForm,
  RecordDialog,
  LinkButton,
  ExportButton,
  staffOptions,
  studentOptions,
  labelFor,
  newRecord,
  money,
  enumOptions,
} from "./workspace-ui";

export function AuditLog({ search }: { search: string }) {
  const { year: y } = useWorkspace();
  const [query, setQuery] = useState(""),
    [actor, setActor] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const actors = [
    ...new Set(
      y.setup.audit.map((a) => a.actor?.displayName ?? "Legacy actor"),
    ),
  ];
  const rows = y.setup.audit
    .slice()
    .reverse()
    .filter(
      (a) =>
        (actor === "all" ||
          (a.actor?.displayName ?? "Legacy actor") === actor) &&
        (!from || a.at.slice(0, 10) >= from) &&
        (!to || a.at.slice(0, 10) <= to) &&
        `${a.id} ${a.action} ${a.actor?.displayName ?? ""} ${a.actor?.role ?? ""}`
          .toLowerCase()
          .includes(`${search} ${query}`.trim().toLowerCase()),
    );
  return (
    <>
      <div className="fr-toolbar">
        <p>Accountable changes across your school workspace.</p>
        <ExportButton
          name="school-audit-filtered"
          report="audit"
          rows={rows.map((a) => ({
            time: a.at,
            eventId: a.id,
            actor: a.actor?.displayName ?? "Legacy actor",
            role: a.actor?.role ?? "",
            action: a.action,
          }))}
        />
      </div>
      <Metrics
        items={[
          {
            label: "Recorded events",
            value: y.setup.audit.length,
            detail: "Retained in this workspace",
          },
          {
            label: "Distinct actors",
            value: actors.length,
            detail: "Includes legacy entries",
          },
          {
            label: "Matching events",
            value: rows.length,
            detail: "Current search and filters",
          },
        ]}
      />
      <div className="ws-filter-bar">
        <label className="fr-filter">
          Search action, actor or event ID
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search audit records…"
            maxLength={200}
          />
        </label>
        <label className="fr-filter">
          Actor
          <Select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="all">All actors</option>
            {actors.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </label>
        <label className="fr-filter">
          From date
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="fr-filter">
          To date
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setQuery("");
            setActor("all");
            setFrom("");
            setTo("");
          }}
        >
          Clear filters
        </Button>
      </div>
      <Panel
        title="General audit trail"
        action={<Badge>{rows.length} events</Badge>}
      >
        <Table
          headers={["Time", "Event ID", "Actor / role", "Action"]}
          rows={rows.map((a) => [
            new Date(a.at).toLocaleString(y.setup.school.locale, {
              timeZone: y.setup.school.timezone,
            }),
            <small>{a.id}</small>,
            <>
              <strong>{a.actor?.displayName ?? "Legacy actor"}</strong>
              <br />
              <small>{a.actor?.role ?? "Not recorded"}</small>
            </>,
            a.action,
          ])}
          empty="No audit events match these filters."
        />
      </Panel>
      <div className="fr-note">
        <ShieldCheck aria-hidden="true" />
        <span>
          This view shows the retained workspace audit trail. It does not
          certify immutable storage, a digital signature or statutory
          compliance.
        </span>
      </div>
    </>
  );
}

export function ApprovalsInbox({ search }: { search: string }) {
  const { year: y, mutate, busy } = useWorkspace();
  const [category, setCategory] = useState("all"),
    [status, setStatus] = useState("pending"),
    [query, setQuery] = useState("");
  const [editor, setEditor] = useState<ReactNode>(null);
  const people = [...staffOptions(y), ...studentOptions(y)];
  const needle = `${search} ${query}`.trim().toLowerCase();
  const approvals = y.records.approvals.filter(
    (a) =>
      (category === "all" || a.category === category) &&
      (status === "all" || a.status === status) &&
      `${a.title} ${a.reason} ${labelFor(people, a.requesterId)}`
        .toLowerCase()
        .includes(needle),
  );
  const leaves = y.records.leaves.filter(
    (a) =>
      (category === "all" || category === "leave") &&
      (status === "all" || a.status === status) &&
      `${a.reason} ${labelFor(people, a.personId)}`
        .toLowerCase()
        .includes(needle),
  );
  const all = [...y.records.approvals, ...y.records.leaves];
  function decision(
    id: string,
    kind: "administrative" | "leave",
    verdict: "approved" | "rejected",
  ) {
    setEditor(
      <Dialog
        title={`${verdict === "approved" ? "Authorize" : "Reject"} ${kind} request`}
        onClose={() => setEditor(null)}
      >
        <p>
          Record a decision note so the requester and school have a clear
          reason.
        </p>
        <DataForm
          initial={{ note: "" }}
          fields={[
            {
              name: "note",
              label: "Decision note (8–500 characters)",
              type: "textarea",
              required: true,
            },
          ]}
          submitLabel={
            verdict === "approved"
              ? "Confirm authorization"
              : "Confirm rejection"
          }
          onSave={async (input) => {
            if (
              !input ||
              typeof input !== "object" ||
              !("note" in input) ||
              typeof input.note !== "string"
            )
              throw new Error("Add a decision note.");
            const note = input.note;
            await mutate(
              (current) =>
                kind === "administrative"
                  ? decideApproval(current, id, verdict, note)
                  : decideLeave(current, id, verdict, note),
              `${verdict} ${kind} request ${id}`,
            );
            setEditor(null);
          }}
        />
      </Dialog>,
    );
  }
  const actions = (
    id: string,
    kind: "administrative" | "leave",
    currentStatus: string,
    note: string,
  ) =>
    currentStatus === "pending" ? (
      <div className="ws-actions">
        <Button
          disabled={busy || y.locked}
          onClick={() => decision(id, kind, "approved")}
        >
          Authorize
        </Button>
        <Button
          disabled={busy || y.locked}
          variant="outline"
          onClick={() => decision(id, kind, "rejected")}
        >
          Reject
        </Button>
      </div>
    ) : (
      <small>{note || "Decision recorded"}</small>
    );
  return (
    <>
      <div className="fr-toolbar">
        <p>Review requests without losing the context behind each decision.</p>
        <div className="ws-actions">
          <LinkButton href="/timetable/substitutions">
            Manage substitutions
          </LinkButton>
          <Button
            disabled={busy || y.locked}
            onClick={() =>
              setEditor(
                <RecordDialog
                  title="Create administrative request"
                  collection="approvals"
                  initial={{
                    ...newRecord(y),
                    title: "",
                    category: "purchase",
                    requesterId: y.setup.staff[0].id,
                    targetId: null,
                    reason: "",
                    amountMinor: 0,
                    status: "pending",
                    decisionNote: "",
                  }}
                  fields={[
                    { name: "title", label: "Request title", required: true },
                    {
                      name: "category",
                      label: "Category",
                      type: "select",
                      options: enumOptions(["gate_pass", "purchase"]),
                    },
                    {
                      name: "requesterId",
                      label: "Requester",
                      type: "select",
                      options: people,
                    },
                    {
                      name: "reason",
                      label: "Reason / impact (8+ characters)",
                      type: "textarea",
                    },
                    {
                      name: "amountMinor",
                      label: "Amount, if applicable",
                      type: "number",
                      factor: 100,
                    },
                  ]}
                  onClose={() => setEditor(null)}
                />,
              )
            }
          >
            <Plus aria-hidden="true" />
            New request
          </Button>
        </div>
      </div>
      <Metrics
        items={[
          {
            label: "Awaiting decision",
            value: all.filter((a) => a.status === "pending").length,
            detail: "Administrative and leave requests",
          },
          {
            label: "Approved",
            value: all.filter((a) => a.status === "approved").length,
            detail: "Decisions recorded",
          },
          {
            label: "Rejected",
            value: all.filter((a) => a.status === "rejected").length,
            detail: "With a decision note",
          },
        ]}
      />
      <div className="ws-filter-bar">
        <label className="fr-filter">
          Find a request
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Requester or reason…"
            maxLength={200}
          />
        </label>
        <label className="fr-filter">
          Request category
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {enumOptions([
              "all",
              "leave",
              "concession",
              "exam_unlock",
              "gate_pass",
              "purchase",
            ]).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="fr-filter">
          Decision status
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {enumOptions(["pending", "approved", "rejected", "all"]).map(
              (o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ),
            )}
          </Select>
        </label>
        <Badge>{approvals.length + leaves.length} matching requests</Badge>
      </div>
      <Panel title="Administrative requests">
        <Table
          headers={[
            "Requester / request",
            "Category",
            "Scope & impact",
            "Status",
            "Decision",
          ]}
          rows={approvals.map((a) => [
            <>
              <strong>{labelFor(people, a.requesterId)}</strong>
              <br />
              <small>{a.title}</small>
            </>,
            a.category.replaceAll("_", " "),
            <>
              {a.reason}
              {a.amountMinor > 0 && <p>{money(y, a.amountMinor)}</p>}
            </>,
            <Badge
              tone={
                a.status === "pending"
                  ? "amber"
                  : a.status === "approved"
                    ? "green"
                    : "gray"
              }
            >
              {a.status}
            </Badge>,
            actions(a.id, "administrative", a.status, a.decisionNote),
          ])}
          empty="No administrative requests match your filters."
        />
      </Panel>
      <Panel title="Leave & coverage requests">
        <Table
          headers={["Requester", "Dates", "Reason", "Status", "Decision"]}
          rows={leaves.map((a) => [
            <>
              <strong>{labelFor(people, a.personId)}</strong>
              <br />
              <small>{a.personType}</small>
            </>,
            `${a.dates.startDate} → ${a.dates.endDate}`,
            a.reason,
            <Badge
              tone={
                a.status === "pending"
                  ? "amber"
                  : a.status === "approved"
                    ? "green"
                    : "gray"
              }
            >
              {a.status}
            </Badge>,
            actions(a.id, "leave", a.status, a.decisionNote),
          ])}
          empty="No leave requests match your filters."
        />
      </Panel>
      {editor}
    </>
  );
}
