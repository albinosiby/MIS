# Setup Wizard Verification

Implemented from Figma screen `1106:11238` using the `albino` account. The page is available at `/school-setup`; `/` redirects to it. The design-system catalogue remains at `/design-system`.

## Implemented behaviour

The school shell, overview, metrics, eight phases, exception table, compliance panel, authority panel and snapshot section follow the supplied frame. Original Figma icons and portraits are downloaded under `public/assets/school-setup`. Poppins and the PDF brand colours are reused; the source's mixed Inter/Poppins typography is normalised to the requested design system.

Search matches student, guardian and GRN. Category filtering and six-row pagination work. Row selection supports checked and indeterminate states. Review dialogs require an eight-character note before removing a row from local preview state. Phase buttons show context. Bulk notification actions prepare a local preview only. Signing, backup, profile, calendar and other unconnected actions explain their current scope rather than claim success. The validation button demonstrates a pending state and reports remaining preview exceptions.

## Checks

- TypeScript type checking and a Next.js Webpack production build pass.
- Browser checks covered category filtering, page two and return navigation, student search, empty results, review-dialog submission, row-count changes, select-all and bulk notification confirmation.
- A 1440px iframe viewport was used to review the desktop screen because the app's browser panel is narrow. Temporary verification HTML is removed from the deliverable.
- At desktop size, all displayed image assets loaded and every exported icon's rendered dimensions matched its SVG root dimensions within subpixel rounding.
- Mobile layouts were checked at 375px and 491px widths with no document-level horizontal overflow. Tables and the view strip deliberately scroll within their own containers.
- Browser error/warning logs were empty during the checked interactions.

Desktop reference: `screenshots/school-setup-desktop.png`.

The subsequent model/schema refactor passed 12 automated domain tests, type checking and a production build. It adds field-level review errors and shared typed props. Browser verification of those updates was blocked by the app browser's URL security policy, so the screenshot and interaction checks above refer to the initial UI implementation. See `models-and-validation.md` for the new contracts and exact validation coverage.

## Remaining integration work

The screen is a frontend preview with in-memory sample data. No authenticated school membership, database, real correction workflow, school administration service, messaging, CBSE/UDISE/DigiLocker connector, backup service or digital-signature provider is connected. The visible status values reproduce the supplied design and do not certify statutory compliance or live service health.

Six visible records come from Figma. The two extra page-two records are explicitly labelled synthetic samples; their names and details were not supplied as a second Figma page. Reloading resets all preview changes. The design's displayed date and KPI values are fixed sample content.
