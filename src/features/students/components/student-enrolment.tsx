"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  Panel,
  DataForm,
  classOptions,
  enumOptions,
  LinkButton,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { enrolStudentRequestSchema } from "../schemas/students.schema";
import { enrolStudent } from "../../workspace/domain/operations";
export function StudentEnrolment({ inquiryId }: { inquiryId?: string }) {
  const { year, mutate } = useWorkspace();
  const router = useRouter();
  const inquiry = year.records.inquiries.find((i) => i.id === inquiryId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Record<string, unknown>>({
    studentName: inquiry?.studentName ?? "",
    admissionNumber: `GRN-${Date.now()}`,
    dateOfBirth: "2015-05-12",
    gender: "Prefer not to say",
    classSectionId: inquiry?.classSectionId ?? year.setup.classes[0].id,
    address: "",
    guardianName: inquiry?.guardianName ?? "",
    email: inquiry?.email ?? "",
    phone: inquiry?.phone ?? "",
    existingGuardianId: null,
    emergencyName: inquiry?.guardianName ?? "",
    emergencyPhone: inquiry?.phone ?? "",
    routeId: null,
    documents: [],
    generateInvoice: true,
    inquiryId: inquiry?.id ?? null,
  });
  const steps = [
    "Student demographics",
    "Academic & wing allocation",
    "Guardians & emergency",
    "Documents & fees",
  ];
  const fields: FormField[][] = [
    [
      { name: "studentName", label: "Student full name", required: true },
      {
        name: "admissionNumber",
        label: "Admission / GRN number",
        required: true,
      },
      {
        name: "dateOfBirth",
        label: "Date of birth",
        type: "date",
        required: true,
      },
      {
        name: "gender",
        label: "Gender",
        type: "select",
        options: enumOptions(["Female", "Male", "Other", "Prefer not to say"]),
      },
      {
        name: "address",
        label: "Residential address",
        type: "textarea",
        required: true,
      },
    ],
    [
      {
        name: "classSectionId",
        label: "Class & section",
        type: "select",
        options: classOptions(year),
        required: true,
      },
      {
        name: "routeId",
        label: "Transport route (optional)",
        type: "select",
        options: year.records.routes.map((r) => ({
          value: r.id,
          label: r.name,
        })),
      },
    ],
    [
      {
        name: "existingGuardianId",
        label: "Link an existing guardian (optional)",
        type: "select",
        options: year.setup.guardians.map((g) => ({
          value: g.id,
          label: g.displayName,
        })),
      },
      { name: "guardianName", label: "Guardian full name" },
      { name: "email", label: "Guardian email" },
      { name: "phone", label: "Guardian phone (with country code)" },
      {
        name: "emergencyName",
        label: "Emergency contact name",
        required: true,
      },
      {
        name: "emergencyPhone",
        label: "Emergency contact phone",
        required: true,
      },
    ],
    [
      {
        name: "documents",
        label: "Optional document checklist (metadata)",
        type: "files",
      },
      {
        name: "generateInvoice",
        label: "Generate initial fee invoice from configured fee heads",
        type: "checkbox",
      },
    ],
  ];
  const checks = [
    enrolStudentRequestSchema
      .pick({
        studentName: true,
        admissionNumber: true,
        dateOfBirth: true,
        gender: true,
        address: true,
      })
      .strip(),
    enrolStudentRequestSchema
      .pick({ classSectionId: true, routeId: true })
      .strip(),
    enrolStudentRequestSchema
      .pick({
        guardianName: true,
        email: true,
        phone: true,
        emergencyName: true,
        emergencyPhone: true,
        existingGuardianId: true,
      })
      .strip(),
    enrolStudentRequestSchema,
  ];
  return (
    <>
      <nav className="ws-tabs" aria-label="Enrolment steps">
        {steps.map((label, i) => (
          <span className={i === step ? "ws-badge" : "ws-hint"} key={label}>
            {i + 1}. {label}
          </span>
        ))}
      </nav>
      {step === 3 && inquiry && (
        <div className="op-notice">
          Required application files must be uploaded and ready in private
          storage before enrolment.{" "}
          <LinkButton
            href={`/documents/files?owner=${encodeURIComponent(`admission:${inquiry.id}`)}`}
          >
            Manage application files
          </LinkButton>
        </div>
      )}
      <Panel title={`Step ${step + 1} of 4 · ${steps[step]}`}>
        <DataForm
          key={step}
          initial={draft}
          fields={fields[step]}
          submitLabel={
            step === 3 ? "Complete & issue enrolment" : "Save & continue →"
          }
          onSave={async (value) => {
            if (!value || typeof value !== "object")
              throw new Error("Invalid enrolment form");
            let next = { ...draft, ...value };
            if (step === 2 && typeof next.existingGuardianId === "string") {
              const guardian = year.setup.guardians.find(
                (g) => g.id === next.existingGuardianId,
              );
              if (guardian)
                next = {
                  ...next,
                  guardianName: guardian.displayName,
                  email: guardian.email,
                  phone: guardian.phone,
                };
            }
            checks[step].parse(next);
            setDraft(next);
            if (step < 3) {
              setStep(step + 1);
              return;
            }
            await mutate(
              (current) => enrolStudent(current, next),
              "Enrolled student and linked guardian",
              { type: "student-enrol", input: next },
            );
            router.push("/students");
          }}
        />
      </Panel>
      <div className="ws-actions">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          ← Previous step
        </Button>
        <LinkButton href="/students">Cancel enrolment</LinkButton>
      </div>
    </>
  );
}
