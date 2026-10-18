import type { ModuleDefinition } from "../models/definitions.ts";
import { forms as feesForms } from "../../fees/data/operation-forms.ts";
import { forms as examsForms } from "../../exams/data/operation-forms.ts";
import { forms as communicationForms } from "../../communication/data/operation-forms.ts";
import { forms as hrForms } from "../../hr/data/operation-forms.ts";
import { forms as transportForms } from "../../transport/data/operation-forms.ts";
import { forms as libraryForms } from "../../library/data/operation-forms.ts";
import { forms as inventoryForms } from "../../inventory/data/operation-forms.ts";
import { forms as hostelForms } from "../../hostel/data/operation-forms.ts";
import { forms as wellbeingForms } from "../../wellbeing/data/operation-forms.ts";
import { forms as healthForms } from "../../health/data/operation-forms.ts";
import { forms as activitiesForms } from "../../activities/data/operation-forms.ts";
import { forms as documentsForms } from "../../documents/data/operation-forms.ts";
import { forms as learningForms } from "../../learning/data/operation-forms.ts";
import { forms as front_officeForms } from "../../front-office/data/operation-forms.ts";
import { forms as reportsForms } from "../../reports/data/operation-forms.ts";
import { forms as settingsForms } from "../../settings/data/operation-forms.ts";
import { forms as websiteForms } from "../../website/data/operation-forms.ts";
import { forms as platformForms } from "../../admin/data/operation-forms.ts";
import { forms as groupForms } from "../../group/data/operation-forms.ts";
import { forms as alumniForms } from "../../alumni/data/operation-forms.ts";
export const moduleDefinitions: ModuleDefinition[] = [
  ...feesForms,
  ...examsForms,
  ...communicationForms,
  ...hrForms,
  ...transportForms,
  ...libraryForms,
  ...inventoryForms,
  ...hostelForms,
  ...wellbeingForms,
  ...healthForms,
  ...activitiesForms,
  ...documentsForms,
  ...learningForms,
  ...front_officeForms,
  ...reportsForms,
  ...settingsForms,
  ...websiteForms,
  ...platformForms,
  ...groupForms,
  ...alumniForms,
];
export function definition(kind: string) {
  const found = moduleDefinitions.find((x) => x.kind === kind);
  if (!found) throw new Error("Unknown operational collection.");
  return found;
}
