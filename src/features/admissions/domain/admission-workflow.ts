import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { inquirySchema } from "../schemas/admissions.schema.ts";
import { putRecord } from "../../workspace/domain/operations.ts";
import {
  emailSchema,
  phoneSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
/** Seeded core fields edit labels without requiring the same contact value twice. */
export function admissionCoreField(
  id: string,
): "studentName" | "email" | "phone" | undefined {
  const mapping: Record<string, "studentName" | "email" | "phone" | undefined> =
    {
      "field-student": "studentName",
      "field-email": "email",
      "field-phone": "phone",
    };
  return mapping[id];
}
export function submitInquiry(
  y: SchoolYearWorkspace,
  input: unknown,
  publicForm = false,
) {
  const record = inquirySchema.parse(input);
  if (publicForm) {
    const form = y.records.admissionForms[0];
    if (!form?.accepting)
      throw new Error("Admission intake is currently paused.");
    for (const field of form.fields) {
      const coreField = admissionCoreField(field.id);
      const value = coreField
        ? record[coreField]
        : (record.answers[field.id] ?? "");
      if (!value && !field.required) continue;
      if (!value) throw new Error(`${field.label} is required.`);
      if (field.type === "email") emailSchema.parse(value);
      if (field.type === "phone") phoneSchema.parse(value);
      if (field.type === "date") localDateSchema.parse(value);
      if (
        field.type === "select" &&
        !field.options
          .split(",")
          .map((v) => v.trim())
          .includes(value)
      )
        throw new Error(`Choose an available option for ${field.label}.`);
      z.string().max(1000).parse(value);
    }
    if (form.requireDocuments && !record.documents.length)
      throw new Error("Attach the required document metadata.");
    if (
      form.requireSibling &&
      !y.setup.students.some((s) => s.id === record.siblingStudentId)
    )
      throw new Error("Choose an existing sibling.");
    record.source = "Website";
  }
  return putRecord(y, "inquiries", record);
}
