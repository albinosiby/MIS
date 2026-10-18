"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const colors = [
  { name: "Primary", value: "#2F4FD8", description: "Strong Blue", className: "bg-primary text-primary-foreground" },
  { name: "Secondary", value: "#0333C0", description: "Blueberry Blue", className: "bg-secondary text-secondary-foreground" },
  { name: "Background", value: "#F8FAFC", description: "Light Grayish Blue", className: "border border-border bg-background text-foreground" },
];

export function DesignSystemShowcase() {
  const [message, setMessage] = useState("");
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-5 py-12 sm:px-10 sm:py-20">
      <header className="mb-16 border-b border-border pb-10">
        <p className="mb-3 text-sm font-medium text-primary">School Admin Web</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Design system</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Shared foundations for the school web application. Brand colours and Poppins follow your supplied design sheet. Component sizing and supporting colours await Figma confirmation.</p>
      </header>

      <section aria-labelledby="type-heading" className="mb-14">
        <h2 id="type-heading" className="mb-6 text-xl font-semibold text-primary">Typography</h2>
        <div className="grid gap-6 rounded-xl border bg-card p-6 sm:grid-cols-2 sm:p-8">
          <div className="flex min-h-40 items-center justify-center rounded-lg bg-muted text-4xl font-semibold text-primary">Poppins</div>
          <div className="grid content-center gap-5 text-xl">
            <p className="font-normal">Poppins <span className="ml-3 text-sm text-muted-foreground">Regular · 400</span></p>
            <p className="font-medium">Poppins <span className="ml-3 text-sm text-muted-foreground">Medium · 500</span></p>
            <p className="font-semibold">Poppins <span className="ml-3 text-sm text-muted-foreground">SemiBold · 600</span></p>
          </div>
        </div>
      </section>

      <section aria-labelledby="color-heading" className="mb-14">
        <h2 id="color-heading" className="mb-6 text-xl font-semibold text-primary">Colour</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {colors.map((color) => (
            <figure key={color.name}>
              <div className={`flex aspect-[1.5] flex-col justify-between rounded-xl p-5 sm:aspect-square ${color.className}`}>
                <span className="text-sm font-medium">{color.name}</span>
                <span className="self-end text-sm font-semibold">{color.value}</span>
              </div>
              <figcaption className="mt-3 text-sm font-medium text-primary">{color.description}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="buttons-heading" className="mb-14">
        <h2 id="buttons-heading" className="mb-6 text-xl font-semibold text-primary">Buttons and selection</h2>
        <div className="space-y-8 rounded-xl border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" onClick={() => setMessage("White filled button selected. This is a component workspace.")}>White Filled Button</Button>
            <Button onClick={() => setMessage("Primary action selected. This is a design-system component preview.")}><Plus aria-hidden="true" />Add Academic Event</Button>
            <Button disabled>Disabled button</Button>
          </div>
          <div className="flex flex-wrap gap-8">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm"><Switch defaultChecked />Notifications on</label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm"><Switch />Notifications off</label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm"><Checkbox defaultChecked />Selected</label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm"><Checkbox />Unselected</label>
          </div>
          <p role="status" className="min-h-5 text-sm text-muted-foreground">{message || "Preview only: selections are not saved."}</p>
        </div>
      </section>

      <section aria-labelledby="inputs-heading">
        <h2 id="inputs-heading" className="mb-6 text-xl font-semibold text-primary">Input fields</h2>
        <div className="grid gap-6 rounded-xl border bg-card p-6 sm:grid-cols-2 sm:p-8">
          <Field id="search" label="Search" description="Visual example; no school records are connected.">
            <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" /><Input id="search" type="search" aria-describedby="search-description" className="pl-10" placeholder="Search students, GRN, parents, receipts…" /></div>
          </Field>
          <Field id="birth-date" label="Date of birth"><Input id="birth-date" type="date" /></Field>
          <Field id="language" label="Language"><Select id="language" defaultValue="mr-en"><option value="mr-en">Marathi / English</option><option value="en">English</option><option value="mr">Marathi</option></Select></Field>
          <Field id="group" label="Group"><Select id="group" defaultValue=""><option value="" disabled>Select Group</option><option value="primary">Primary</option><option value="secondary">Secondary</option></Select></Field>
          <Field id="term" label="Academic term"><Select id="term" defaultValue="term-2"><option value="term-2">Term 2: Nov 01, 2026 – Mar 31, 2027</option><option value="term-1">Term 1: Jun 01, 2026 – Oct 31, 2026</option></Select></Field>
          <Field id="invalid-example" label="Validation state" description="Example error: enter a valid school email address."><Input id="invalid-example" type="email" defaultValue="example" aria-invalid="true" aria-describedby="invalid-example-description" /></Field>
        </div>
      </section>
      <footer className="mt-12 border-t pt-6 text-xs leading-6 text-muted-foreground">Foundation preview · No authentication, school data, or backend integrations are connected.</footer>
    </main>
  );
}
