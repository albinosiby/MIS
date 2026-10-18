"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  DataForm,
  studentOptions,
  enumOptions,
} from "../../workspace/components/workspace-ui";
import { saveGuardianLink } from "../domain/guardian-links";
export function GuardianLinks({
  guardianId,
  onClose,
}: {
  guardianId: string;
  onClose: () => void;
}) {
  const { year, mutate } = useWorkspace();
  const [studentId, setStudentId] = useState(
    year.setup.relationships.find((r) => r.guardianId === guardianId)
      ?.studentId ??
      year.setup.students[0]?.id ??
      "",
  );
  const initial = year.setup.relationships.find(
    (r) => r.guardianId === guardianId && r.studentId === studentId,
  ) ?? {
    schoolId: year.setup.school.id,
    studentId,
    guardianId,
    relationship: "guardian",
    canViewRecords: true,
    canReceiveNotices: true,
  };
  return (
    <Dialog title="Manage guardian links" onClose={onClose}>
      <p>
        Choose an existing student to add or update this guardian’s relationship
        and permissions.
      </p>
      <label htmlFor="guardian-link-student">Student</label>
      <Select
        id="guardian-link-student"
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
      >
        {studentOptions(year).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <DataForm
        key={studentId}
        initial={{ ...initial, academicYearId: year.setup.calendar.year.id }}
        fields={[
          {
            name: "relationship",
            label: "Relationship",
            type: "select",
            options: enumOptions(["parent", "guardian", "other"]),
          },
          {
            name: "canViewRecords",
            label: "Can view student records ",
            type: "checkbox",
          },
          {
            name: "canReceiveNotices",
            label: "Can receive notices ",
            type: "checkbox",
          },
        ]}
        onSave={async (value) => {
          await mutate(
            (y) => saveGuardianLink(y, value),
            "Updated guardian relationship and notice preferences",
          );
        }}
      />
    </Dialog>
  );
}
