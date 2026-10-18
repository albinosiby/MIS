"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { SchoolShell } from "@/components/layout/school-shell";
import { useSetupWorkspace } from "../hooks/setup-workspace-provider";
import { readableError } from "./form-errors";
import "../styles/setup-wizard.css";
import "../styles/setup-config.css";

/** Setup roster projection, not the complete Student/HR module. Reads the same saved domain records. */
export function SetupRecordDirectory({ kind }: { kind: "students" | "staff" }) {
  const { config, commit, busy } = useSetupWorkspace();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const rows = (kind === "students" ? config.students : config.staff).filter(
    (r) =>
      `${r.displayName} ${r.id} ${"admissionNumber" in r ? r.admissionNumber : r.designation}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pages);
  const student = config.students.find((s) => s.id === editing);
  const member = config.staff.find((s) => s.id === editing);
  const guardian = config.guardians.find(
    (g) =>
      g.id ===
      config.relationships.find((link) => link.studentId === student?.id)
        ?.guardianId,
  );
  return (
    <SchoolShell
      school={config.school}
      logo={config.branding.logo}
      principal={config.staff[0]}
      academicYearName={config.calendar.year.name}
      search={search}
      onSearch={(value) => {
        setSearch(value.slice(0, 200));
        setPage(1);
      }}
      onInspect={setInfo}
    >
      <main className="setup-content">
        <section className="setup-panel directory-panel">
          <header>
            <div>
              <h1>
                {kind === "students" ? "Students & Guardians" : "Staff & HR"} ·
                Setup roster
              </h1>
              <p>
                {rows.length} matching records · {config.calendar.year.name} ·
                Persistent </p>
            </div>
            <div className="config-toolbar">
              <Button asChild variant="outline">
                <Link href="/school-setup">← Setup overview</Link>
              </Button>
              <Button asChild>
                <Link
                  href={`/school-setup/${kind === "students" ? "data-ingestion" : "staff-allocations"}`}
                >
                  {kind === "students"
                    ? "Import students"
                    : "Manage staff & allocations"}
                </Link>
              </Button>
            </div>
          </header>
          <div className="directory-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {kind === "students"
                      ? "Student name & identity"
                      : "Staff member & ID"}
                  </th>
                  <th>
                    {kind === "students"
                      ? "Class & section"
                      : "Role & designation"}
                  </th>
                  <th>
                    {kind === "students" ? "Primary guardian" : "Allocations"}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map((row) => {
                    const isStudent = "admissionNumber" in row;
                    const section = isStudent
                      ? config.classes.find((c) => c.id === row.classSectionId)
                      : null;
                    const linkedGuardian = isStudent
                      ? config.guardians.find(
                          (g) =>
                            g.id ===
                            config.relationships.find(
                              (l) => l.studentId === row.id,
                            )?.guardianId,
                        )
                      : null;
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.displayName}</strong>
                          <br />
                          <small>
                            {isStudent ? row.admissionNumber : row.id}
                          </small>
                        </td>
                        <td>
                          {isStudent
                            ? `${section?.grade} – ${section?.section}`
                            : row.designation}
                        </td>
                        <td>
                          {isStudent
                            ? (linkedGuardian?.displayName ??
                              "No guardian linked")
                            : config.allocations.filter(
                                (a) => a.staffId === row.id,
                              ).length}
                        </td>
                        <td>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditing(row.id);
                              setError("");
                            }}
                          >
                            View / edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {!rows.length && (
              <p className="config-empty">
                No matching records. Try another name or admission number.
              </p>
            )}
          </div>
          <footer className="config-actions">
            <span>
              Page {currentPage} of {pages}
            </span>
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </footer>
        </section>
      </main>
      {editing && (student || member) && (
        <Dialog
          title={student ? "Student & guardian details" : "Staff details"}
          onClose={() => setEditing(null)}
        >
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await commit(
                  (current) => {
                    if (student) {
                      current.students = current.students.map((s) =>
                        s.id === editing
                          ? {
                              ...s,
                              displayName: String(form.get("name")),
                              classSectionId: String(form.get("section")),
                            }
                          : s,
                      );
                      if (guardian)
                        current.guardians = current.guardians.map((g) =>
                          g.id === guardian.id
                            ? {
                                ...g,
                                displayName: String(form.get("guardian")),
                                email: String(form.get("email")),
                                phone: String(form.get("phone")),
                              }
                            : g,
                        );
                      current.completed = current.completed.slice(0, 6);
                    } else {
                      current.staff = current.staff.map((s) =>
                        s.id === editing
                          ? {
                              ...s,
                              displayName: String(form.get("name")),
                              designation: String(form.get("designation")),
                            }
                          : s,
                      );
                      current.completed = current.completed.slice(0, 5);
                    }
                    current.portal.invitationsPrepared = false;
                    return current;
                  },
                  `Updated ${student ? "student" : "staff"} ${editing}`,
                );
                setEditing(null);
              } catch (e) {
                setError(readableError(e));
              }
            }}
          >
            <label htmlFor="record-name">Full name</label>
            <Input
              id="record-name"
              name="name"
              defaultValue={student?.displayName ?? member?.displayName}
            />
            {student ? (
              <>
                <label htmlFor="record-section">Class & section</label>
                <Select
                  id="record-section"
                  name="section"
                  defaultValue={student.classSectionId}
                >
                  {config.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} – {c.section}
                    </option>
                  ))}
                </Select>
                {guardian && (
                  <>
                    <label htmlFor="record-guardian">Guardian name</label>
                    <Input
                      id="record-guardian"
                      name="guardian"
                      defaultValue={guardian.displayName}
                    />
                    <label htmlFor="record-email">Guardian email</label>
                    <Input
                      id="record-email"
                      name="email"
                      defaultValue={guardian.email}
                    />
                    <label htmlFor="record-phone">Guardian phone</label>
                    <Input
                      id="record-phone"
                      name="phone"
                      defaultValue={guardian.phone}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <label htmlFor="record-role">Designation</label>
                <Input
                  id="record-role"
                  name="designation"
                  defaultValue={member?.designation}
                />
              </>
            )}
            <p className="dialog-hint">
              Saving record changes requires the relevant setup steps to be
              signed off again.
            </p>
            {error && (
              <p className="config-errors" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save record"}
            </Button>
          </form>
        </Dialog>
      )}
      {info && (
        <Dialog title={info} onClose={() => setInfo("")}>
          <p>
            This module is scheduled after the setup milestone. Student and
            staff setup records are connected now.
          </p>
        </Dialog>
      )}
    </SchoolShell>
  );
}
