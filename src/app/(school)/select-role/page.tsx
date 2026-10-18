import { redirect } from "next/navigation";
import { roleHome } from "@/features/identity/domain/access";
import Link from "next/link";
import { requireIdentity } from "@/features/identity/server/session";
import { testAccounts } from "@/features/identity/data/test-accounts";
import { OperationsShell } from "@/features/operations/components/operations-shell";
export default async function Page() {
  const actor = await requireIdentity();
  if (process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true") redirect(roleHome(actor.role));
  return (
    <OperationsShell actor={actor} route="/select-role">
      <div className="op-heading">
        <div>
          <h1>Choose a workspace</h1>
          <p>
            Each entry opens that role’s sign-in screen. You must authenticate
            as the account; this page does not grant roles.
          </p>
        </div>
      </div>
      <div className="op-cards">
        {testAccounts
          .filter(
            (x) =>
              process.env.MIS_BACKEND !== "supabase" ||
              ["admin", "teacher", "staff", "parent", "student"].includes(
                x.role,
              ),
          )
          .map((x) => (
            <Link className="op-card" href={`/login/${x.role}`} key={x.id}>
              <h2 className="capitalize">{x.role}</h2>
              
              <span className="text-primary">Open sign in →</span>
            </Link>
          ))}
      </div>
    </OperationsShell>
  );
}
