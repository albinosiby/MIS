"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "../hooks/workspace-provider";
import { Badge } from "./workspace-ui";
import "../styles/first-row.css";

export const firstRowPages = {
  "/school-setup": [
    "Setup wizard",
    "Prepare your school for the academic year, one verified step at a time.",
  ],
  "/school-setup/data-ingestion": [
    "Resume data migration",
    "Import student records, resolve exceptions and continue to the parent gateway.",
  ],
  "/dashboard/approvals": [
    "Approvals inbox",
    "Review administrative requests and staff leave with a clear decision trail.",
  ],
  "/dashboard/calendar": [
    "Academic calendar",
    "Plan teaching days, examinations and school milestones in one place.",
  ],
  "/dashboard/calendar/new": [
    "Add academic event",
    "Create a milestone, choose its audience and publish it to your school calendar.",
  ],
  "/audit": [
    "System audit log",
    "Review recorded workspace changes by actor, date and action.",
  ],
  "/communication/new": [
    "Quick notice",
    "Prepare a school announcement and choose who should receive it.",
  ],
  "/admissions/analytics": [
    "Admissions conversion funnel",
    "Understand your intake pipeline, enquiry sources and available seats.",
  ],
  "/admissions/inquiries": [
    "Manage inquiries",
    "Triage prospective students, assign counselors and keep follow-ups moving.",
  ],
  "/timetable/substitutions": [
    "Proxy & faculty substitution",
    "Find an available colleague and keep every scheduled lesson covered.",
  ],
} as const;

export function FirstRowHeader({
  route,
}: {
  route: keyof typeof firstRowPages;
}) {
  const { year } = useWorkspace();
  const pending =
    year.records.approvals.filter((a) => a.status === "pending").length +
    year.records.leaves.filter((a) => a.status === "pending").length;
  const [title, description] = firstRowPages[route];
  return (
    <>
      <header className="fr-heading">
        <div>
          <Link className="fr-back" href="/dashboard">
            <ArrowLeft aria-hidden="true" />
            Dashboard
          </Link>
          <p className="fr-eyebrow">
            SCHOOL OPERATIONS · AY {year.setup.calendar.year.name}
          </p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="fr-scope">
          <Badge>{year.setup.school.shortName}</Badge>
          <span>
            {year.locked
              ? "Archived year · read only"
              : "Current school workspace"}
          </span>
        </div>
      </header>
      <nav className="fr-nav" aria-label="School operations views">
        {[
          ["/dashboard", "Live operations", LayoutDashboard],
          ["/school-setup", "Setup wizard", ClipboardCheck],
          ["/dashboard/approvals", "Approvals inbox", ShieldCheck],
          ["/dashboard/calendar", "Academic calendar", CalendarDays],
        ].map(([href, label, Icon]) => {
          const active =
            href === "/dashboard" ? false : route.startsWith(String(href));
          const Glyph = Icon as typeof CalendarDays;
          return (
            <Link
              key={String(href)}
              href={String(href)}
              aria-current={active ? "page" : undefined}
            >
              <Glyph aria-hidden="true" />
              {String(label)}
              {href === "/school-setup" && (
                <Badge>
                  {Math.round((year.setup.completed.length / 8) * 100)}%
                </Badge>
              )}
              {href === "/dashboard/approvals" && (
                <Badge tone={pending ? "amber" : "gray"}>{pending}</Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
