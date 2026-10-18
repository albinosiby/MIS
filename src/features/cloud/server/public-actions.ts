"use server";
import {
  certificateReferenceSchema,
  certificateVerificationSchema,
} from "../../documents/schemas/certificate-verification.schema";
import { z } from "zod";
import { cloudFailure } from "../domain/action-result";
import { publicCloudCommandSchema } from "../schemas/cloud.schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { workspaceSchema } from "../../workspace/schemas/workspace.schema";
import { projectCloudPublicWorkspace } from "../domain/public-projection";
import { preparePublicInquiry } from "../domain/public-intake";
import { tenantRequestsRequestSchema } from "../../admin/schemas/operations.schema";
async function publicRoot() {
  if (process.env.MIS_BACKEND !== "supabase")
    throw new Error("Cloud intake is unavailable.");
  const schoolId = process.env.MIS_PUBLIC_SCHOOL_ID || "school-greenfield";
  const { data, error } = await createSupabaseAdminClient().rpc(
    "mis_read_workspace",
    { p_school_id: schoolId },
  );
  if (error) throw new Error("School information is temporarily unavailable.");
  const root = workspaceSchema.parse(data);
  if (root.years.some((y) => y.setup.school.id !== schoolId))
    throw new Error("School scope mismatch.");
  return root;
}
export async function loadCloudPublicWorkspace() {
  return projectCloudPublicWorkspace(await publicRoot());
}
export async function submitCloudPublicRequest(input: unknown) {
  try {
    const request = publicCloudCommandSchema.parse(input);
    const root = await publicRoot();
    const year = root.years.find(
      (y) => y.setup.calendar.year.id === root.activeYearId,
    )!;
    if (year.locked) throw new Error("Intake is closed for this year.");
    const scope = {
      id: crypto.randomUUID(),
      schoolId: year.setup.school.id,
      academicYearId: root.activeYearId,
    };
    let row;
    let kind;
    if (request.type === "public-inquiry") {
      row = preparePublicInquiry(year, request.input);
      kind = "inquiries";
    } else {
      const parsed = tenantRequestsRequestSchema.parse(request.input);
      row = tenantRequestsRequestSchema.parse({
        ...parsed,
        ...scope,
        kind: "tenant-requests",
        status: "requested",
        studentId: null,
        staffId: null,
        createdBy: "public-intake",
        history: [
          {
            at: new Date().toISOString(),
            actorId: "public-intake",
            action: "Public school request received",
          },
        ],
      });
      kind = "tenant-requests";
    }
    const { error } = await createSupabaseAdminClient().rpc(
      "mis_public_intake",
      {
        p_school_id: scope.schoolId,
        p_expected_revision: root.revision,
        p_year_id: scope.academicYearId,
        p_kind: kind,
        p_record: row,
      },
    );
    if (error)
      throw new Error("The request could not be saved. Reload and try again.");
    return {
      ok: true as const,
      data: projectCloudPublicWorkspace(await publicRoot()),
    };
  } catch (error) {
    return cloudFailure(error);
  }
}

export async function verifyCloudCertificate(input: unknown) {
  if (process.env.MIS_BACKEND !== "supabase")
    throw new Error("Cloud verification unavailable.");
  const reference = certificateReferenceSchema.parse(input),
    schoolId = process.env.MIS_PUBLIC_SCHOOL_ID || "school-greenfield";
  const { data, error } = await createSupabaseAdminClient().rpc(
    "mis_verify_certificate",
    { p_school: schoolId, p_reference: reference },
  );
  if (error) throw new Error("Certificate status unavailable.");
  return data === null ? null : certificateVerificationSchema.parse(data);
}
