import { parseSupabaseConfig } from "../supabase/config.ts";
/** Deployment checks validate configuration shape; only live requests establish credential validity. */
export function validateDeploymentEnvironment(
  env: Record<string, string | undefined>,
  service: "web" | "worker",
) {
  if (env.MIS_BACKEND !== "supabase")
    throw new Error(
      "Set MIS_BACKEND=supabase for Railway; local storage is not a hosted database.",
    );
  parseSupabaseConfig({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  const key = env.SUPABASE_SERVER_SECRET_KEY ?? "";
  let legacyServiceRole = false;
  try {
    legacyServiceRole =
      JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString())
        .role === "service_role";
  } catch {}
  if (key.length < 32 || (!key.startsWith("sb_secret_") && !legacyServiceRole))
    throw new Error(
      "Set SUPABASE_SERVER_SECRET_KEY to the Supabase server secret or legacy service-role key, not a publishable key or management token.",
    );
  if (
    env.MIS_TEST_ACCOUNTS_ENABLED !== undefined &&
    !["true", "false"].includes(env.MIS_TEST_ACCOUNTS_ENABLED)
  )
    throw new Error("MIS_TEST_ACCOUNTS_ENABLED must be true or false.");
  if (service === "web") {
    let valid = false;
    try {
      const url = new URL(env.NEXT_PUBLIC_APP_URL ?? "");
      valid =
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === "/" &&
        !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    } catch {}
    if (!valid)
      throw new Error(
        "Set NEXT_PUBLIC_APP_URL to the public HTTPS Railway/custom-domain origin, without a path.",
      );
  }
}
