"use server";
import { z } from "zod";
import { prepareWorkspaceReplacement } from "../domain/workspace-replacement";
import { cloudFailure } from "../domain/action-result";
import { requireIdentity } from "../../identity/server/session";
import { readCloudCanonical, commitCloudCanonical } from "./repository";
import { projectCloudForClient } from "./projection";
import { applyCloudCommand } from "../domain/commands";
async function requireCloudIdentity() {
  if (process.env.MIS_BACKEND !== "supabase")
    throw new Error("Cloud data access is not enabled.");
  return requireIdentity();
}
export async function loadCloudWorkspace() {
  const actor = await requireCloudIdentity();
  return projectCloudForClient(await readCloudCanonical(actor), actor);
}
export async function executeCloudCommand(input: unknown) {
  const actor = await requireCloudIdentity();
  try {
    const previous = await readCloudCanonical(actor);
    const next = applyCloudCommand(previous, actor, input);
    const saved = await commitCloudCanonical(
      actor,
      previous,
      next,
      "Portal workflow command",
    );
    return {
      ok: true as const,
      data: await projectCloudForClient(saved, actor),
    };
  } catch (error) {
    return cloudFailure(error);
  }
}

export async function replaceCloudWorkspace(
  input: unknown,
  expectedRevision: number,
  actionInput: unknown,
) {
  const actor = await requireCloudIdentity();
  try {
    if (!["admin", "principal"].includes(actor.role))
      throw new Error("School administrator required.");
    const action = z.string().trim().min(1).max(300).parse(actionInput);
    const previous = await readCloudCanonical(actor);
    const next = prepareWorkspaceReplacement(
      previous,
      actor,
      input,
      expectedRevision,
      action,
    );
    const saved = await commitCloudCanonical(actor, previous, next, action);
    return {
      ok: true as const,
      data: await projectCloudForClient(saved, actor),
    };
  } catch (error) {
    return cloudFailure(error);
  }
}
