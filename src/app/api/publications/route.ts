import {
  schoolContext,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import { listPublishedDocuments } from "@/features/reports/server/publication-register";
export async function GET(request: Request) {
  try {
    const { actor, root } = await schoolContext(),
      url = new URL(request.url);
    return privateJson(
      await listPublishedDocuments(actor, root, {
        yearId: url.searchParams.get("year"),
        offset: Number(url.searchParams.get("offset") ?? 0),
        search: url.searchParams.get("search") ?? "",
      }),
    );
  } catch (error) {
    return apiFailure(error);
  }
}
