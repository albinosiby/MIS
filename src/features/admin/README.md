# Platform administration

This folder owns platform administration: institution registration, account
management, institution inspection, audit history and support request handling.

- `components/`: admin views, account activation and school support presentation.
- `schemas/`: runtime validation composed from shared domain schemas.
- `models/`: schema-inferred contracts.
- `domain/`: framework-independent policy and provisioning operations.
- `server/`: authenticated authorization, persistence and HTTP error handling.
- `data/`: operation form definitions.
- `styles/`: platform presentation styles.

Pages are composed in `src/app/(admin)/platform/[[...screen]]/page.tsx`.
The route group is organizational; public URLs remain `/platform/...` and
`/api/platform/...`. Platform login remains `/login/platform`.

School support and account activation routes reuse this feature's components
and schemas. Shared school entities remain in `src/shared/`; identity and
school membership checks remain in the identity feature. Every platform server
operation must verify the authenticated platform operator, independently of
the route folder.
