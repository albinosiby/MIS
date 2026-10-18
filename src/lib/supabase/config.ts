import { z } from "zod";

/** Public connection settings only. Management tokens never belong in the app. */
export const supabaseConfigSchema = z.strictObject({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  }, "Use the HTTPS Supabase project origin without a path or credentials."),
  publishableKey: z
    .string()
    .regex(
      /^sb_publishable_[A-Za-z0-9_-]+$/,
      "Use a Supabase publishable key, never a secret or service-role key.",
    ),
});
export type SupabaseConfig = z.infer<typeof supabaseConfigSchema>;

export function parseSupabaseConfig(input: unknown): SupabaseConfig {
  const result = supabaseConfigSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      "Supabase public connection settings are missing or invalid. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  return { ...result.data, url: new URL(result.data.url).origin };
}
export function getSupabaseConfig(): SupabaseConfig {
  return parseSupabaseConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
