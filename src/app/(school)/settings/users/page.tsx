import {mayAssignSchoolRole} from "@/features/identity/domain/membership-context";
import {PermissionPolicy} from "@/features/identity/components/permission-policy";
import {RoleGrants} from "@/features/identity/components/role-grants";
import { listCloudAccounts } from "@/features/cloud/server/accounts";
import Link from "next/link";
import { requireIdentity } from "@/features/identity/server/session";
import { accountStore } from "@/features/identity/domain/account-store";
import { AccountLinkForm } from "@/features/identity/components/account-link-form";
import { InviteForm } from "@/features/identity/components/recovery-form";
import { AccountStatusForm } from "@/features/identity/components/account-status-form";
import { OperationsShell } from "@/features/operations/components/operations-shell";
import "@/features/identity/styles.css";
export default async function Page() {
  const actor = await requireIdentity("/settings/users");
  const cloud = process.env.MIS_BACKEND === "supabase";
  const accounts = cloud
    ? await listCloudAccounts(actor)
    : (() => {
        const store = accountStore();
        try {
          return store
            .list()
            .filter(
              (a) =>
                a.identity.schoolId === actor.schoolId &&
                !["platform", "group"].includes(a.identity.role),
            );
        } finally {
          store.close();
        }
      })();
  return (
    <OperationsShell actor={actor} route="/settings/users">
      <div className="op-heading">
        <div>
          <span className="op-eyebrow">Administration / access</span>
          <h1>Users & invitations</h1>
          <p>
            Activate school accounts and review their roles. Account identity is
            separate from student and staff records.
          </p>
        </div>
        <Link href="/workspace">All workspaces →</Link>
      </div>
      <div className="op-table-wrap">
        <table className="op-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th>ROLE</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.identity.id}>
                <td>{a.identity.name}</td>
                <td>{a.identity.email}</td>
                <td>{a.identity.role}</td>
                <td>
                  <span className="op-badge">
                    {a.active ? "Active" : "Inactive / invited"}
                  </span>
                </td>
                <td>
                  <AccountStatusForm
                    id={a.identity.id}
                    active={a.active}
                    disabled={a.identity.id === actor.id||!mayAssignSchoolRole(actor.role,a.identity.role)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="op-card identity-card mt-8">
        <h2>Invite a school member</h2>
        <InviteForm />
      </div>
      <div className="op-card identity-card mt-8">
        <h2>Link account to a person</h2>
        <AccountLinkForm
          accounts={accounts
            .map((a) => a.identity)
            .filter((a) => !["admin", "principal"].includes(a.role))}
        />
      </div>
      {cloud&&<section className="op-card mt-8"><RoleGrants actor={actor} accounts={accounts.filter(a=>a.active).map(a=>a.identity)}/></section>}
      {cloud&&<section className="op-card mt-8"><PermissionPolicy actor={actor}/></section>}
      <p className="op-notice">
        {cloud
          ? "Supabase Auth and school memberships. Share invitation links privately; no invitation email is sent by this screen."
          : "School accounts · Invitations require configured email delivery."}
      </p>
    </OperationsShell>
  );
}
