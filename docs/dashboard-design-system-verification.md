# Dashboard design-system implementation

Date: 19 October 2026. Branch: `codex/figma-school-admin-screens`.

## Scope and source

The user approved the first row of school admin screens, starting with Dashboard. This change implements the Dashboard presentation at `/dashboard` using the supplied PDF design system and existing validated workspace data. The other first-row screens retain their existing implementations pending their own design pass.

Target Figma frame: `1106:4493` in file `7hcXAtbVJacV9atgx2f9Ii`. Both detailed-context and screenshot requests using the requested `albinosiby1@gmail.com` account returned the Starter-plan tool-call limit. Exact Figma parity remains unverified; this implementation is explicitly based on the approved design system.

## Implementation

- Dedicated `OperationsDashboard` component composed from shared buttons, inputs, panels, badges and table; existing shell and workflows retained.
- Poppins, primary `#2F4FD8`, secondary `#0333C0` and background `#F8FAFC` remain centrally defined in the supplied token system. Dashboard CSS is scoped to its wrapper.
- Six linked campus metrics, all nine admissions stages, setup completion, paginated class capacity, action queue, upcoming published events, exam readiness and recent notifications.
- Counts and amounts derive from the selected school-year workspace. Fee collection totals deduct refunds. The pipeline is a current-stage distribution, not a cumulative conversion chart.
- Explicit attendance/event reference date constrained to the academic year; absent attendance is displayed as unavailable rather than 0%. Other metrics identify their academic-year scope.
- Existing global search filters class capacity, events and notifications. Empty results explain what is missing. Metric cards continue to show school-year totals.
- No API, database, permission, authentication, persisted schema or deployment changes. No new dependencies. Dashboard icons use the existing Lucide library; no new imagery or remote Figma assets are introduced.

## Verification

- `npm test`: 164 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run build`: passed; compilation, TypeScript and all 42 static pages completed.
- `git diff --check`: passed.
- Browser review used an isolated copy with fresh synthetic local accounts and a separate origin on port 3011. Existing local accounts rejected the fixture password, so no existing account or school data was reset.
- Desktop at 1280px and 1440px and mobile at 390px: reviewed greeting/actions, tabs, metric geometry and responsive layout. Mobile document width matched viewport width (390px); the table and tab strip retain their own horizontal scrolling. At 1440px the main panels use two columns with no document overflow.
- Native date keyboard interaction updated attendance to the explicit no-marks state; reference dates stayed within the configured academic year.
- Class capacity Next changed rows 1–8 to rows 9–10; search produced event/notification and class empty results.
- The Approvals tab opened the existing approvals screen and browser Back returned to Dashboard.
- No console warning/error entries during the Dashboard interaction review.
- Screenshots contain synthetic records only: `docs/screenshots/dashboard-design-system-desktop.png` and `docs/screenshots/dashboard-design-system-mobile.png`.

## Remaining verification

Retrieve detailed Figma context and screenshot after the requested connector account has quota. Compare spacing, typography, assets and frame-specific states then. Browser review was against synthetic local data; hosted account/data integration was not re-audited for this presentation change.
