import { platformFailure } from "@/features/admin/server/http";
import { jsonBody, privateJson } from "@/shared/server/request";
import {
  platformCommand,
  platformList,
  inspectInstitution,
  institutionFiles,
  platformTicket,
  pendingProvisioning,
} from "@/features/admin/server/repository";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams,
      view = q.get("view") || "overview";
    if (view === "pending")
      return privateJson(await pendingProvisioning(Object.fromEntries(q)));
    if (view === "inspect")
      return privateJson(await inspectInstitution(q.get("schoolId"), q));
    if (view === "files")
      return privateJson(await institutionFiles(q.get("schoolId"), q));
    if (view === "ticket")
      return privateJson(await platformTicket(q.get("ticketId")));
    return privateJson(
      await platformList(
        view,
        Object.fromEntries(q),
        q.get("schoolId") || undefined,
      ),
    );
  } catch (e) {
    return platformFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    return privateJson(await platformCommand(await jsonBody(request, 50000)));
  } catch (e) {
    return platformFailure(e);
  }
}
