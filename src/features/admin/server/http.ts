import "server-only";
import { z } from "zod";
import { privateJson } from "@/shared/server/request";
import { cloudFailure } from "../../cloud/domain/action-result";
export function platformFailure(error: unknown) {
  return privateJson(
    { error: cloudFailure(error).error },
    error instanceof z.ZodError
      ? 400
      : error instanceof Error &&
          error.message === "Data changed. Refresh and retry."
        ? 409
        : 403,
  );
}
