import { ZodError } from "zod";
/** Expected validation/workflow failures cross the action boundary as data, without production error digests. */
export function cloudFailure(error: unknown) {
  const message =
    error instanceof ZodError
      ? error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(" › ")}: ${i.message}`)
          .join("\n")
      : error instanceof Error
        ? error.message
        : "The request could not be saved.";
  return { ok: false as const, error: message.slice(0, 1000) };
}
