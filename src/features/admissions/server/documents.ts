import "server-only";
import type { Workspace } from "../../workspace/models";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function assertAdmissionDocuments(
  previous: Workspace,
  next: Workspace,
  schoolId: string,
) {
  for (const year of next.years) {
    if (!year.records.admissionForms[0]?.requireDocuments) continue;
    const original = previous.years.find(
      (y) => y.setup.calendar.year.id === year.setup.calendar.year.id,
    );
    for (const application of year.records.inquiries.filter(
      (inquiry) =>
        inquiry.stage === "enrolled" &&
        !original?.records.inquiries.some(
          (saved) => saved.id === inquiry.id && saved.stage === "enrolled",
        ),
    )) {
      const { data, error } = await createSupabaseAdminClient()
        .from("mis_documents")
        .select("id")
        .eq("school_id", schoolId)
        .eq("academic_year_id", year.setup.calendar.year.id)
        .eq("owner_type", "admission")
        .eq("owner_id", application.id)
        .eq("status", "ready")
        .limit(1);
      if (error)
        throw new Error("Required application files could not be verified.");
      if (!data?.length)
        throw new Error(
          "Upload the required private application files before enrolment. A document checklist is not an uploaded file.",
        );
    }
  }
}
