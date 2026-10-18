import { platformDownload } from "@/features/admin/server/repository";
import { apiFailure } from "@/shared/server/request";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { id, fileId } = await params;
    return await platformDownload(id, fileId);
  } catch (e) {
    return apiFailure(e);
  }
}
