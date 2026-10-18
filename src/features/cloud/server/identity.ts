import { mutationCapabilitySchema } from "../../identity/schemas/mutation-policy.schema";
import { cookies } from "next/headers";
import { membershipContextSchema } from "../../identity/schemas/membership-context.schema";
import { selectMembershipContext } from "../../identity/domain/membership-context";
import "server-only";
import { mayUseSyntheticIdentity } from "../../identity/domain/test-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accountIdentitySchema } from "../../identity/schemas/identity.schema";
export async function currentCloudIdentity(
  options: { allowMfaChallenge?: boolean; allowPasswordChange?: boolean } = {},
) {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (
    error ||
    !user ||
    !mayUseSyntheticIdentity(
      user.email ?? "",
      process.env.MIS_TEST_ACCOUNTS_ENABLED === "true",
    )
  )
    return null;
  const { data: claims } = await client.auth.getClaims();
  const sessionId = claims?.claims.session_id;
  if (typeof sessionId !== "string") return null;
  const { data: active, error: sessionError } =
    await createSupabaseAdminClient().rpc("mis_session_active", {
      p_user_id: user.id,
      p_session_id: sessionId,
    });
  if (sessionError || !active) return null;
  if (!options.allowMfaChallenge) {
    // getUser is an authenticated server response; getClaims verifies the JWT.
    // Do not trust the cookie-cached session.user factor list for enforcement.
    if (
      user.factors?.some((f) => f.status === "verified") &&
      claims?.claims.aal !== "aal2"
    )
      return null;
  }
  const admin = createSupabaseAdminClient();
  const { data: activation, error: activationError } = await admin
    .from("mis_account_activation")
    .select("must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    activationError ||
    (!options.allowPasswordChange && activation?.must_change_password)
  )
    return null;
  const { data: operator, error: operatorError } = await admin
    .from("mis_platform_operators")
    .select("display_name,active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (operatorError) return null;
  if (operator?.active)
    return accountIdentitySchema.parse({
      id: user.id,
      email: user.email,
      name: operator.display_name,
      role: "platform",
      schoolId: "platform",
      personId: null,
    });
  const { data, error: memberError } = await admin
    .from("mis_effective_memberships")
    .select(
      "membership_id,user_id,school_id,role,person_id,display_name,active",
    )
    .eq("user_id", user.id)
    .eq("active", true);
  if (memberError || !data) return null;
  const { data: institutions, error: institutionError } = await admin
    .from("mis_institution_registry")
    .select("school_id,status")
    .in("school_id", [...new Set(data.map((m) => m.school_id))]);
  if (institutionError) return null;
  const activeSchools = new Set(
    (institutions ?? [])
      .filter((i) => i.status === "active")
      .map((i) => i.school_id),
  );
  const m = selectMembershipContext(
    membershipContextSchema
      .array()
      .parse(
        data.filter(
          (m) =>
            activeSchools.has(m.school_id) &&
            !["platform", "group"].includes(m.role),
        ),
      ),
    user.id,
    (await cookies()).get("mis-school-context")?.value ?? null,
  );
  if (!m) return null;
  const { data: policy, error: policyError } = await createSupabaseAdminClient()
    .from("mis_role_restrictions")
    .select("blocked")
    .eq("school_id", m.school_id)
    .eq("role", m.role)
    .maybeSingle();
  if (policyError) return null;
  const blocked = mutationCapabilitySchema.array().parse(policy?.blocked ?? []);
  return accountIdentitySchema.parse({
    id: user.id,
    email: user.email,
    name: m.display_name,
    role: m.role,
    schoolId: m.school_id,
    personId: m.person_id,
    blockedMutations: blocked,
  });
}
