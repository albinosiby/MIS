"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useSetupWorkspace } from "../hooks/setup-workspace-provider";
import { importStudents, studentCsvHeader } from "../domain/import-students";
import { reviewException } from "../domain/review-exception";
import type { SetupConfig } from "../models";
import { readableError } from "./form-errors";

export function downloadFile(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function IngestionEditor() {
  const { config, commit, busy, inactiveStudentIds } = useSetupWorkspace();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<SetupConfig | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(config.exceptions[0]?.id ?? "");
  const [note, setNote] = useState("");
  return (
    <div className="config-ingestion">
      <h2>Import student records</h2>
      <p>
        Append up to 500 students per CSV. The entire file is validated before
        saving; existing admission numbers cannot be imported twice.
      </p>
      <div className="config-toolbar">
        <Button
          variant="outline"
          onClick={() =>
            downloadFile(
              "students-template.csv",
              `${studentCsvHeader}\nNEW-1001,Sample New Student,${config.classes[0].id},Sample Guardian,guardian.new@school.example,+919876543210\n`,
              "text/csv",
            )
          }
        >
          Download CSV template
        </Button>
        <Button asChild variant="outline">
          <Link href="/students">View {config.students.length} students</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/staff">View staff directory</Link>
        </Button>
      </div>
      <label htmlFor="csv-file">Upload CSV (up to 1 MB)</label>
      <Input
        id="csv-file"
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 1_000_000) {
            setError("CSV must be smaller than 1 MB.");
            return;
          }
          try {
            setCsv(await file.text());
            setPreview(null);
            setError("");
          } catch {
            setError("Could not read this CSV file.");
          }
        }}
      />
      <label htmlFor="csv-text">Or paste CSV content</label>
      <textarea
        id="csv-text"
        rows={5}
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setPreview(null);
          setError("");
        }}
        placeholder={studentCsvHeader}
      />
      <Button
        variant="outline"
        onClick={() => {
          try {
            setPreview(importStudents(config, csv, inactiveStudentIds));
            setError("");
          } catch (e) {
            setPreview(null);
            setError(readableError(e));
          }
        }}
      >
        Validate & preview CSV
      </Button>
      {preview && (
        <div className="config-import-preview">
          <h3>
            {preview.students.length - config.students.length} valid students
            ready to import
          </h3>
          <ul>
            {preview.students
              .slice(config.students.length, config.students.length + 5)
              .map((s) => (
                <li key={s.id}>
                  {s.admissionNumber} · {s.displayName}
                </li>
              ))}
          </ul>
          <Button
            disabled={busy}
            onClick={async () => {
              try {
                await commit(
                  (current) => importStudents(current, csv, inactiveStudentIds),
                  "Imported validated student CSV",
                );
                setPreview(null);
                setCsv("");
              } catch (e) {
                setError(readableError(e));
              }
            }}
          >
            Confirm import
          </Button>
        </div>
      )}
      <h2>Resolve ingestion exceptions</h2>
      <p>
        {config.exceptions.length} unresolved · {config.reviews.length}{" "}
        reviewed. A review records a administrative decision; it does
        not verify identity.
      </p>
      {config.exceptions.length ? (
        <>
          <label htmlFor="review-target">Exception</label>
          <Select
            id="review-target"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setNote("");
            }}
          >
            {config.exceptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.status}
              </option>
            ))}
          </Select>
          <p className="review-discrepancy">
            {config.exceptions.find((r) => r.id === selected)?.discrepancy}
          </p>
          <label htmlFor="ingestion-review-note">
            Review note (8–500 characters)
          </label>
          <textarea
            id="ingestion-review-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              try {
                await commit((current) => {
                  const result = reviewException(
                    current.exceptions,
                    {
                      schoolId: current.school.id,
                      academicYearId: current.calendar.year.id,
                      exceptionId: selected,
                      note,
                    },
                    {
                      schoolId: current.school.id,
                      academicYearId: current.calendar.year.id,
                    },
                  );
                  if (!result.success)
                    throw new Error(
                      result.issues[0]?.message ?? "Review failed",
                    );
                  return {
                    ...current,
                    exceptions: result.records,
                    reviews: [...current.reviews, result.review],
                  };
                }, `Reviewed ingestion exception ${selected}`);
              } catch (e) {
                setError(readableError(e));
              }
            }}
          >
            Save review & resolve exception
          </Button>
        </>
      ) : (
        <p className="config-success">
          All exceptions resolved. Save & continue to sign off ingestion.
        </p>
      )}
      {error && (
        <div className="config-errors" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
