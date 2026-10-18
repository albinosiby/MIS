import {z} from "zod";
import {identifierSchema,localDateSchema,displayNameSchema} from "../../../shared/schemas/primitives.ts";
import {certificateSchema} from "../../students/schemas/students.schema.ts";
export const certificateReferenceSchema=identifierSchema;
/** Public attestation deliberately withholds the student's identity and document contents. */
export const certificateVerificationSchema=z.strictObject({type:certificateSchema.shape.type,issuedOn:localDateSchema,school:displayNameSchema});
export const certificateVerificationResponseSchema=z.strictObject({valid:z.boolean(),certificate:certificateVerificationSchema.nullable()}).refine(v=>v.valid===(v.certificate!==null),{message:"Verification status must match the attestation."});
