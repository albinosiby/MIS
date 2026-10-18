import { z } from "zod";

// IDs remain provider-neutral until persistence is selected. They are not permissions.
export const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Invalid identifier");
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(160);
export const localDateSchema = z.iso.date();
export const countSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const percentageSchema = z.number().min(0).max(100);
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a three-letter currency code");
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid timezone");
export const localeSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine((value) => {
    try {
      return Intl.getCanonicalLocales(value).length === 1;
    } catch {
      return false;
    }
  }, "Use a valid language tag");
export const emailSchema = z.email().max(254);
export const phoneSchema = z.e164();
export const nonnegativeMoneySchema = z.strictObject({
  amountMinor: countSchema,
  currency: currencyCodeSchema,
});
