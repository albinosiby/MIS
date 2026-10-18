import {
  schoolContext,
  jsonBody,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import { cloudMutationSchema } from "@/features/cloud/schemas/cloud.schema";
import { applyCloudCommand } from "@/features/cloud/domain/commands";
import { commitCloudCanonical } from "@/features/cloud/server/repository";
import { projectCloudForClient } from "@/features/cloud/server/projection";
export async function POST(request: Request) {
  try {
    const { actor, root } = await schoolContext(),
      input = cloudMutationSchema.parse(await jsonBody(request, 200000));
    const next = applyCloudCommand(root, actor, input),
      saved = await commitCloudCanonical(
        actor,
        root,
        next,
        `Workflow: ${input.command.type}`,
      );
    return privateJson({
      ok: true,
      data: await projectCloudForClient(saved, actor),
    });
  } catch (error) {
    return apiFailure(error);
  }
}
