"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  inviteCloudAccount,
  toggleCloudAccount,
  linkCloudAccount,
  cloudPasswordSchema,
} from "../../cloud/server/accounts";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountStore } from "../domain/account-store";
import { requireIdentity, endSession } from "./session";
import { roleSchema } from "../schemas/identity.schema";
export async function recoveryRequest(
  _state: { error: string; link: string },
  form: FormData,
) {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success)
    return { error: "Enter a valid email address.", link: "" };
  if (process.env.MIS_BACKEND === "supabase") {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000"}/auth/confirm`,
    });
    return {
      error: error
        ? "Recovery could not be requested. Please try again later."
        : "",
      link: error ? "" : "none",
    };
  }
  const store = accountStore();
  try {
    const token = store.recover(email.data);
    return {
      error: "",
      link: token ? `/reset-password?token=${token}` : "none",
    };
  } finally {
    store.close();
  }
}
export async function completeRecovery(
  _state: { error: string; done: boolean },
  form: FormData,
) {
  try {
    if (form.get("password") !== form.get("confirm"))
      throw new Error("Passwords must match.");
    if (process.env.MIS_BACKEND === "supabase") {
      const password = cloudPasswordSchema.parse(form.get("password"));
      const client = await createSupabaseServerClient();
      const invitation = form.get("purpose") === "invitation";
      const token = String(form.get("token"));
      if (token !== "cloud-session") {
        const { error } = await client.auth.verifyOtp({
          token_hash: token,
          type: invitation ? "invite" : "recovery",
        });
        if (error) throw new Error("This link is invalid or expired.");
      } else if (invitation)
        throw new Error("A valid invitation link is required.");
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error("A valid recovery session is required.");
      if (invitation) {
        const { data: member } = await createSupabaseAdminClient()
          .from("mis_memberships")
          .select("invitation_pending")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!member?.invitation_pending)
          throw new Error("This invitation is no longer available.");
      }
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error("Password could not be updated.");
      if (invitation) {
        const { error: failure } = await createSupabaseAdminClient()
          .from("mis_memberships")
          .update({ active: true, invitation_pending: false })
          .eq("user_id", user.id)
          .eq("invitation_pending", true);
        if (failure) throw new Error("Membership could not be activated.");
      }
      await client.auth.signOut({ scope: "global" });
      return { error: "", done: true };
    }
    const store = accountStore();
    try {
      store.finish(
        String(form.get("token")),
        form.get("purpose") === "invitation" ? "invitation" : "recovery",
        String(form.get("password")),
      );
    } finally {
      store.close();
    }
    return { error: "", done: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not save password.",
      done: false,
    };
  }
}
export async function inviteAccount(
  _state: { error: string; link: string },
  form: FormData,
) {
  try {
    const actor = await requireIdentity("/settings/users");
    if (!["admin", "principal"].includes(actor.role))
      throw new Error("School administrator access required.");
    const role = roleSchema.parse(form.get("role"));
    if (["platform", "group"].includes(role))
      throw new Error(
        "Platform and group access cannot be granted by a school.",
      );
    const email = z.email().parse(form.get("email"));
    const name = z.string().trim().min(2).max(160).parse(form.get("name"));
    if (process.env.MIS_BACKEND === "supabase")
      return {
        error: "",
        link: await inviteCloudAccount(actor, email, name, role),
      };
    const store = accountStore();
    try {
      const token = store.invite({
        id: crypto.randomUUID(),
        email,
        name,
        role,
        schoolId: actor.schoolId,
        personId: null,
      });
      return { error: "", link: `/accept-invitation?token=${token}` };
    } finally {
      store.close();
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not invite account.",
      link: "",
    };
  }
}
export async function toggleAccount(_state: { error: string }, form: FormData) {
  const actor = await requireIdentity("/settings/users");
  if (!["admin", "principal"].includes(actor.role))
    throw new Error("Administrator required.");
  if (process.env.MIS_BACKEND === "supabase") {
    try {
      await toggleCloudAccount(actor, String(form.get("id")));
      revalidatePath("/settings/users");
      return { error: "" };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Could not update account.",
      };
    }
  }
  const store = accountStore();
  try {
    const target = store.get(String(form.get("id")));
    if (
      !target ||
      target.identity.schoolId !== actor.schoolId ||
      ["platform", "group"].includes(target.identity.role)
    )
      throw new Error("Account is outside your scope.");
    store.setActive(target.identity.id, !target.active);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not update account.",
    };
  } finally {
    store.close();
  }
  revalidatePath("/settings/users");
  return { error: "" };
}
export async function revokeSessions() {
  const actor = await requireIdentity();
  if (process.env.MIS_BACKEND === "supabase") {
    const client = await createSupabaseServerClient();
    await client.auth.signOut({ scope: "global" });
    redirect("/login");
  }
  const store = accountStore();
  try {
    store.revoke(actor.id);
  } finally {
    store.close();
  }
  await endSession();
  redirect("/login");
}
export async function linkAccount(
  _state: { error: string; done: boolean },
  form: FormData,
) {
  try {
    const actor = await requireIdentity("/settings/users");
    if (!["admin", "principal"].includes(actor.role))
      throw new Error("Administrator required.");
    if (process.env.MIS_BACKEND === "supabase") {
      await linkCloudAccount(
        actor,
        String(form.get("id")),
        String(form.get("personId")),
      );
      revalidatePath("/settings/users");
      return { error: "", done: true };
    }
    const store = accountStore();
    try {
      const target = store.get(String(form.get("id")));
      if (
        !target ||
        target.identity.schoolId !== actor.schoolId ||
        ["admin", "principal", "platform", "group"].includes(
          target.identity.role,
        )
      )
        throw new Error("This account cannot be linked here.");
      const personId = z
        .string()
        .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/)
        .parse(form.get("personId"));
      store.updateIdentity({ ...target.identity, personId });
      return { error: "", done: true };
    } finally {
      store.close();
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not link account.",
      done: false,
    };
  }
}
