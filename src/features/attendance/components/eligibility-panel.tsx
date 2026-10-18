"use client";
import {useWorkflowActions} from "../../workspace/hooks/workflow-actions";
import {attendanceEligibilityBatch} from "../domain/eligibility";
export function EligibilityPanel(){
const {year:y}=useWorkflowActions();
return ((
        <section className="op-card">
          <h2>Attendance eligibility</h2>
          <p>
            Instructional weekdays and published holidays determine expected
            attendance. Unmarked days are shown as incomplete; they are not
            treated as present.
          </p>
          <div className="op-table-wrap">
            <table className="op-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Expected days</th>
                  <th>Marked</th>
                  <th>Missing</th>
                  <th>Present %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceEligibilityBatch(y,y.setup.students.map(s=>s.id),new Date().toISOString().slice(0,10)).map(r=>{
                  const s=y.setup.students.find(student=>student.id===r.studentId)!;
                  return (
                    <tr key={s.id}>
                      <td>{s.displayName}</td>
                      <td>{r.instructionalDays}</td>
                      <td>{r.markedDays}</td>
                      <td>{r.missingDays}</td>
                      <td>{r.percent ?? "—"}</td>
                      <td>{r.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ));
}
