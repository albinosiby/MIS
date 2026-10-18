import { mayUseSyntheticIdentity } from "../domain/test-access";
import "server-only";
import { currentCloudIdentity } from "../../cloud/server/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { localSessionSchema } from "../schemas/identity.schema";
import type { AccountIdentity } from "../models";
import { accountStore } from "../domain/account-store";
import { canAccess } from "../domain/access";
const COOKIE = "school-demo-session";
function secret() {
  const v = process.env.LOCAL_SESSION_SECRET;
  if (!v)
    throw new Error("Set LOCAL_SESSION_SECRET in .env.local to enable access.");
  return v;
}
export async function currentIdentity(): Promise<AccountIdentity | null> {
  if (process.env.MIS_BACKEND === "supabase") return currentCloudIdentity();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const [body, sig, ...extra] = raw.split(".");
    if (extra.length || !body || !sig) return null;
    const expected = createHmac("sha256", secret()).update(body).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const v = localSessionSchema.parse(
      JSON.parse(Buffer.from(body, "base64url").toString()),
    );
    const store = accountStore();
    try {
      const account = store.get(v.identity.id);
      return v.expiresAt > Date.now() &&
        account?.active &&
        mayUseSyntheticIdentity(
          account.identity.email,
          process.env.MIS_TEST_ACCOUNTS_ENABLED === "true",
        ) &&
        account.version === v.version
        ? account.identity
        : null;
    } finally {
      store.close();
    }
  } catch {
    return null;
  }
}
export async function startSession(identity: AccountIdentity) {
  const store = accountStore();
  const account = store.get(identity.id);
  store.close();
  if (!account?.active) throw new Error("Account is inactive.");
  const body = Buffer.from(
    JSON.stringify({
      identity,
      version: account.version,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  (await cookies()).set(COOKIE, `${body}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.LOCAL_HTTPS === "true",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
export async function endSession() {
  if (process.env.MIS_BACKEND === "supabase") {
    const client = await createSupabaseServerClient();
    await client.auth.signOut();
  }
  (await cookies()).delete(COOKIE);
  (await cookies()).delete("mis-school-context");
}
export async function requireIdentity(path?: string) {
  const identity = await currentIdentity();
  if (!identity) {
    if (
      process.env.MIS_BACKEND === "supabase" &&
      (await currentCloudIdentity({ allowPasswordChange: true }))
    )
      redirect("/change-password");
    redirect("/login");
  }
  if (path && !canAccess(identity.role, path)) redirect("/access-denied");
  return identity;
}
