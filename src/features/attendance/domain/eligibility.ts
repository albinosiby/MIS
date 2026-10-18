import {classAtDate} from "../../students/domain/class-history.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { localDateSchema } from "../../../shared/schemas/primitives.ts";
export function isInstructionDay(
  y: SchoolYearWorkspace,
  date: string,
  classId: string,
) {
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  return (
    y.workflows.advanced.instructionalWeekdays.includes(weekday) &&
    !y.records.events.some(
      (e) =>
        e.category === "Holiday" &&
        e.status === "published" &&
        e.dates.startDate <= date &&
        e.dates.endDate >= date &&
        (!e.classSectionIds.length || e.classSectionIds.includes(classId)),
    )
  );
}
function eligibilityIndex(y:SchoolYearWorkspace){
 const records=new Map<string,Map<string,SchoolYearWorkspace["records"]["attendance"][number]>>();
 for(const row of y.records.attendance)if(row.personType==="student"&&row.periodId===null){if(!records.has(row.personId))records.set(row.personId,new Map());records.get(row.personId)!.set(row.date,row);}
 const histories=new Map<string,SchoolYearWorkspace["workflows"]["studentEvents"]>();for(const event of y.workflows.studentEvents){if(!histories.has(event.studentId))histories.set(event.studentId,[]);histories.get(event.studentId)!.push(event);}
 return {records,histories,days:new Map<string,boolean>(),students:new Map(y.setup.students.map(s=>[s.id,s]))};
}
function calculateEligibility(y:SchoolYearWorkspace,studentId:string,through:string,index:ReturnType<typeof eligibilityIndex>){
 const student=index.students.get(studentId);if(!student)throw new Error("Student unavailable.");const events=index.histories.get(studentId)??[],start=events.find(e=>e.kind==="enrolled")?.date??y.setup.calendar.year.startDate,end=through<y.setup.calendar.year.endDate?through:y.setup.calendar.year.endDate;
 let expected=0,marked=0,present=0,excused=0;
 for(let cursor=new Date(start+"T00:00:00Z");cursor.toISOString().slice(0,10)<=end;cursor.setUTCDate(cursor.getUTCDate()+1)){
  const date=cursor.toISOString().slice(0,10),classId=classAtDate(student.classSectionId,events,studentId,date),key=`${classId}:${date}`;
  if(!index.days.has(key))index.days.set(key,isInstructionDay(y,date,classId));if(!index.days.get(key))continue;
  expected++;const row=index.records.get(studentId)?.get(date);if(!row)continue;marked++;if(row.status==="present"||row.status==="late")present++;if(row.status==="excused")excused++;
 }
 const denominator=expected-excused,missing=expected-marked,percent=denominator?Math.round(present/denominator*10000)/100:null;
 return {studentId,through:end,instructionalDays:expected,markedDays:marked,presentDays:present,excusedDays:excused,missingDays:missing,percent,minimum:y.workflows.advanced.examEligibilityPercent,status:missing||percent===null?"incomplete" as const:percent>=y.workflows.advanced.examEligibilityPercent?"eligible" as const:"below-threshold" as const};
}
export function attendanceEligibility(y:SchoolYearWorkspace,studentId:string,through:string){localDateSchema.parse(through);return calculateEligibility(y,studentId,through,eligibilityIndex(y));}
export function attendanceEligibilityBatch(y:SchoolYearWorkspace,studentIds:string[],through:string){localDateSchema.parse(through);const index=eligibilityIndex(y);return studentIds.map(id=>calculateEligibility(y,id,through,index));}
export function consecutiveAbsences(
  y: SchoolYearWorkspace,
  studentId: string,
  through: string,
) {
  localDateSchema.parse(through);
  const student = y.setup.students.find((s) => s.id === studentId);
  if (!student) return 0;
  let count = 0;
  for (
    let day = new Date(through + "T00:00:00Z");
    day.toISOString().slice(0, 10) >= y.setup.calendar.year.startDate;
    day.setUTCDate(day.getUTCDate() - 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    if (!isInstructionDay(y,date,classAtDate(student.classSectionId,y.workflows.studentEvents,studentId,date))) continue;
    if (
      !y.records.attendance.some(
        (r) =>
          r.personType === "student" &&
          r.personId === studentId &&
          r.periodId === null &&
          r.date === date &&
          r.status === "absent",
      )
    )
      break;
    count++;
  }
  return count;
}
