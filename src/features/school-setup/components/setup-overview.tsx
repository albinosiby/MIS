"use client";

import { useBackend } from "../../identity/components/identity-context";
import { Button } from "@/components/ui/button";
import { FigmaAsset } from "@/components/layout/figma-asset";
import type { SchoolProfile, StaffSummary } from "@/shared/models";
import type { SetupSummary } from "../models";
import type { ReactNode } from "react";

export function SetupOverview({
  inspect,
  summary,
  school,
  principal,
  variant = "setup",
  metrics,
  referenceDate = "2026-10-17",
}: {
  inspect: (title: string, content?: ReactNode) => void;
  summary: SetupSummary;
  school: SchoolProfile;
  principal: StaffSummary;
  variant?: "setup" | "operations";
  metrics?: ReactNode;
  referenceDate?: string;
}) {
  const cloud = useBackend() === "supabase";
  return (
    <>
      <section className="setup-greeting" aria-label="School overview">
        <div className="greeting-top">
          <div className="greeting-title">
            <h1>Good morning, {principal.displayName}</h1>
            <span className="campus-badge">
              <i />
              Campus Active
            </span>
          </div>
          <div className="greeting-actions">
            <Button
              variant="outline"
              onClick={() => inspect("System Audit Log")}
            >
              <FigmaAsset group="greeting" name="imgContainer" />
              System Audit Log
            </Button>
            <Button variant="outline" onClick={() => inspect("Quick Notice")}>
              <FigmaAsset group="greeting" name="imgContainer1" />
              Quick Notice
            </Button>
            <Button onClick={() => inspect("Add Academic Event")}>
              <FigmaAsset group="greeting" name="imgContainer2" />
              Add Academic Event
            </Button>
          </div>
        </div>
        <p className="greeting-meta">
          <span>
            {new Intl.DateTimeFormat("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(referenceDate + "T00:00:00Z"))}{" "}
            · Reference date
          </span>
          <b>•</b>
          <span>
            {school.name} ({school.curriculum} Affiliation #
            {school.affiliationNumber})
          </span>
          <b>•</b>
          <code>09:42 AM IST</code>
        </p>
      </section>
      <nav className="setup-subnav" aria-label="Dashboard views">
        <button
          className={variant === "operations" ? "selected" : ""}
          aria-current={variant === "operations" ? "page" : undefined}
          onClick={() => inspect("Live Operations")}
        >
          <FigmaAsset group="greeting" name="imgContainer3" />
          <span>
            Live
            <br />
            Operations
          </span>
          <small className="live-tag">LIVE</small>
        </button>
        <button
          className={variant === "setup" ? "selected" : ""}
          aria-current={variant === "setup" ? "page" : undefined}
          onClick={() => inspect("Setup Wizard")}
        >
          <FigmaAsset group="greeting" name="imgContainer6" />
          <span>
            Setup
            <br />
            Wizard
          </span>
          <small className="progress-tag">
            {summary.completionPercent}% Done
          </small>
        </button>
        <button onClick={() => inspect("Approvals Inbox")}>
          <FigmaAsset group="greeting" name="imgContainer4" />
          <span>
            Approvals
            <br />
            Inbox
          </span>
          <small className="pending-tag">
            {summary.pendingApprovals} Pending
          </small>
        </button>
        <button onClick={() => inspect("Academic Calendar")}>
          <FigmaAsset group="greeting" name="imgContainer5" />
          <span>
            Academic
            <br />
            Calendar
          </span>
          <small className="upcoming-tag">
            {summary.upcomingEvents} Upcoming
          </small>
        </button>
        <div className="sync-status">
          <FigmaAsset group="greeting" name="imgContainer7" />
          <span>
            {cloud ? "School workspace" : "School workspace"}
            <small>
              {cloud ? "Changes saved" : "Saved on this device"}
            </small>
          </span>
        </div>
      </nav>
      {metrics ?? (
        <section className="setup-metrics" aria-label="Setup summary">
          <article className="metric-card">
            <span>PIPELINE VELOCITY</span>
            <div className="metric-icon metric-blue">
              <FigmaAsset group="metrics" name="imgContainer1" />
            </div>
            <div className="metric-value">
              {summary.pipelineVelocityPercent}%{" "}
              <small className="velocity">
                <FigmaAsset group="metrics" name="imgContainer" />
                {summary.velocityChangePerHour >= 0 ? "+" : ""}
                {summary.velocityChangePerHour}% / hr
              </small>
            </div>
          </article>
          <article className="metric-card">
            <span>VALIDATED STUDENTS</span>
            <div className="metric-icon metric-sky">
              <FigmaAsset group="metrics" name="imgContainer2" />
            </div>
            <div className="metric-value">
              {summary.validatedStudents.toLocaleString("en-IN")}{" "}
              <small>/ {summary.totalStudents.toLocaleString("en-IN")}</small>
            </div>
          </article>
          <article className="metric-card">
            <span>MANDATORY DEADLINE</span>
            <div className="metric-icon metric-red">
              <FigmaAsset group="metrics" name="imgContainer3" />
            </div>
            <div className="metric-value">
              <em>{summary.deadlineDays}</em> <small>Days Left</small>
            </div>
          </article>
          <article className="metric-card">
            <span>TARGET TERM-START</span>
            <div className="metric-icon metric-slate">
              <FigmaAsset group="metrics" name="imgContainer4" />
            </div>
            <div className="metric-value metric-date">
              {new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(summary.targetTermStart + "T00:00:00Z"))}
            </div>
          </article>
        </section>
      )}
    </>
  );
}
