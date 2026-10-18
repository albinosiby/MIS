import { requireIdentity } from "@/features/identity/server/session";
import { OperationsShell } from "@/features/operations/components/operations-shell";
import { JobConsole } from "@/features/jobs/components/job-console";
export default async function Page(){const actor=await requireIdentity("/communication/jobs");return <OperationsShell actor={actor} route="/communication/jobs"><JobConsole/></OperationsShell>;}
