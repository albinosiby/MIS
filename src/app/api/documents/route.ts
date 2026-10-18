import { documentCursorSchema } from "@/features/documents/schemas/private-document.schema";
import { identifierSchema } from "@/shared/schemas/primitives";
import {
  documentContext,
  sameOrigin,
  fileError,
  boundedFormData,
} from "@/features/documents/server/http";
import {
  listPrivateDocuments,
  uploadPrivateDocument,
} from "@/features/documents/server/repository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const ctx = await documentContext();
    if (!ctx)
      return Response.json({ error: "Sign in required." }, { status: 401 });
    const url = new URL(request.url);
    const yearId = identifierSchema.parse(url.searchParams.get("year"));
    const before = url.searchParams.get("before");
    if (before) documentCursorSchema.parse(JSON.parse(before));
    return Response.json(
      await listPrivateDocuments(
        ctx.actor,
        ctx.root,
        yearId,
        before ?? undefined,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return fileError();
  }
}
export async function POST(request: Request) {
  let stage = "context";
  if (!sameOrigin(request)) return fileError();
  try {
    const ctx = await documentContext();
    if (!ctx)
      return Response.json({ error: "Sign in required." }, { status: 401 });
    stage = "multipart";
    const form = await boundedFormData(request);
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1)
      throw new Error("One file is required.");
    stage = "validated-file";
    const data = await uploadPrivateDocument(
      ctx.actor,
      ctx.root,
      {
        yearId: form.get("yearId"),
        ownerType: form.get("ownerType"),
        ownerId: form.get("ownerId"),
        category: form.get("category"),
        replacesId: form.get("replacesId") || null,
      },
      file,
    );
    return Response.json(
      { file: data },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Private document upload rejected", {
      stage,
      type: error instanceof Error ? error.name : typeof error,
    });
    return fileError();
  }
}
