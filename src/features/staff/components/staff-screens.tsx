"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { WorkspaceScreenProps } from "../../workspace/components/workspace-screen";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  Tabs,
  DataForm,
  RecordDialog,
  LinkButton,
  ExportButton,
  classOptions,
  staffOptions,
  labelFor,
  newRecord,
  enumOptions,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { staffOnboardRequestSchema } from "../schemas/staff.schema";
import { staffSummarySchema } from "@/shared/schemas/people";
import { scope, putRecord } from "../../workspace/domain/operations";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema";
import { staffAllocationSchema } from "../../school-setup/schemas/setup-config.schema";
const tabs = [
  ["/staff", "Staff Registry"],
  ["/staff/new", "Add / Onboard Staff"],
  ["/staff/roles", "Roles & Permissions"],
  ["/staff/allocations", "Class & Subject Allocation"],
  ["/staff/documentation", "Complete Documentation"],
  ["/attendance/staff", "Staff Attendance"],
  ["/attendance/leave", "Leave Requests"],
] as const;
const permissions = [
  "students:read",
  "students:write",
  "staff:read",
  "staff:write",
  "attendance:write",
  "academics:write",
  "exams:write",
  "fees:write",
  "notices:write",
  "settings:write",
  "audit:read",
];
export default function StaffScreens({
  route,
  query,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate } = useWorkspace();
  const router = useRouter();
  const [editor, setEditor] = useState<ReactNode>(null);
  const staff = staffOptions(y),
    classes = classOptions(y);
  const rows = y.setup.staff.filter((s) =>
    `${s.displayName} ${s.id} ${s.designation}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const profileFields: FormField[] = [
    { name: "email", label: "Institutional email" },
    { name: "phone", label: "Phone (country code)" },
    { name: "department", label: "Department" },
    { name: "joinedOn", label: "Joining date", type: "date" },
    {
      name: "employment",
      label: "Employment type",
      type: "select",
      options: enumOptions(["Full-time", "Part-time", "Contract"]),
    },
    {
      name: "roleId",
      label: "Role preset ",
      type: "select",
      options: y.records.roles.map((r) => ({ value: r.id, label: r.name })),
    },
    { name: "bio", label: "Profile biography", type: "textarea" },
    {
      name: "documents",
      label: "Qualification & onboarding documents",
      type: "files",
    },
  ];
  if (route === "/staff/new")
    return (
      <>
        <Tabs items={tabs} route={route} />
        <Panel title="Staff identity & onboarding">
          <DataForm
            initial={{
              displayName: "",
              designation: "Teacher",
              email: "",
              phone: "",
              department: "Academic",
              joinedOn: y.setup.calendar.year.startDate,
              employment: "Full-time",
              roleId:
                y.records.roles.find((r) => r.name === "Teacher")?.id ??
                y.records.roles[0].id,
              documents: [],
              bio: "",
            }}
            fields={[
              { name: "displayName", label: "Full name", required: true },
              { name: "designation", label: "Designation", required: true },
              ...profileFields,
            ]}
            onSave={async (value) => {
              const input = staffOnboardRequestSchema.parse(value);
              await mutate((current) => {
                const id = crypto.randomUUID();
                return {
                  ...current,
                  setup: {
                    ...current.setup,
                    staff: [
                      ...current.setup.staff,
                      {
                        id,
                        schoolId: current.setup.school.id,
                        displayName: input.displayName,
                        designation: input.designation,
                      },
                    ],
                  },
                  records: {
                    ...current.records,
                    staffProfiles: [
                      ...current.records.staffProfiles,
                      {
                        ...scope(current),
                        id: crypto.randomUUID(),
                        staffId: id,
                        email: input.email,
                        phone: input.phone,
                        department: input.department,
                        joinedOn: input.joinedOn,
                        employment: input.employment,
                        roleId: input.roleId,
                        documents: input.documents,
                        bio: input.bio,
                      },
                    ],
                  },
                };
              }, "Onboarded staff member", { type: "staff-onboard", input });
              router.push("/staff");
            }}
            submitLabel="Complete onboarding"
          />
        </Panel>
      </>
    );
  if (route === "/staff/profile") {
    const person = query.id
      ? y.setup.staff.find((s) => s.id === query.id)
      : rows[0];
    if (!person)
      return (
        <Panel title="Staff record not found">
          <p className="ws-empty">Choose a staff member from the registry.</p>
        </Panel>
      );
    const profile = y.records.staffProfiles.find(
      (p) => p.staffId === person.id,
    ) ?? {
      ...newRecord(y),
      staffId: person.id,
      email: "",
      phone: "",
      department: "Academic",
      joinedOn: y.setup.calendar.year.startDate,
      employment: "Full-time",
      roleId: y.records.roles[0].id,
      documents: [],
      bio: "",
    };
    return (
      <>
        <div className="ws-profile-hero">
          <div className="ws-avatar">{person.displayName.slice(0, 1)}</div>
          <div>
            <h2>{person.displayName}</h2>
            <p>
              {person.designation} · {profile.department}
            </p>
            <Badge>
              {labelFor(
                y.records.roles.map((r) => ({ value: r.id, label: r.name })),
                profile.roleId,
              )}
            </Badge>
          </div>
          <LinkButton href="/staff">← Staff registry</LinkButton>
        </div>
        <div className="ws-two-column">
          <div>
            <Panel title="Staff identity">
              <DataForm
                key={person.id + y.setup.revision}
                initial={person}
                fields={[
                  { name: "displayName", label: "Full name" },
                  { name: "designation", label: "Designation" },
                ]}
                onSave={async (value) => {
                  const parsed = staffSummarySchema.parse(value);
                  await mutate(
                    (current) => ({
                      ...current,
                      setup: {
                        ...current.setup,
                        staff: current.setup.staff.map((s) =>
                          s.id === person.id ? parsed : s,
                        ),
                      },
                    }),
                    "Updated staff identity",
                    { type: "staff-identity", input: parsed },
                  );
                }}
              />
            </Panel>
            <Panel title="Contact, employment & documentation">
              <DataForm
                initial={profile}
                fields={profileFields}
                onSave={async (value) => {
                  await mutate(
                    (current) => putRecord(current, "staffProfiles", value),
                    "Updated staff profile",
                    { type: "staff-profile", input: value },
                  );
                }}
              />
            </Panel>
          </div>
          <div>
            <Panel title="Academic teaching load">
              <div className="ws-panel-body">
                <h3>
                  {
                    y.setup.allocations.filter((a) => a.staffId === person.id)
                      .length
                  }{" "}
                  allocations
                </h3>
                {y.setup.allocations
                  .filter((a) => a.staffId === person.id)
                  .map((a) => (
                    <p key={a.id}>
                      {labelFor(classes, a.classSectionId)} · {a.subject}
                    </p>
                  ))}
                <LinkButton href="/staff/allocations">
                  Manage allocations
                </LinkButton>
              </div>
            </Panel>
            <Panel title="Attendance & leave">
              <div className="ws-panel-body">
                <p>
                  {
                    y.records.attendance.filter(
                      (a) =>
                        a.personType === "staff" &&
                        a.personId === person.id &&
                        a.status === "present",
                    ).length
                  }{" "}
                  present records
                </p>
                <p>
                  {
                    y.records.leaves.filter(
                      (a) =>
                        a.personType === "staff" && a.personId === person.id,
                    ).length
                  }{" "}
                  leave requests
                </p>
                <LinkButton href="/attendance/staff">Staff register</LinkButton>
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <Tabs items={tabs} route={route} />
      <div className="ws-actions">
        <LinkButton href="/staff/new" variant="default">
          + Add / Onboard Staff
        </LinkButton>
        <ExportButton report="staff" name="staff-directory" rows={rows} />
      </div>
      {route === "/staff/roles" ? (
        <Panel
          title="Staff role classifications"
          action={
            <Button
              onClick={() =>
                setEditor(
                  <RecordDialog
                    title="Create role preset"
                    collection="roles"
                    initial={{
                      ...newRecord(y),
                      name: "",
                      permissions: ["students:read"],
                    }}
                    fields={[
                      { name: "name", label: "Role name" },
                      {
                        name: "permissions",
                        label: "Permissions",
                        type: "multi",
                        options: enumOptions(permissions),
                      },
                    ]}
                    onClose={() => setEditor(null)}
                  />,
                )
              }
            >
              + New role
            </Button>
          }
        >
          <div className="ws-panel-body">
            <p className="ws-hint">
              These presets classify staff responsibilities. Workspace access is
              enforced separately through the account’s assigned school role.
            </p>
          </div>
          <Table
            headers={["Role", "Permissions", "Actions"]}
            rows={y.records.roles.map((role) => [
              role.name,
              <div className="ws-actions">
                {role.permissions.map((p) => (
                  <Badge key={p}>{p}</Badge>
                ))}
              </div>,
              <Button
                variant="outline"
                onClick={() =>
                  setEditor(
                    <RecordDialog
                      title="Configure permissions"
                      collection="roles"
                      initial={role}
                      fields={[
                        { name: "name", label: "Role name" },
                        {
                          name: "permissions",
                          label: "Permissions",
                          type: "multi",
                          options: enumOptions(permissions),
                        },
                      ]}
                      onClose={() => setEditor(null)}
                    />,
                  )
                }
              >
                Configure ACL
              </Button>,
            ])}
          />
        </Panel>
      ) : route === "/staff/allocations" ? (
        <Panel
          title="Class & subject teaching allocations"
          action={
            <Button
              onClick={() =>
                setEditor(
                  <Dialog
                    title="Allocate teacher"
                    onClose={() => setEditor(null)}
                  >
                    <DataForm
                      initial={{
                        id: crypto.randomUUID(),
                        staffId: y.setup.staff[0].id,
                        classSectionId: y.setup.classes[0].id,
                        subject: y.records.subjects[0]?.name ?? "",
                      }}
                      fields={[
                        {
                          name: "staffId",
                          label: "Teacher",
                          type: "select",
                          options: staff,
                        },
                        {
                          name: "classSectionId",
                          label: "Class & section",
                          type: "select",
                          options: classes,
                        },
                        {
                          name: "subject",
                          label: "Subject",
                          type: "select",
                          options: y.records.subjects.map((s) => ({
                            value: s.name,
                            label: s.name,
                          })),
                        },
                      ]}
                      onSave={async (value) => {
                        const row = staffAllocationSchema.parse(value);
                        await mutate(
                          (current) => ({
                            ...current,
                            setup: {
                              ...current.setup,
                              allocations: [...current.setup.allocations, row],
                            },
                          }),
                          "Allocated subject faculty",
                        );
                        setEditor(null);
                      }}
                    />
                  </Dialog>,
                )
              }
            >
              + Allocate faculty
            </Button>
          }
        >
          <Table
            headers={["Class & section", "Subject", "Faculty", "Actions"]}
            rows={y.setup.allocations.map((a) => [
              labelFor(classes, a.classSectionId),
              a.subject,
              labelFor(staff, a.staffId),
              <Button
                variant="outline"
                onClick={() =>
                  setEditor(
                    <Dialog
                      title="Edit faculty allocation"
                      onClose={() => setEditor(null)}
                    >
                      <DataForm
                        initial={a}
                        fields={[
                          {
                            name: "staffId",
                            label: "Teacher",
                            type: "select",
                            options: staff,
                          },
                          {
                            name: "classSectionId",
                            label: "Class & section",
                            type: "select",
                            options: classes,
                          },
                          {
                            name: "subject",
                            label: "Subject",
                            type: "select",
                            options: y.records.subjects.map((s) => ({
                              value: s.name,
                              label: s.name,
                            })),
                          },
                        ]}
                        onSave={async (value) => {
                          const row = staffAllocationSchema.parse(value);
                          await mutate(
                            (current) => ({
                              ...current,
                              setup: {
                                ...current.setup,
                                allocations: current.setup.allocations.map(
                                  (p) => (p.id === a.id ? row : p),
                                ),
                              },
                            }),
                            "Updated faculty allocation",
                          );
                          setEditor(null);
                        }}
                      />
                    </Dialog>,
                  )
                }
              >
                Edit allocation
              </Button>,
            ])}
          />
        </Panel>
      ) : route === "/staff/documentation" ? (
        <Panel title="Faculty comprehensive documentation">
          <Table
            headers={["Staff", "Document checklist", "Verified", "Actions"]}
            rows={y.records.staffProfiles
              .filter((p) => !query.id || p.staffId === query.id)
              .filter((p) =>
                labelFor(staff, p.staffId)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => [
                labelFor(staff, p.staffId),
                p.documents.map((d) => (
                  <p key={d.id}>
                    {d.name}{" "}
                    <Badge tone={d.status === "verified" ? "green" : "amber"}>
                      {d.status}
                    </Badge>
                  </p>
                )),
                `${p.documents.filter((d) => d.status === "verified").length}/${p.documents.length}`,
                <div className="ws-actions">
                  <LinkButton href={`/staff/profile?id=${p.staffId}`}>
                    Update documents
                  </LinkButton>
                  {p.documents.some((d) => d.status === "pending") && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setEditor(
                          <Dialog
                            title="Review documentation"
                            onClose={() => setEditor(null)}
                          >
                            <DataForm
                              initial={{ note: "" }}
                              fields={[
                                {
                                  name: "note",
                                  label:
                                    "Administrative review note (8+ characters)",
                                  type: "textarea",
                                },
                              ]}
                              onSave={async (input) => {
                                const note = (input as { note: unknown }).note;
                                if (
                                  typeof note !== "string" ||
                                  note.trim().length < 8
                                )
                                  throw new Error(
                                    "Add a review note of at least 8 characters.",
                                  );
                                await mutate(
                                  (current) =>
                                    putRecord(current, "staffProfiles", {
                                      ...p,
                                      documents: p.documents.map((d) => ({
                                        ...d,
                                        status: "verified",
                                      })),
                                    }),
                                  `Reviewed staff documents: ${note.trim().slice(0, 100)}`,
                                  { type: "staff-profile", input: { ...p, documents: p.documents.map(d => ({ ...d, status: "verified" })) } },
                                );
                                setEditor(null);
                              }}
                            />
                          </Dialog>,
                        )
                      }
                    >
                      Review checklist
                    </Button>
                  )}
                </div>,
              ])}
          />
        </Panel>
      ) : (
        <>
          <Metrics
            items={[
              { label: "Faculty & staff", value: y.setup.staff.length },
              {
                label: "Teaching allocations",
                value: y.setup.allocations.length,
              },
              {
                label: "Documents pending",
                value: y.records.staffProfiles.filter((p) =>
                  p.documents.some((d) => d.status === "pending"),
                ).length,
              },
              {
                label: "Leave awaiting approval",
                value: y.records.leaves.filter(
                  (l) => l.personType === "staff" && l.status === "pending",
                ).length,
              },
            ]}
          />
          <div className="ws-two-column">
            <Panel title="Staff member & ID">
              <Table
                headers={[
                  "Staff member",
                  "Role & designation",
                  "Department",
                  "Teaching load",
                  "Actions",
                ]}
                rows={rows.map((s) => {
                  const p = y.records.staffProfiles.find(
                    (p) => p.staffId === s.id,
                  );
                  return [
                    <>
                      <LinkButton href={`/staff/profile?id=${s.id}`}>
                        {s.displayName}
                      </LinkButton>
                      <br />
                      <small>{s.id}</small>
                    </>,
                    s.designation,
                    p?.department ?? "Not configured",
                    y.setup.allocations.filter((a) => a.staffId === s.id)
                      .length,
                    <LinkButton href={`/staff/profile?id=${s.id}`}>
                      View profile
                    </LinkButton>,
                  ];
                })}
              />
            </Panel>
            <div>
              <Panel title="Documentation readiness">
                <div className="ws-panel-body">
                  <h3>
                    {
                      y.records.staffProfiles.filter(
                        (p) =>
                          p.documents.length &&
                          p.documents.every((d) => d.status === "verified"),
                      ).length
                    }{" "}
                    complete profiles
                  </h3>
                  <LinkButton href="/staff/documentation">
                    Complete documentation →
                  </LinkButton>
                </div>
              </Panel>
              <Panel title="Daily workforce operations">
                <div className="ws-panel-body">
                  <LinkButton href="/attendance/staff">
                    Mark staff attendance
                  </LinkButton>
                  <p />
                  <LinkButton href="/timetable/substitutions">
                    Proxy & substitutions
                  </LinkButton>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
      {editor}
    </>
  );
}
