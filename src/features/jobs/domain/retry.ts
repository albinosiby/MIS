/** Stable bounded backoff; callers persist the resulting instant in the database. */
export function retryAt(now: Date, attempts: number) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10)
    throw new Error("Invalid attempt count.");
  return new Date(
    now.getTime() + Math.min(3600, 15 * 2 ** (attempts - 1)) * 1000,
  ).toISOString();
}
