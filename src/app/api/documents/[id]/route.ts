import { z } from "zod";
import { documentContext, sameOrigin, fileError, boundedRequestBytes } from "@/features/documents/server/http";
import { downloadPrivateDocument, changePrivateDocument } from "@/features/documents/server/repository";
import { documentMutationSchema } from "@/features/documents/schemas/private-document.schema";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const ctx = await documentContext(); if (!ctx) return Response.json({ error: "Sign in required." }, { status: 401 });
    const id = z.uuid().parse((await params).id);
    const { document: d, bytes } = await downloadPrivateDocument(ctx.actor, ctx.root, id);
    return new Response(bytes, { headers: { "Content-Type": d.mime_type, "Content-Disposition": `attachment; filename="document.${d.mime_type === "application/pdf" ? "pdf" : d.mime_type === "image/png" ? "png" : "jpg"}"; filename*=UTF-8''${encodeURIComponent(d.filename)}`, "Content-Length": String(bytes.length), "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
  } catch { return fileError(); }
}
export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return fileError();
  try {
    const ctx = await documentContext(); if (!ctx) return Response.json({ error: "Sign in required." }, { status: 401 });
    const id = z.uuid().parse((await params).id);
    const text = new TextDecoder().decode(await boundedRequestBytes(request, 100));
    const input = documentMutationSchema.parse(JSON.parse(text));
    return Response.json({ file: await changePrivateDocument(ctx.actor, ctx.root, id, input.action) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return fileError(); }
}
