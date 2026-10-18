import { requireIdentity } from "@/features/identity/server/session";
import { OperationsShell } from "@/features/operations/components/operations-shell";
import { ConversationInbox } from "@/features/communication/components/conversation-inbox";
export default async function Page(){const actor=await requireIdentity("/communication/inbox");return <OperationsShell actor={actor} route="/communication/inbox"><ConversationInbox actor={actor}/></OperationsShell>;}
