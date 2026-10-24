# Figma Implementation Handoff

## Dashboard update — 19 October 2026

The first-row implementation sequence is approved, starting with Dashboard `1106:4493`. `/dashboard` now uses a dedicated design-system presentation with existing validated school-year records, responsive cards, admissions stage distribution, setup progress, class capacity and operational priorities. Detailed context and screenshot requests on `albinosiby1@gmail.com` remain blocked by its Starter-plan quota; exact Figma parity is pending. See [Dashboard verification](dashboard-design-system-verification.md) for passing checks, browser coverage and synthetic-data screenshots. Other first-row screens await their individual design pass.

## Current state

The Setup Wizard has been read and implemented using the `albino` connection, verified as `albinosiby1@gmail.com`. Source: [School Admin Web section](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1106-188). No Figma content has been modified.

The section contains the broader application. The implemented screen is [S1. 1. Setup Wizard](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1106-11238). Its initial metadata was sparse, so full code context was retrieved separately for the header, sidebar, greeting, metrics, pipeline and workspace. The screenshot was used as a reference, not an application background.

## Input needed

For subsequent screens, provide a node-specific link or identify a frame from the connected file. Use the `albino` connection for this project. Re-inspect tool schemas if connection selection changes; do not assume a global active-account selector exists.

## MCP workflow

1. Load the Figma design-to-code skill and discover the connected Figma tools.
2. Request design context for the supplied frame with the required screenshot. Use the screenshot as the visual target, never as a full-screen implementation image.
3. If context is sparse, inspect the visible child nodes before implementation.
4. Compare the returned component mappings with `src/components/ui`, styles and existing dependencies. Reuse mapped project components where suitable.
5. Reconcile precise token measurements and states. Keep confirmed PDF brand values unless an explicit design change resolves a conflict.
6. Add approved static assets locally using the connector's instructed asset workflow; avoid temporary Figma asset URLs in application code.
7. Build the screen within the appropriate feature and compose it through a thin route. Match the Figma layout using responsive CSS rather than copying absolute positions indiscriminately.
8. Verify layout, fonts, keyboard behaviour, mobile overflow and interaction states against the frame. Document data integrations that remain unconnected.

Figma write operations and creating a new Figma file are not required for reading and implementing an existing design. Do not recreate the supplied designs in Stitch.

## Mapping record

| Figma reference | Project destination | Status |
|---|---|---|
| Supplied design-system PDF | `src/styles/`, `src/components/ui/` | Foundations implemented; dimensional values provisional |
| Header `1106:11313` and sidebar `1106:11346` | `src/components/layout/` | Implemented with original exports |
| Greeting `1106:11241`, metrics `1106:11434` | `src/features/school-setup/components/setup-overview.tsx` | Implemented |
| Pipeline `1106:11478` | `src/features/school-setup/components/setup-pipeline.tsx` | Implemented with phase detail dialogs |
| Workspace `1106:11617` | `src/features/school-setup/components/` | Table and governance UI implemented with sample data |
| Academic setup frames | `src/features/academics/` | Awaiting URL and design context |
| Staff frames | `src/features/staff/` | Awaiting URL and design context |

Add precise file/node links as each frame is inspected. Do not mark a module complete based on a folder, screenshot or generated preview alone.

The Figma workspace body uses Inter in several layers while the supplied design system prescribes Poppins. The implementation consistently uses the requested Poppins family and blue brand tokens. Layout is responsive rather than copying the source's absolute positions; the table scrolls horizontally to reach the discrepancy and action columns. The compliance and signature indicators reproduce design sample content, not verified integrations.
