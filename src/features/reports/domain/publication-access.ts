import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import type {Publication} from "../models/index.ts";
import { scopedStudentIds } from "../../operations/domain/operations.ts";
export function canViewPublicationMetadata(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  p: Publication,
) {
  if (a.schoolId !== y.setup.school.id) return false;
  if (["admin", "principal"].includes(a.role)) return true;
  if (
    a.role === "accountant" &&
    p.ownerType === "school" &&
    p.kind === "report" &&
    p.snapshot.source === "ledger"
  )
    return true;
  if (p.ownerType === "staff")
    return a.role === "hr" || p.ownerId === a.personId;
  if (p.ownerType === "student")
    return (
      ["parent", "student", "teacher"].includes(a.role) &&
      scopedStudentIds(y, a).includes(p.ownerId)
    );
  return false;
}

export function canReadPublication(y:SchoolYearWorkspace,a:AccountIdentity,p:Publication){return !p.revokedAt&&canViewPublicationMetadata(y,a,p);}
