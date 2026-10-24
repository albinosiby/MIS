"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIdentity } from "../../identity/components/identity-context";
import type { SchoolYearWorkspace } from "../models";
import { academicReferenceDate } from "../domain/form-values";
import { balance } from "../domain/operations";
import { Badge, LinkButton, Panel, Table, money } from "./workspace-ui";
import "../styles/operations-dashboard.css";

/** Presentation of the existing, validated school-year workspace; no parallel data contract. */
export function OperationsDashboard({
  year: y,
  search,
}: {
  year: SchoolYearWorkspace;
  search: string;
}) {
  const actor = useIdentity();
  const [date, setDate] = useState(
    academicReferenceDate(y.setup.calendar.year),
  );
  const attendance = y.records.attendance.filter(
    (a) => a.date === date && a.personType === "student" && a.periodId === null,
  );
  const present = attendance.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const pending =
    y.records.approvals.filter((a) => a.status === "pending").length +
    y.records.leaves.filter((a) => a.status === "pending").length;
  const collected = y.records.payments
    .filter((p) => p.status === "completed")
    .reduce((total, p) => total + p.amountMinor - p.refundedMinor, 0);
  const unpaid = y.records.invoices.filter(
    (i) => i.status === "issued" && balance(y, i.id) > 0,
  ).length;
  const setupPercent = Math.round((y.setup.completed.length / 8) * 100);
  const upcoming = y.records.events
    .filter((e) => e.status === "published" && e.dates.endDate >= date)
    .sort((a, b) => a.dates.startDate.localeCompare(b.dates.startDate));
  const enrolled = y.records.inquiries.filter(
    (i) => i.stage === "enrolled",
  ).length;
  const stages = [
    ["new", "New enquiries"],
    ["contacted", "Contacted"],
    ["campus_visit", "Campus visits"],
    ["application", "Applications"],
    ["assessment", "Assessments"],
    ["offered", "Offers sent"],
    ["waitlisted", "Waitlisted"],
    ["enrolled", "Enrolled"],
    ["lost", "Closed / lost"],
  ] as const;
  const metrics = [
    {
      label: "Campus attendance",
      value: attendance.length
        ? `${Math.round((present / attendance.length) * 100)}%`
        : "—",
      detail: attendance.length
        ? `${present} present / ${attendance.length} marked`
        : "No daily marks for this date",
      href: "/attendance",
      icon: ClipboardCheck,
    },
    {
      label: "Fee collections",
      value: money(y, collected),
      detail: "Academic year · net of refunds",
      href: "/fees",
      icon: Wallet,
    },
    {
      label: "Admissions",
      value: y.records.inquiries.length,
      detail: `${enrolled} enrolled this academic year`,
      href: "/admissions",
      icon: GraduationCap,
    },
    {
      label: "Staff leave",
      value: y.records.leaves.filter(
        (l) => l.personType === "staff" && l.status === "pending",
      ).length,
      detail: "Requests awaiting a decision",
      href: "/attendance/leave",
      icon: Users,
    },
    {
      label: "Document reviews",
      value: y.records.studentProfiles.filter((p) =>
        p.documents.some((d) => d.status === "pending"),
      ).length,
      detail: "Students with pending documents",
      href: "/students",
      icon: FileCheck2,
    },
    {
      label: "Pending approvals",
      value: pending,
      detail: "Administrative and leave requests",
      href: "/dashboard/approvals",
      icon: ShieldCheck,
    },
  ];
  const alerts = [
    {
      count: pending,
      title: "Approvals awaiting review",
      detail: "Administrative and leave requests",
      href: "/dashboard/approvals",
      icon: ShieldCheck,
    },
    {
      count: unpaid,
      title: "Outstanding fee invoices",
      detail: "Issued invoices with a balance",
      href: "/fees/invoices",
      icon: Receipt,
    },
    {
      count: y.records.lessons.filter((l) => l.status === "submitted").length,
      title: "Lesson plans to review",
      detail: "Submitted by your teaching team",
      href: "/academics/lessons",
      icon: FileCheck2,
    },
  ];
  const term = search.trim().toLowerCase();
  const events = upcoming
    .filter((e) =>
      `${e.title} ${e.category} ${e.venue}`.toLowerCase().includes(term),
    )
    .slice(0, 4);
  const notifications = y.records.notifications
    .filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(term))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  return (
    <div className="operations-dashboard">
      <header className="od-heading">
        <div>
          <p className="od-eyebrow">YOUR SCHOOL AT A GLANCE</p>
          <h1>Welcome, {actor?.name ?? y.setup.school.shortName}</h1>
          <p className="od-subtitle">
            A clear view of your campus, and what needs your attention.
          </p>
        </div>
        <div className="od-actions">
          <LinkButton href="/audit">
            <ShieldCheck aria-hidden="true" />
            Audit log
          </LinkButton>
          <LinkButton href="/communication/new">
            <Megaphone aria-hidden="true" />
            Quick notice
          </LinkButton>
          <LinkButton href="/dashboard/calendar/new" variant="default">
            <CalendarDays aria-hidden="true" />
            Add academic event
          </LinkButton>
        </div>
      </header>
      <nav className="od-navigation" aria-label="Dashboard views">
        <Link href="/dashboard" aria-current="page">
          <LayoutDashboard aria-hidden="true" />
          Live operations
        </Link>
        <Link href="/school-setup">
          <ClipboardCheck aria-hidden="true" />
          Setup wizard<Badge>{setupPercent}%</Badge>
        </Link>
        <Link href="/dashboard/approvals">
          <ShieldCheck aria-hidden="true" />
          Approvals<Badge tone={pending ? "amber" : "gray"}>{pending}</Badge>
        </Link>
        <Link href="/dashboard/calendar">
          <CalendarDays aria-hidden="true" />
          Academic calendar<Badge>{upcoming.length}</Badge>
        </Link>
      </nav>
      <div className="od-section-heading">
        <div>
          <h2>Campus overview</h2>
          <p>
            Academic year {y.setup.calendar.year.name} ·{" "}
            {y.setup.school.shortName}
          </p>
        </div>
        <label className="od-date">
          Attendance & event reference
          <Input
            type="date"
            value={date}
            min={y.setup.calendar.year.startDate}
            max={y.setup.calendar.year.endDate}
            onChange={(e) => {
              const value = e.target.value;
              if (
                e.target.validity.valid &&
                value >= y.setup.calendar.year.startDate &&
                value <= y.setup.calendar.year.endDate
              )
                setDate(value);
            }}
          />
        </label>
      </div>
      <section className="od-metrics" aria-label="Campus metrics">
        {metrics.map(({ label, value, detail, href, icon: Icon }) => (
          <Link key={label} href={href} className="od-metric">
            <div className="od-metric-top">
              <span>{label}</span>
              <Icon aria-hidden="true" />
            </div>
            <strong>{value}</strong>
            <span className="od-metric-detail">{detail}</span>
            <span className="od-metric-link">
              View details <ArrowRight aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>
      <div className="od-columns">
        <div>
          <Panel
            title="Admissions pipeline"
            action={
              <LinkButton href="/admissions/analytics">
                View funnel <ArrowRight aria-hidden="true" />
              </LinkButton>
            }
          >
            <div className="od-pipeline-summary">
              <div>
                <strong>{y.records.inquiries.length}</strong>
                <span>Total enquiries</span>
              </div>
              <div>
                <strong>
                  {y.records.inquiries.length
                    ? `${Math.round((enrolled / y.records.inquiries.length) * 100)}%`
                    : "—"}
                </strong>
                <span>Enrolled / all enquiries</span>
              </div>
              <Badge>Current academic year</Badge>
            </div>
            <p className="od-caption">Current stage of each enquiry</p>
            <div className="od-pipeline">
              {stages.map(([stage, label]) => {
                const count = y.records.inquiries.filter(
                  (i) => i.stage === stage,
                ).length;
                return (
                  <div className="od-stage" key={stage}>
                    <span>{label}</span>
                    <progress
                      aria-label={`${label}: ${count} of ${y.records.inquiries.length} enquiries`}
                      max={Math.max(1, y.records.inquiries.length)}
                      value={count}
                    />
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
            {!y.records.inquiries.length && (
              <p className="od-empty">
                No enquiries yet. Add your first enquiry to start tracking
                admissions.
              </p>
            )}
            <div className="od-panel-footer">
              <span>Every enquiry is counted once.</span>
              <LinkButton href="/admissions/inquiries">
                Manage enquiries <ArrowRight aria-hidden="true" />
              </LinkButton>
            </div>
          </Panel>
          <Panel
            title="Academic year setup"
            className="od-setup"
            action={
              <Badge tone={setupPercent === 100 ? "green" : "blue"}>
                {setupPercent === 100 ? "Complete" : "In progress"}
              </Badge>
            }
          >
            <div className="od-setup-body">
              <div>
                <h3>{y.setup.completed.length} of 8 phases completed</h3>
                <p>Keep your school records ready for the academic year.</p>
                <progress
                  aria-label="Academic year setup completion"
                  value={y.setup.completed.length}
                  max={8}
                />
              </div>
              <LinkButton href="/school-setup" variant="default">
                {setupPercent === 100 ? "Review setup" : "Resume setup"}
                <ArrowRight aria-hidden="true" />
              </LinkButton>
            </div>
          </Panel>
          <Panel
            title="Grade intake capacity"
            action={
              <LinkButton href="/admissions/seats">
                Manage seats <ArrowRight aria-hidden="true" />
              </LinkButton>
            }
          >
            <Table
              headers={[
                "Class / section",
                "Enrolled",
                "Capacity",
                "Utilisation",
              ]}
              rows={y.setup.classes
                .filter((c) =>
                  `${c.grade} ${c.section}`.toLowerCase().includes(term),
                )
                .map((c) => {
                  const count = y.setup.students.filter(
                    (s) => s.classSectionId === c.id,
                  ).length;
                  const percent =
                    c.capacity > 0
                      ? Math.round((count / c.capacity) * 100)
                      : null;
                  return [
                    <strong>
                      Grade {c.grade} · {c.section}
                    </strong>,
                    count,
                    c.capacity,
                    <div className="od-capacity">
                      <progress
                        aria-label={`Grade ${c.grade} ${c.section} capacity`}
                        max={Math.max(1, c.capacity)}
                        value={count}
                      />
                      <Badge
                        tone={
                          percent === null
                            ? "gray"
                            : percent > 90
                              ? "amber"
                              : "green"
                        }
                      >
                        {percent === null ? "Not set" : `${percent}%`}
                      </Badge>
                    </div>,
                  ];
                })}
              empty={
                term
                  ? "No classes match your search."
                  : "No classes configured. Add classes in school setup."
              }
            />
          </Panel>
        </div>
        <aside className="od-sidebar" aria-label="School priorities">
          <Panel
            title="Needs your attention"
            action={
              <Badge tone={alerts.some((a) => a.count) ? "amber" : "green"}>
                {alerts.reduce((sum, a) => sum + a.count, 0)} items
              </Badge>
            }
          >
            <div className="od-alerts">
              {alerts.map(({ count, title, detail, href, icon: Icon }) => (
                <Link key={href} href={href}>
                  <span
                    className={`od-alert-icon ${count ? "od-alert-pending" : ""}`}
                  >
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                  <b>{count}</b>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </Panel>
          <Panel
            title="Upcoming events"
            action={
              <LinkButton href="/dashboard/calendar">
                Calendar <ArrowRight aria-hidden="true" />
              </LinkButton>
            }
          >
            <div className="od-events">
              {events.map((e) => {
                const start = new Date(e.dates.startDate + "T00:00:00Z");
                return (
                  <Link
                    key={e.id}
                    href={`/dashboard/calendar?month=${e.dates.startDate.slice(0, 7)}`}
                  >
                    <time dateTime={e.dates.startDate}>
                      <span>
                        {start.toLocaleDateString("en-IN", {
                          month: "short",
                          timeZone: "UTC",
                        })}
                      </span>
                      <strong>{start.getUTCDate()}</strong>
                    </time>
                    <span>
                      <strong>{e.title}</strong>
                      <small>
                        {e.category}
                        {e.venue ? ` · ${e.venue}` : ""}
                      </small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                );
              })}
              {!events.length && (
                <p className="od-empty">
                  {term
                    ? "No upcoming events match your search."
                    : "No upcoming published events. Plan your next academic event from the calendar."}
                </p>
              )}
            </div>
          </Panel>
          <Panel
            title="Exam readiness"
            action={
              <LinkButton href="/exams">
                View exams <ArrowRight aria-hidden="true" />
              </LinkButton>
            }
          >
            <div className="od-exams">
              {y.records.exams.slice(0, 3).map((e) => (
                <Link href="/exams" key={e.id}>
                  <span>{e.name}</span>
                  <Badge>{e.status.replaceAll("_", " ")}</Badge>
                </Link>
              ))}
              {!y.records.exams.length && (
                <p className="od-empty">
                  No exam cycles configured for this academic year.
                </p>
              )}
            </div>
          </Panel>
          <Panel
            title="Recent notifications"
            action={
              <LinkButton href="/notifications">
                View all <ArrowRight aria-hidden="true" />
              </LinkButton>
            }
          >
            <div className="od-notifications">
              {notifications.map((n) => (
                <Link key={n.id} href={n.href}>
                  <span
                    className={`od-notification-dot ${n.read ? "is-read" : ""}`}
                    aria-label={n.read ? "Read" : "Unread"}
                  />
                  <span>
                    <strong>{n.title}</strong>
                    <small>
                      {n.category} ·{" "}
                      {new Date(n.createdAt).toLocaleDateString(
                        y.setup.school.locale,
                        { day: "numeric", month: "short", timeZone: "UTC" },
                      )}
                    </small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
              {!notifications.length && (
                <p className="od-empty">
                  {term
                    ? "No notifications match your search."
                    : "You're all caught up. New notifications will appear here."}
                </p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
      <div className="od-bottom-note">
        <ShieldCheck aria-hidden="true" />
        <span>
          Showing records for {y.setup.school.shortName} ·{" "}
          {y.setup.calendar.year.name}
        </span>
        <Button asChild variant="ghost">
          <Link href="/reports">
            Open reports <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
