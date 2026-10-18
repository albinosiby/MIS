import { z } from "zod";
import {
  currencyCodeSchema,
  displayNameSchema,
  emailSchema,
  identifierSchema,
  localeSchema,
  phoneSchema,
  timezoneSchema,
} from "./primitives.ts";

export const schoolAddressSchema = z.strictObject({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  countryCode: z.string().regex(/^[A-Z]{2}$/, "Use a two-letter country code"),
});

export const schoolProfileSchema = z.strictObject({
  id: identifierSchema,
  name: displayNameSchema,
  shortName: z.string().trim().min(1).max(60),
  curriculum: z.string().trim().min(1).max(80),
  affiliationNumber: z.string().trim().min(1).max(80).optional(),
  address: schoolAddressSchema,
  email: emailSchema,
  phone: phoneSchema,
  timezone: timezoneSchema,
  locale: localeSchema,
  currency: currencyCodeSchema,
});
