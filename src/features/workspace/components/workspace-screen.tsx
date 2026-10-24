"use client";
import { useIdentity } from "../../identity/components/identity-context";
import { OperationsShell } from "../../operations/components/operations-shell";
import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import { useBackend } from "../../identity/components/identity-context";
import { lazy, Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { SchoolShell } from "@/components/layout/school-shell";
import { useWorkspace } from "../hooks/workspace-provider";
import { getScreen, titleRoutes } from "../data/screen-catalog";
import { Badge, LinkButton } from "./workspace-ui";
import { FirstRowHeader, firstRowPages } from "./first-row-header";
import "../../school-setup/styles/setup-wizard.css";
import "../../school-setup/styles/setup-config.css";
import "../styles/workspace.css";
const Admissions = lazy(
  () => import("../../admissions/components/admissions-screens"),
);
const Students = lazy(
  () => import("../../students/components/students-screens"),
);
const Staff = lazy(() => import("../../staff/components/staff-screens"));
const Attendance = lazy(
  () => import("../../attendance/components/attendance-screens"),
);
const Timetable = lazy(
  () => import("../../timetable/components/timetable-screens"),
);
const Academics = lazy(
  () => import("../../academics/components/academics-screens"),
);
const Exams = lazy(() => import("../../exams/components/exams-screens"));
const Fees = lazy(() => import("../../fees/components/fees-screens"));
const Communication = lazy(
  () => import("../../communication/components/communication-screens"),
);
const Settings = lazy(
  () => import("../../settings/components/settings-screens"),
);
const Dashboard = lazy(() => import("./dashboard-screens"));
export type WorkspaceScreenProps = {
  route: string;
  query: Record<string, string | undefined>;
  search: string;
};
function RoleAwareShell(props: ComponentProps<typeof SchoolShell>) {
  const actor = useIdentity();
  const route = usePathname();
  return actor && !["admin", "principal"].includes(actor.role) ? (
    <OperationsShell actor={actor} route={route}>
      {props.children}
    </OperationsShell>
  ) : (
    <SchoolShell {...props} />
  );
}
export function WorkspaceScreen({
  route,
  query = {},
}: {
  route: string;
  query?: Record<string, string | undefined>;
}) {
  const cloud = useBackend() === "supabase";
  const { year, root, switchYear, error, busy } = useWorkspace();
  const router = useRouter();
  const [search, setSearch] = useState(query.q ?? "");
  const screen = getScreen(route)!;
  const [feedback, setFeedback] = useState("");
  const components = {
    dashboard: Dashboard,
    admissions: Admissions,
    students: Students,
    staff: Staff,
    attendance: Attendance,
    timetable: Timetable,
    academics: Academics,
    exams: Exams,
    fees: Fees,
    communication: Communication,
    settings: Settings,
  };
  const Content = components[screen[2]];
  const firstRowRoute = Object.hasOwn(firstRowPages, route)
    ? (route as keyof typeof firstRowPages)
    : null;
  const descriptions: Record<string, string> = {
    dashboard: "Campus operations, approvals and the institutional calendar.",
    admissions:
      "Track prospective candidates from enquiry intake to seat allotment and enrolment.",
    students:
      "Master student roster, guardian links, documents and cohort lifecycles.",
    staff:
      "Faculty roster, role permissions, documentation and teaching allocations.",
    attendance:
      "Daily registers, period attendance, leave decisions and coverage.",
    timetable:
      "Class schedules, teacher availability and room conflict checks.",
    academics:
      "Curriculum progress, lesson plans, homework and student submissions.",
    exams: "Exam cycles, paper schedules, marks and report cards.",
    fees: "Invoices, fee balances, collections and printable receipts.",
    communication:
      "School notices, delivery status, acknowledgments and standard reports.",
    settings:
      "Institutional configuration, academic years, preferences and governance.",
  };
  return (
    <RoleAwareShell
      unreadCount={year.records.notifications.filter((n) => !n.read).length}
      school={year.setup.school}
      logo={year.setup.branding.logo}
      principal={year.setup.staff[0]}
      academicYearName={`AY ${year.setup.calendar.year.name}`}
      search={search}
      onSearch={(v) => setSearch(v.slice(0, 200))}
      onInspect={(title) => {
        const path = titleRoutes[title];
        if (path) router.push(path);
        else setFeedback(title);
      }}
      years={root.years.map((y) => ({
        id: y.setup.calendar.year.id,
        name: y.setup.calendar.year.name,
      }))}
      selectedYearId={root.activeYearId}
      onYearChange={(id) =>
        void switchYear(id).catch((e) => setFeedback(e.message))
      }
    >
      <main
        id="main-content"
        className={`ws-content ws-${screen[2]} ${firstRowRoute ? "fr-page" : ""}`}
      >
        {firstRowRoute && <FirstRowHeader route={firstRowRoute} />}
        {!firstRowRoute &&
          !["/dashboard", "/admissions", "/timetable", "/settings"].includes(
            route,
          ) && (
            <header className="ws-page-header">
              <div>
                <h1>{screen[1]}</h1>
                <p>{descriptions[screen[2]]}</p>
              </div>
              <div className="ws-actions">
                <Badge tone="green">AY {year.setup.calendar.year.name}</Badge>
                <Badge>School workspace</Badge>
              </div>
            </header>
          )}
        {year.locked && (
          <p className="config-success" role="status">
            Archived academic year · Read-only historical records
          </p>
        )}
        {feedback && (
          <div role="status" className="config-success">
            {feedback}
          </div>
        )}
        {error && (
          <div className="config-errors" role="alert">
            {error.length > 500
              ? "The change did not pass validation. Review the form details."
              : error}
          </div>
        )}
        <Suspense
          fallback={
            <p role="status" className="ws-empty">
              Loading module…
            </p>
          }
        >
          <Content
            key={`${route}:${root.activeYearId}`}
            route={route}
            query={query}
            search={search}
          />
        </Suspense>
        <footer className="ws-module-footer">
          <span>
            {year.setup.school.shortName} · {year.setup.calendar.year.name} ·{" "}
            {busy ? "Saving…" : cloud ? "Changes saved" : "Saved locally"}
          </span>

          <LinkButton href="/school-setup">School setup</LinkButton>
        </footer>
      </main>
    </RoleAwareShell>
  );
}
