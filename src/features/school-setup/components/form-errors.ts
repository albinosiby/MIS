import { ZodError } from "zod";
export function readableError(error: unknown) {
  return error instanceof ZodError
    ? error.issues
        .map((i) => `${i.path.join(" › ")}: ${i.message}`)
        .slice(0, 8)
        .join("\n")
    : error instanceof Error
      ? error.message
      : "Unable to save changes.";
}
