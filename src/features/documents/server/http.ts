import "server-only";
import { currentIdentity } from "../../identity/server/session";
import { readCloudCanonical } from "../../cloud/server/repository";
import { isSchoolRole } from "../../identity/domain/permissions";
export async function documentContext() {
  if (process.env.MIS_BACKEND !== "supabase") throw new Error("Private file storage requires the connected database.");
  const actor = await currentIdentity();
  if (!actor || !isSchoolRole(actor.role)) return null;
  return { actor, root: await readCloudCanonical(actor) };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    // Next's internal request URL can use localhost behind a local/reverse proxy.
    // Compare the browser Origin with the actual HTTP Host; never trust forwarded hosts.
    return ["http:", "https:"].includes(parsed.protocol) && origin === parsed.origin && parsed.host === host;
  } catch { return false; }
}
export function fileError() { return Response.json({ error: "This file action is unavailable. Check permissions, file format and size, then refresh and retry." }, { status: 403, headers: { "Cache-Control": "private, no-store" } }); }
/** Bound the actual stream, not just a client-supplied Content-Length header. */
export async function boundedFormData(request: Request) {
  const max = 5_100_000;
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new Error("Multipart form required.");
  if (Number(request.headers.get("content-length") ?? 0) > max) throw new Error("Upload too large.");
  const body = await boundedRequestBytes(request, max);
  return new Response(body, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
}

export async function boundedRequestBytes(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body required.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new Error("Request too large."); } chunks.push(value); }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}
