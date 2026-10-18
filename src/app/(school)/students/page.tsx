import {WorkspaceScreen} from '@/features/workspace/components/workspace-screen';
import {requireIdentity} from '@/features/identity/server/session';
export default async function Page(){await requireIdentity('/students');return <WorkspaceScreen route='/students'/>;}
