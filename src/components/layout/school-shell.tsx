"use client";
import { SchoolLogo } from "@/components/branding/school-logo";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SchoolProfile, StaffSummary } from "@/shared/models";
import { Input } from "@/components/ui/input";
import { FigmaAsset } from "./figma-asset";
import { figmaAssets } from "./figma-assets";

import {
  useIdentity,
  useBackend,
} from "@/features/identity/components/identity-context";
const navigation = [
  "Dashboard",
  "Admissions",
  "Students & Guardians",
  "Staff & HR",
  "Attendance",
  "Timetable",
  "Academics & Homework",
  "Exams & Results",
  "Fees & Payments",
  "Communication & Reports",
  "Settings & Year End",
];
const navIcons = [
  "imgContainer1",
  "imgContainer2",
  "imgContainer3",
  "imgContainer4",
  "imgContainer5",
  "imgContainer6",
  "imgContainer7",
  "imgContainer8",
  "imgContainer9",
  "imgContainer10",
  "imgContainer11",
] as const;

export function SchoolShell({
  children,
  school,
  principal,
  academicYearName,
  logo,
  search,
  onSearch,
  onInspect,
  years,
  selectedYearId,
  onYearChange,
  unreadCount = 0,
}: {
  children: ReactNode;
  school: SchoolProfile;
  principal: StaffSummary;
  academicYearName: string;
  logo?: string | null;
  search: string;
  onSearch: (value: string) => void;
  onInspect: (title: string) => void;
  years?: { id: string; name: string }[];
  selectedYearId?: string;
  onYearChange?: (id: string) => void;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const identity = useIdentity();
  const cloud = useBackend() === "supabase";
  const routes: Record<string, string> = {
    Dashboard: "/dashboard",
    Admissions: "/admissions",
    "Students & Guardians": "/students",
    "Staff & HR": "/staff",
    Attendance: "/attendance",
    Timetable: "/timetable",
    "Academics & Homework": "/academics",
    "Exams & Results": "/exams",
    "Fees & Payments": "/fees",
    "Communication & Reports": "/communication",
    "Settings & Year End": "/settings",
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="school-shell">
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`school-sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="School navigation"
      >
        <Link href="/school-setup" className="school-brand">
          <span className="school-crest">
            {logo ? (
              <img
                src={logo}
                alt=""
                width={30}
                height={30}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <SchoolLogo size={42} />
            )}
          </span>
          <span>
            <strong>
              {school.shortName} <small>{school.curriculum}</small>
            </strong>
            <span className="school-affiliation">
              Affiliation #{school.affiliationNumber} • {school.address.city}
            </span>
          </span>
        </Link>
        <button
          className="mobile-nav-close"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <nav>
          {navigation.map((name, index) => {
            const href = routes[name];
            const active =
              pathname === href ||
              pathname.startsWith(href + "/") ||
              (name === "Dashboard" && pathname.startsWith("/school-setup"));
            const content = (
              <>
                <span>
                  <FigmaAsset group="sidebar" name={navIcons[index]} />
                </span>
                {name}
              </>
            );
            return href ? (
              <Link
                key={name}
                href={href}
                className={`school-nav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={name}
                className="school-nav-item"
                onClick={() => {
                  setMobileOpen(false);
                  onInspect(name);
                }}
              >
                {content}
              </button>
            );
          })}
        </nav>
        <footer className="school-sidebar-footer">
          <Link href="/workspace" className="text-xs text-primary">
            All modules & workspaces →
          </Link>
          <Link href="/communication/inbox" className="text-xs text-primary">Private inbox →</Link>
          <Link href="/communication/jobs" className="text-xs text-primary">Scheduled work →</Link>
          <Link href="/settings/advanced" className="text-xs text-primary">School workflows →</Link>
          <Link href="/documents/publications" className="text-xs text-primary">Published records →</Link>
          <Link href="/documents/files" className="text-xs text-primary">Private documents →</Link>
          <Link href="/account/security" className="text-xs text-primary">
            Account & sign out
          </Link>
          <button onClick={() => onInspect("Support Desk")}>
            <FigmaAsset group="sidebar" name="imgContainer12" />
            Support Desk<span>v2.4</span>
          </button>
          <div className="online-label">
            <i />
            {cloud ? "School workspace" : "Saved on this device"}
          </div>
        </footer>
      </aside>
      <div className="school-main">
        <header className="school-topbar">
          <button
            className="mobile-nav-toggle"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="school-search">
            <FigmaAsset group="header" name="imgIcon" />
            <Input
              aria-label="Search students, GRN, parents, receipts"
              placeholder="Search students, GRN, parents, receipts..."
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
          <div className="school-topbar-actions">
            <label className="year-select">
              <FigmaAsset group="header" name="imgContainer" />
              <select
                aria-label="Academic year"
                value={selectedYearId ?? "current"}
                onChange={(e) => onYearChange?.(e.target.value)}
              >
                {years?.length ? (
                  years.map((year) => (
                    <option key={year.id} value={year.id}>
                      AY {year.name}
                    </option>
                  ))
                ) : (
                  <option value="current">{academicYearName}</option>
                )}
              </select>
              <FigmaAsset group="header" name="imgContainer1" />
            </label>
            <button
              className="notification-button"
              aria-label="View notifications"
              onClick={() => onInspect("Notifications")}
            >
              <FigmaAsset group="header" name="imgContainer2" />
              {unreadCount > 0 && <i aria-hidden="true" />}
            </button>
            <span className="topbar-divider" />
            <button
              className="school-user"
              onClick={() => onInspect("Principal profile")}
            >
              <img
                src={figmaAssets.header.imgDrRajivSharma.src}
                alt=""
                width={36}
                height={36}
              />
              <span>
                <strong>{identity?.name ?? principal.displayName}</strong>
                <small>{identity?.role ?? "Principal • Super Admin"}</small>
              </span>
              <FigmaAsset group="header" name="imgContainer3" />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
