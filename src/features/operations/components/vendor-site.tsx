"use client";
import Link from "next/link";
import { SchoolLogo } from "@/components/branding/school-logo";
import { useBackend } from "../../identity/components/identity-context";
import { useState } from "react";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import { DataForm } from "../../workspace/components/workspace-ui";
import { tenantRequestsRequestSchema } from "../../admin/schemas/operations.schema";
export function VendorSite({ page }: { page: string }) {
  const { year, mutate } = useWorkspace();
  const cloud = useBackend() === "supabase";
  const [sent, setSent] = useState(false);
  const titles: Record<string, string> = {
    "": "One connected workspace for your school",
    features: "Every school day, connected",
    pricing: "Plans for your school",
    contact: "Talk to our school team",
    signup: "Start your school workspace",
    security: "Security & data access",
    partners: "Partner enquiries",
    help: "Help centre",
    status: "Service status",
    blog: "Product updates",
    careers: "Join the team",
    privacy: "Privacy notice",
    terms: "Terms of service",
  };
  const isForm = ["contact", "signup", "partners"].includes(page);
  return (
    <div className="min-h-screen bg-white">
      <header className="flex flex-wrap items-center justify-between gap-5 p-6 border-b">
        <Link href="/welcome" className="identity-brand">
          <SchoolLogo size={36} /> School workspace
        </Link>
        <nav className="op-links">
          {["features", "pricing", "security", "help"].map((p) => (
            <Link href={`/welcome/${p}`} key={p}>
              {titles[p]}
            </Link>
          ))}
          <Link href="/login">Sign in →</Link>
        </nav>
      </header>
      <main id="main-content" className="max-w-6xl mx-auto px-6 py-12">
        <span className="op-eyebrow">School MIS</span>
        <h1 className="text-4xl font-semibold my-7 max-w-3xl leading-tight">
          {titles[page]}
        </h1>
        <p className="text-slate-500 leading-8 max-w-3xl">
          Connect administration, teachers, families and students through
          consistent school records and clear daily workflows.
        </p>
        {isForm ? (
          <div className="op-card max-w-xl mt-8">
            {sent ? (
              <div role="status">
                <h2>Request received</h2>
                <p>
                  Your request has been saved and appears in the platform
                  provisioning queue. No email was sent and no live school
                  account was created.
                </p>
                <Link href={cloud ? "/welcome" : "/login/platform"}>
                  Return to welcome page →
                </Link>
              </div>
            ) : (
              <DataForm
                initial={{
                  id: crypto.randomUUID(),
                  schoolId: year.setup.school.id,
                  academicYearId: year.setup.calendar.year.id,
                  kind: "tenant-requests",
                  title: "",
                  date: year.setup.calendar.year.startDate,
                  studentId: null,
                  staffId: null,
                  status: "requested",
                  values: { schoolName: "", country: "India", email: "" },
                  createdBy: "public-demo",
                  history: [],
                }}
                fields={[
                  { name: "title", label: "Contact name" },
                  { name: "values.schoolName", label: "School name" },
                  { name: "values.country", label: "Country" },
                  { name: "values.email", label: "Email address" },
                ]}
                submitLabel="Send enquiry"
                onSave={async (input) => {
                  const row = tenantRequestsRequestSchema.parse(input);
                  await mutate(
                    (v) => ({
                      ...v,
                      extensions: [
                        ...v.extensions,
                        {
                          ...row,
                          history: [
                            {
                              at: new Date().toISOString(),
                              actorId: "public-demo",
                              action: "Public request received",
                            },
                          ],
                        },
                      ],
                    }),
                    "Public: school enquiry",
                    { type: "public-tenant", input: row },
                  );
                  setSent(true);
                }}
              />
            )}
          </div>
        ) : page === "pricing" ? (
          <div className="op-cards mt-8">
            {["Pilot", "School", "Group"].map((plan) => (
              <div className="op-card" key={plan}>
                <h2>{plan}</h2>
                <p>
                  School modules and role-based portals. Pricing, terms and
                  subscriptions require business configuration.
                </p>
                <Link href="/welcome/contact">Discuss this plan →</Link>
              </div>
            ))}
          </div>
        ) : page === "status" ? (
          <div className="op-card mt-8">
            <h2>Local preview</h2>
            <p>Web application: available in your browser.</p>
            <p>
              Supabase, payment gateways, external messages and live monitoring:
              not connected.
            </p>
          </div>
        ) : ["privacy", "terms", "security"].includes(page) ? (
          <div className="op-notice">
            School information. Final policies, hosting, data retention and
            production security configuration require school/business review. No
            legally binding terms are accepted through this.
          </div>
        ) : (
          <div className="op-cards mt-8">
            {[
              [
                "School operations",
                "Admissions, students, attendance, fees, exams and reports.",
                "/login/admin",
              ],
              [
                "Teachers & staff",
                "Assigned classes, learning, attendance and staff self-service.",
                "/login/teacher",
              ],
              [
                "Parents & students",
                "Linked attendance, homework, results, fees and notices.",
                "/login/parent",
              ],
            ].map(([title, body, href]) => (
              <Link className="op-card" href={href} key={title}>
                <h2>{title}</h2>
                <p>{body}</p>
                <span className="text-primary">Explore workspace →</span>
              </Link>
            ))}
          </div>
        )}
        <div className="op-links mt-10">
          <Link href="/welcome/contact">Contact us</Link>
          <Link href="/welcome/signup">School onboarding request</Link>
          <Link href="/school-site">School website preview</Link>
          <Link href="/login">Role sign in</Link>
        </div>
      </main>
      <footer className="border-t p-6">
        <nav className="op-links">
          {["partners", "status", "blog", "careers", "privacy", "terms"].map(
            (p) => (
              <Link key={p} href={`/welcome/${p}`}>
                {titles[p]}
              </Link>
            ),
          )}
        </nav>
      </footer>
    </div>
  );
}
