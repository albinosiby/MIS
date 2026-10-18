import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { parseCsv } from "../../../shared/data/csv.ts";
import { scope, csvExport } from "../../workspace/domain/operations.ts";
import { saveMarks } from "./exam-workflow.ts";
export function marksTemplate(y: SchoolYearWorkspace, examId: string) {
  const exam = y.records.exams.find((e) => e.id === examId);
  if (!exam) throw new Error("Choose an exam cycle.");
  return csvExport(
    y.setup.students
      .filter((s) => exam.classSectionIds.includes(s.classSectionId))
      .flatMap((s) =>
        exam.subjectIds.map((subjectId) => ({
          admissionNumber: s.admissionNumber,
          subjectCode: y.records.subjects.find((v) => v.id === subjectId)!.code,
          marks:
            y.records.marks.find(
              (m) =>
                m.examId === examId &&
                m.studentId === s.id &&
                m.subjectId === subjectId,
            )?.marks ?? "",
        })),
      ),
  );
}
export function importMarksCsv(
  y: SchoolYearWorkspace,
  examId: string,
  input: unknown,
) {
  const text = z.string().min(1).max(1_000_000).parse(input),
    rows = parseCsv(text, 20000),
    [header, ...data] = rows;
  if (header?.join(",") !== "admissionNumber,subjectCode,marks")
    throw new Error(
      "Use the admissionNumber,subjectCode,marks template columns.",
    );
  if (!data.length || data.length > 20000)
    throw new Error("Import between 1 and 20,000 mark rows.");
  let next = structuredClone(y);
  const seen = new Set<string>();
  let imported = 0;
  const groups = new Map<
    string,
    {
      classSectionId: string;
      subjectId: string;
      entries: { studentId: string; marks: number }[];
    }
  >();
  for (const [index, row] of data.entries()) {
    if (row.length !== 3)
      throw new Error(`CSV row ${index + 2} must contain three columns.`);
    const [admissionNumber, subjectCode, raw] = row.map((v) => v.trim());
    if (raw === "") continue;
    const student = y.setup.students.find(
        (s) => s.admissionNumber === admissionNumber,
      ),
      subject = y.records.subjects.find((s) => s.code === subjectCode);
    if (!student || !subject)
      throw new Error(
        `CSV row ${index + 2} has an unknown student or subject.`,
      );
    const key = student.id + ":" + subject.id;
    if (seen.has(key))
      throw new Error(`CSV row ${index + 2} repeats student/subject marks.`);
    seen.add(key);
    if (!/^\d+(?:\.\d+)?$/.test(raw))
      throw new Error(`CSV row ${index + 2} requires numeric marks.`);
    const groupKey = student.classSectionId + ":" + subject.id;
    const group = groups.get(groupKey) ?? {
      classSectionId: student.classSectionId,
      subjectId: subject.id,
      entries: [],
    };
    group.entries.push({ studentId: student.id, marks: Number(raw) });
    groups.set(groupKey, group);
    imported++;
  }
  if (!imported)
    throw new Error(
      "Enter at least one mark in the template. Blank marks are left unchanged.",
    );
  for (const group of groups.values())
    next = saveMarks(next, { ...scope(y), examId, ...group });
  return next;
}
