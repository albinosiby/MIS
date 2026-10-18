# School Admin Design System

## Confirmed visual foundations

Source: the supplied one-page School Design System.pdf, visually inspected on 17 October 2026. Follow these values across school modules. Do not redesign existing Figma screens around a different theme.

| Token | Confirmed value | Implementation |
|---|---|---|
| Typeface | Poppins | Locally bundled `@fontsource/poppins` |
| Regular | 400 | Body and field content |
| Medium | 500 | Labels and actions |
| SemiBold | 600 | Titles and emphasis |
| Primary | `#2F4FD8`, Strong Blue | `--primary`, `bg-primary`, `text-primary` |
| Secondary | `#0333C0`, Blueberry Blue | `--secondary`, `bg-secondary`, `text-secondary` |
| Background | `#F8FAFC`, Light Grayish Blue | `--background`, `bg-background` |

The typography sheet repeats the SemiBold label in its fourth example. A separate fourth weight is not inferred; inspect Figma styles before adding another weight.

## Provisional supporting decisions

The PDF does not specify numerical font sizes, spacing, radii, shadows, control heights, breakpoints, focus styles, validation colours or dark mode. The scaffold uses an 8px base radius, 4px spacing unit and 44px minimum button/input heights. These are implementation defaults to reconcile with Figma, not source specifications.

White surfaces, slate text, borders, semantic status colours and hover/focus states are also provisional. Light mode is the only supplied theme; do not invent dark mode during screen implementation. Desktop and mobile layouts must be checked against actual frames and approved responsive rules. The preview is a component catalogue, not a recreation of a missing application frame.

## Components

| Component | File | Contract |
|---|---|---|
| Button | `src/components/ui/button.tsx` | Primary, secondary, white/outline, ghost and destructive variants; disabled state; defaults to `type=button`; use a link via `asChild` for navigation |
| Input | `src/components/ui/input.tsx` | Native text, search, email, date and other browser types; explicit visible label and validation wiring at call site |
| Select | `src/components/ui/select.tsx` | Native labelled select with keyboard and mobile support |
| Switch | `src/components/ui/switch.tsx` | Radix switch supporting controlled/uncontrolled use, disabled state and keyboard operation |
| Checkbox | `src/components/ui/checkbox.tsx` | Radix checkbox supporting checked, unchecked, indeterminate and disabled states |
| Field | `src/components/ui/field.tsx` | Label and optional description; control ID must match; connect description with `aria-describedby` |

These are local project primitives using shadcn conventions, not a claim that the entire shadcn library is installed. `components.json` allows future component additions to use the same paths and theme. Review generated styles and dependencies before importing additional controls.

## Usage rules

Use semantic token names in components. Define new reusable visual values in `tokens.css`; do not scatter raw brand hex codes across features. Use Lucide for interface icons unless Figma supplies an approved brand asset. Decorative icons are hidden from assistive technology; icon-only controls need accessible names.

Keep keyboard focus visible and supply labels independent of placeholders. Status must be communicated with text or icons as well as colour. Tables need headers, numerical alignment and an explicit narrow-screen strategy. Respect reduced-motion preferences. Restrict private student files to authorised storage; never put them in `public/`.

For controls that create data, add pending, success and error states when the workflow exists. Do not present a preview interaction as a persisted school action. Dates use native inputs now; a Figma calendar component can be added later without embedding locale-dependent parsing in shared primitives.

## Figma reconciliation

Before implementing a screen, inspect typography sizes and line heights, exact geometry, component variants, shadows, icon assets, responsive changes, density and loading/empty/error states. Reuse these primitives and update central tokens when exact design values become available. Record the selected node URL and mapping in `docs/figma-handoff.md`.
