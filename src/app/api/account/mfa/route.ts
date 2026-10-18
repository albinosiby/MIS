import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentCloudIdentity } from "@/features/cloud/server/identity";
import { mfaRequestSchema } from "@/features/identity/schemas/mfa.schema";
import { apiFailure, jsonBody, privateJson } from "@/shared/server/request";
async function context() {
  if (
    process.env.MIS_BACKEND !== "supabase" ||
    !(await currentCloudIdentity({ allowMfaChallenge: true }))
  )
    throw new Error("Sign in required.");
  return createSupabaseServerClient();
}
export async function GET() {
  try {
    const client = await context(),
      { data: factors, error } = await client.auth.mfa.listFactors(),
      { data: level, error: levelError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || levelError) throw new Error("MFA unavailable.");
    return privateJson({
      factors: factors.all
        .filter((f) => f.factor_type === "totp")
        .map((f) => ({
          id: f.id,
          friendlyName: f.friendly_name ?? "Authenticator",
          status: f.status,
        })),
      currentLevel: level.currentLevel,
      nextLevel: level.nextLevel,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const client = await context(),
      input = mfaRequestSchema.parse(await jsonBody(request));
    const { data: factors, error } = await client.auth.mfa.listFactors();
    if (error) throw new Error("MFA unavailable.");
    if (input.action === "enroll") {
      if (factors.all.length >= 5)
        throw new Error("Remove an unused authenticator first.");
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: input.name,
      });
      if (error) throw new Error("Authenticator could not be prepared.");
      return privateJson(
        {
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        },
        201,
      );
    }
    if (
      !factors.all.some(
        (f) => f.id === input.factorId && f.factor_type === "totp",
      )
    )
      throw new Error("Authenticator unavailable.");
    if (input.action === "verify") {
      const { error } = await client.auth.mfa.challengeAndVerify({
        factorId: input.factorId,
        code: input.code,
      });
      if (error) throw new Error("Authenticator code was not accepted.");
      return privateJson({ ok: true });
    }
    const factor = factors.all.find((f) => f.id === input.factorId)!,
      { data: level, error: levelError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      levelError ||
      (factor.status === "verified" && level.currentLevel !== "aal2")
    )
      throw new Error(
        "Verify an authenticator before removing a verified factor.",
      );
    const { error: failure } = await client.auth.mfa.unenroll({
      factorId: input.factorId,
    });
    if (failure) throw new Error("Authenticator could not be removed.");
    return privateJson({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
