import {requireIdentity} from "@/features/identity/server/session";
import {OperationsShell} from "@/features/operations/components/operations-shell";
import {SchoolContexts} from "@/features/identity/components/school-contexts";
export default async function Page(){const actor=await requireIdentity();return <OperationsShell actor={actor} route="/select-school"><div className="op-heading"><h1>Your schools & roles</h1></div><SchoolContexts/></OperationsShell>;}
