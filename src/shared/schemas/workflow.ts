import { z } from 'zod';
import { identifierSchema, localDateSchema, displayNameSchema } from './primitives.ts';
export const scopedRecordSchema=z.strictObject({id:identifierSchema,schoolId:identifierSchema,academicYearId:identifierSchema});
export const dateSpanSchema=z.strictObject({startDate:localDateSchema,endDate:localDateSchema}).refine(v=>v.startDate<=v.endDate,{path:['endDate'],message:'End date must be on or after start date'});
export const attachmentSchema=z.strictObject({id:identifierSchema,name:displayNameSchema,size:z.number().int().min(0).max(5_000_000),kind:z.enum(['document','image','other']),status:z.enum(['pending','verified'])});
export const subjectSchema=scopedRecordSchema.extend({name:displayNameSchema,code:z.string().trim().min(1).max(20),maxMarks:z.number().int().min(1).max(1000)});
export const weekdaySchema=z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
