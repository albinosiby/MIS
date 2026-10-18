import { requireIdentity } from "@/features/identity/server/session";
import { OperationsShell } from "@/features/operations/components/operations-shell";
import { PrivateFiles } from "@/features/documents/components/private-files";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const { owner } = await searchParams;
  const actor = await requireIdentity("/documents/files");
  return (
    <OperationsShell actor={actor} route="/documents/files">
      <PrivateFiles
        actor={actor}
        initialOwner={
          typeof owner === "string" && owner.length <= 200 ? owner : undefined
        }
      />
    </OperationsShell>
  );
}
