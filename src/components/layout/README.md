# Shared Application Layout

`school-shell.tsx` implements the sidebar, search, academic-year display, principal profile and responsive navigation from the user's Setup Wizard frame. `figma-assets.ts` maps downloaded exports to their local paths and preserves SVG dimensions; `figma-asset.tsx` renders those exports without stretching them. School-specific business rules and records remain in features. Other navigation items open an explanation until their screens are implemented. Hidden navigation is not server-side authorisation.
