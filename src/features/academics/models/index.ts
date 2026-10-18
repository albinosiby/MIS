import type { z } from "zod";
import type {
  syllabusUnitSchema,
  lessonPlanSchema,
  homeworkSchema,
  homeworkSubmissionSchema,
} from "../schemas/academics.schema.ts";
export type SyllabusUnit = z.infer<typeof syllabusUnitSchema>;
export type LessonPlan = z.infer<typeof lessonPlanSchema>;
export type Homework = z.infer<typeof homeworkSchema>;
export type HomeworkSubmission = z.infer<typeof homeworkSubmissionSchema>;
