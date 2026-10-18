# Workspace screen implementation audit

Every route below has implemented workspace UI and is connected to the shared persistent workspace. “Fallback” means exact visual comparison remains pending because Albino’s Figma MCP quota was exhausted; the user approved pasted-content/design-system implementation. Route existence is not a claim that every browser action has an automated end-to-end test.

| Screen | Route | Figma node | Design basis |
| --- | --- | --- | --- |
| Live Operations | /dashboard | 1106:4493 | Pasted content + design system; visual comparison pending |
| Administrative Approvals Inbox | /dashboard/approvals | 1106:11932 | Pasted content + design system; visual comparison pending |
| Academic Calendar | /dashboard/calendar | 1106:12540 | Pasted content + design system; visual comparison pending |
| Add Academic Event | /dashboard/calendar/new | 1106:13297 | Pasted content + design system; visual comparison pending |
| System Audit & Compliance Log | /audit | 1106:16183 | Pasted content + design system; visual comparison pending |
| Admissions Management Hub | /admissions | 1106:5246 | Retrieved Figma context + local assets |
| Prospective Student Inquiries Desk | /admissions/inquiries | 1106:15040 | Pasted content + design system; visual comparison pending |
| Log New Enquiry | /admissions/inquiries/new | 1106:6406 | Pasted content + design system; visual comparison pending |
| Public Admission Form & QR Portal | /admissions/public-form | 1106:5883 | Pasted content + design system; visual comparison pending |
| Online Admission Form Builder | /admissions/form-builder | 1106:7351 | Pasted content + design system; visual comparison pending |
| Applications | /admissions/applications | 1106:6665 | Pasted content + design system; visual comparison pending |
| Tests & Interviews | /admissions/assessments | 1106:8070 | Pasted content + design system; visual comparison pending |
| Seats & Waitlists | /admissions/seats | 1106:8655 | Pasted content + design system; visual comparison pending |
| Offers & Enrolment | /admissions/offers | 1106:9347 | Pasted content + design system; visual comparison pending |
| Re-enrolment | /admissions/reenrolment | 1106:9962 | Pasted content + design system; visual comparison pending |
| Admissions Conversion Funnel | /admissions/analytics | 1106:14550 | Pasted content + design system; visual comparison pending |
| Students & Guardians Hub | /students | 1106:23542 | Prior retrieved list reference + shared system |
| Enroll New Student | /students/new | 1106:17069 | Pasted content + design system; visual comparison pending |
| Student Profile | /students/profile | Supporting page | Pasted content + design system; visual comparison pending |
| Guardians & Emergency Contacts | /students/guardians | 1106:17703 | Pasted content + design system; visual comparison pending |
| Import & Migration | /students/import | 1106:18341 | Pasted content + design system; visual comparison pending |
| Promotion & Transfers | /students/promotions | 1106:18769 | Pasted content + design system; visual comparison pending |
| ID Cards & Barcodes | /students/id-cards | 1106:19324 | Pasted content + design system; visual comparison pending |
| Certificates & TC | /students/certificates | 1106:19933 | Pasted content + design system; visual comparison pending |
| Review & Merge | /students/merge | 1106:20477 | Pasted content + design system; visual comparison pending |
| Bus Route Management | /students/transport | 1106:20962 | Pasted content + design system; visual comparison pending |
| Staff & HR Hub | /staff | 1106:27061 | Prior retrieved list reference + shared system |
| Onboard Staff | /staff/new | 1106:24360 | Pasted content + design system; visual comparison pending |
| Staff Profile | /staff/profile | 1106:24710 | Pasted content + design system; visual comparison pending |
| Roles & Permissions | /staff/roles | 1106:25299 | Pasted content + design system; visual comparison pending |
| Class & Subject Allocation | /staff/allocations | 1106:25815 | Pasted content + design system; visual comparison pending |
| Complete Documentation | /staff/documentation | 1106:26441 | Pasted content + design system; visual comparison pending |
| Daily Attendance Hub | /attendance | 1106:29080 | Pasted content + design system; visual comparison pending |
| Period-wise Attendance | /attendance/periods | 1106:27796 | Pasted content + design system; visual comparison pending |
| Leave Requests | /attendance/leave | 1106:28461 | Pasted content + design system; visual comparison pending |
| Staff Attendance | /attendance/staff | Supporting page | Pasted content + design system; visual comparison pending |
| Master Timetable & Scheduling Hub | /timetable | 1106:32046 | Retrieved Figma context + local assets |
| Create / Edit Timetable | /timetable/builder | 1106:31310 | Pasted content + design system; visual comparison pending |
| Proxy & Faculty Substitution | /timetable/substitutions | Supporting page | Pasted content + design system; visual comparison pending |
| Academics & Homework Hub | /academics | 1106:35344 | Pasted content + design system; visual comparison pending |
| Subjects & Faculty | /academics/subjects | 1106:32589 | Pasted content + design system; visual comparison pending |
| Syllabus & Curriculum | /academics/syllabus | 1106:33175 | Pasted content + design system; visual comparison pending |
| Lesson Plans | /academics/lessons | 1106:33712 | Pasted content + design system; visual comparison pending |
| Create Lesson Plan | /academics/lessons/new | 1106:34679 | Pasted content + design system; visual comparison pending |
| Create & Assign Homework | /academics/homework/new | 1106:34927 | Pasted content + design system; visual comparison pending |
| Homework Submissions | /academics/submissions | Supporting page | Pasted content + design system; visual comparison pending |
| Exams & Results | /exams | 1106:189 | Pasted content + design system; visual comparison pending |
| Create Exam Cycle | /exams/new | 1106:856 | Pasted content + design system; visual comparison pending |
| Marks Entry & Report Cards | /exams/marks | Supporting page | Pasted content + design system; visual comparison pending |
| Fees & Payments Hub | /fees | 1106:1598 | Pasted content + design system; visual comparison pending |
| Invoice Ledger | /fees/invoices | Supporting page | Pasted content + design system; visual comparison pending |
| Collect Payment | /fees/collect | Supporting page | Pasted content + design system; visual comparison pending |
| Communication & Reports Hub | /communication | 1106:2151 | Pasted content + design system; visual comparison pending |
| Quick Notice | /communication/new | 1106:16639 | Pasted content + design system; visual comparison pending |
| Standard Reports | /reports | 1106:2616 | Pasted content + design system; visual comparison pending |
| Settings Master Console | /settings | 1106:3211 | Retrieved Figma context + local assets |
| Year-End Rollover | /settings/year-end | Supporting page | Pasted content + design system; visual comparison pending |
| Principal Profile | /profile | 1106:3817 | Pasted content + design system; visual comparison pending |
| Notifications & Alerts | /notifications | 1106:4250 | Pasted content + design system; visual comparison pending |
| Support Desk | /support | Supporting page | Pasted content + design system; visual comparison pending |
