export type * from './operations.ts';

import type {z} from "zod";

import type {payrollPolicySchema, salaryPlanSchema, payrollRunSchema, employmentEventSchema} from "../schemas/payroll.schema.ts";
export type PayrollPolicy=z.infer<typeof payrollPolicySchema>;
export type SalaryPlan=z.infer<typeof salaryPlanSchema>;
export type PayrollRun=z.infer<typeof payrollRunSchema>;
export type EmploymentEvent=z.infer<typeof employmentEventSchema>;
