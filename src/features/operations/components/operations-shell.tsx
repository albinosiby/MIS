"use client";
import Link from "next/link";
import { SchoolLogo } from "@/components/branding/school-logo";
import { useState, type ReactNode } from "react";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { AccountIdentity } from "../../identity/models";
import { useBackend } from "../../identity/components/identity-context";
import { signOut } from "../../identity/server/actions";
import { canAccess, roleHome } from "../../identity/domain/access";
import { areaTitles, portalSections } from "../data/routes";
import { Button } from "@/components/ui/button";
import "../styles.css";
export function OperationsShell({
  actor,
  route,
  children,
}: {
  actor: AccountIdentity;
  route: string;
  children: ReactNode;
}) {
  const cloud = useBackend() === "supabase";
  const { year, root, switchYear } = useWorkspace();
  const [open, setOpen] = useState(false);
  const portal = actor.role === "staff" ? "staff-portal" : actor.role;
  const personal = portalSections[portal];
  const nav = personal
    ? portalSections[portal].map((s) => ({
        href: s === "overview" ? `/${portal}` : `/${portal}/${s}`,
        label: s.replaceAll("-", " "),
      }))
    : [
        { href: roleHome(actor.role), label: "Overview" },
        ...Object.entries(areaTitles)
          .filter(([a]) => canAccess(actor.role, `/${a}`) && `/${a}` !== roleHome(actor.role))
          .map(([a, t]) => ({ href: `/${a}`, label: t })),
      ];
  return (
    <div className="op-app">
      <aside className={`op-sidebar ${open ? "op-open" : ""}`}>
        <Link className="op-brand" href={roleHome(actor.role)}>
          <SchoolLogo size={36} />{" "}
          <span>
            {year.setup.school.shortName}
            <small>{actor.role} workspace</small>
          </span>
        </Link>
        <nav aria-label="Workspace navigation">
          <Link href="/support" className={route === "/support" ? "active" : ""}>Support centre</Link>
          {nav.map((n) => (
            <Link
              key={n.href}
              className={route === n.href ? "active" : ""}
              href={n.href}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
          {["admin","principal","accountant"].includes(actor.role)&&<><Link href="/fees/ledger">Ledger & instalments</Link><Link href="/fees/bank-statements">Bank reconciliation</Link></>}
          <Link href="/communication/inbox" className={route === "/communication/inbox" ? "active" : ""}>Private inbox</Link>
          {["admin", "principal"].includes(actor.role) && <Link href="/communication/jobs">Scheduled work</Link>}
          <Link href="/documents/publications">Published records</Link>
          {["admin","principal"].includes(actor.role) && <Link href="/settings/advanced">School workflows</Link>}
          {actor.role === "hr" && <Link href="/hr/payroll-runs">Payroll runs</Link>}
          <Link href="/documents/files" className={route === "/documents/files" ? "active" : ""}>Private documents</Link>
        </nav>
        <div className="op-sidebar-bottom">
          <Link href="/account/approvals">My approval queue</Link>
          <Link href="/account/security">Account & security</Link>
          <Link href="/select-role">Switch account</Link>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
          <small>{cloud ? "School workspace" : "Saved on this device"}</small>
        </div>
      </aside>
      <div className="op-body">
        <header className="op-topbar">
          <button onClick={() => setOpen(!open)} aria-label="Toggle navigation">
            ☰
          </button>
          <span>{year.setup.school.shortName}</span>
          <label className="op-year">
            <span className="sr-only">Academic year</span>
            <select
              aria-label="Academic year"
              value={root.activeYearId}
              onChange={(e) => void switchYear(e.target.value)}
            >
              {root.years.map((y) => (
                <option
                  value={y.setup.calendar.year.id}
                  key={y.setup.calendar.year.id}
                >
                  {y.setup.calendar.year.name}
                  {y.locked ? " · archived" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="op-avatar">{actor.name.slice(0, 1)}</div>
          <div className="op-user">
            <strong>{actor.name}</strong>
            <small>{actor.role}</small>
          </div>
        </header>
        <main id="main-content" className="op-content">
          {children}
          <footer className="op-footer">
            {year.setup.school.shortName} · {year.setup.calendar.year.name} ·{" "}
            {year.locked ? "Archived · read only" : "School workspace"}
            <span>{cloud ? "Changes saved." : "Saved on this device."}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
