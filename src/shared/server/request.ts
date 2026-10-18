import "server-only";
import { z } from "zod";
import { currentIdentity } from "../../features/identity/server/session";
import { readCloudCanonical } from "../../features/cloud/server/repository";
import {
  sameOrigin,
  boundedRequestBytes,
} from "../../features/documents/server/http";
export { sameOrigin };
export async function schoolActor() {
  const actor = await currentIdentity();
  if (
    !actor ||
    process.env.MIS_BACKEND !== "supabase" ||
    ["platform", "group"].includes(actor.role)
  )
    throw new Error("An active school membership is required.");
  return actor;
}
export async function schoolContext() {
  const actor = await schoolActor();
  return { actor, root: await readCloudCanonical(actor) };
}
export async function jsonBody(
  request: Request,
  max = 20000,
): Promise<unknown> {
  if (
    !sameOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    throw new Error("Same-origin JSON required.");
  return JSON.parse(
    new TextDecoder().decode(await boundedRequestBytes(request, max)),
  );
}
export function apiFailure(error: unknown) {
  const conflict =
    error instanceof Error &&
    error.message === "Workspace changed. Reload before saving.";
  if (error instanceof z.ZodError)
    console.error(
      "API schema validation failed",
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      })),
    );
  return Response.json(
    {
      error: conflict
        ? "The school workspace changed. Refresh and retry."
        : error instanceof z.ZodError
          ? "Some fields are invalid. Review the form and retry."
          : "This action is unavailable. Check your current permissions, refresh and retry.",
    },
    {
      status: conflict ? 409 : error instanceof z.ZodError ? 400 : 403,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
