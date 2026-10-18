# Library, residence, transport, procurement and bank reconciliation

## Library

Use Catalogue → Copies → Reservations → Circulation. An active title and free physical copy are required. The first pending reservation has issue priority. Issue the matching copy before collecting a reservation; return the physical copy instead of cancelling an issued loan. Renewals cannot leave the academic year or bypass another student's waiting reservation. A fine must belong to the student's own loan. New fines create invoices atomically; finance can explicitly link historical fines from Bank reconciliation. Collect the linked invoice, or approve a concession, before settling the fine.

## Residence

Allocate a bed for a bounded date range; both bed and student are checked for overlapping active allocations. Outpasses, visitors and roll call need a covering active allocation. Parent portal → Consents now includes pending linked outpasses. The linked parent/guardian can respond; this records their authenticated response and leaves the school's approval step pending. A record-view relationship is not proof of custody or legal authority: school staff must verify authority and any restrictions before approving departure. Staff may record a verified offline guardian response using the existing requested-outpass form. Departure, return and checkout retain actor/timestamp history. A departed pass cannot be cancelled, roll call must agree with the recorded departure, and open outpasses block checkout.

## Transport

Create vehicle → route stops → driver assignment → Passenger allocations → Trip. A passenger allocation includes route, stop and dates. Dispatch requires an active insured vehicle, a licensed assigned driver, no concurrent vehicle/driver trip, and passengers within capacity. Dispatch creates the waiting roster atomically. Record boarding then alighting; explicitly cancel waiting no-shows. Resolve Incident/SOS alerts before completion. A boarded student cannot be cancelled and open rosters block ending their transport allocation. Activation/end updates the student's family transport view. Drivers see only assigned route relations and passengers and cannot edit vehicle masters.

## Inventory and procurement

Create vendor and item → draft/submit/approve purchase. Either receive the whole order using its existing receive action or use Purchase receipts for partial deliveries. Every posted delivery records stock and a balanced payable journal together. Delivery quantities and references are checked; partial receipts apportion cost cumulatively using exact integer arithmetic, and the final delivery completes the order. A partially received order cannot bypass its remaining delivery or be cancelled. Issuing stock cannot create a current or historical negative balance; departmental returns cannot exceed that department's outstanding issues. Posted movements, deliveries and received orders preserve history.

Finance → Vendor payments records an already completed offline bank payment; it never sends money. Amounts cannot exceed the received unpaid liability and bank references cannot be duplicated. Posting debits Trade payable and credits Bank. Posted payout journals appear as negative statement-match candidates. Automated purchasing, bank execution and supplier integrations are not connected.

## Charges and reconciliation

Finance → Bank reconciliation provides monthly hostel/transport invoices and explicit legacy fine invoicing. Monthly charges require an active allocation overlapping that month and cannot be issued twice for the same allocation/month, including a previously voided invoice. Use reviewed concessions/corrections rather than reissuing duplicate charges.

Import CSV with exact headers `date,reference,amount`. Dates use YYYY-MM-DD. Amounts are signed rupees with up to two decimals; bank credits are positive, debits negative. Each statement accepts 1–300 lines, verifies arithmetic/date bounds and rejects duplicates/overlaps. This workspace currently has one school Bank ledger/account label; multiple bank subledgers are not supported.

Match each line to an existing posted Bank journal with the same date and signed amount. Imports never create payments or accounting entries. Incorrect matches can be corrected with a reason while retaining their original audit; completely unmatched open statements can be voided with a reason, then reimported. Closed statements cannot be rewritten. A different finance user from the importer and active matchers must reconcile the statement. Every statement line and Bank journal in that period must match, and the opening balance must equal the ledger. Closure locks the bank period, including earlier backdated postings that would change its opening. Correct bank/ledger differences before closing; create reviewed entries in an open period after closure.

The older payment reconciliation register now requires a completed non-cash payment and an imported matched statement; final reconciliation requires that statement to be closed. General statement matching also covers offline vendor payments, refunds and expense journals.

## Persistence and contracts

All screens reuse shared person/school/year models, inferred feature contracts, existing form components, authenticated commands and canonical compare-and-swap writes. New bank statement state defaults to an empty collection for existing workspaces. No new tables or migrations are required for this additive JSON document model. The service key remains server-only and unauthenticated clients cannot invoke the workspace commit RPC. At scale, move bounded document collections into normalized tenant-scoped tables.

Run `npm test`, `npm run typecheck`, `npm run build`, `npm run audit:ui`. With the configured synthetic project and server running, `node scripts/verify-operational-finance-live.ts` appends labelled QA records and exercises existing accounts without altering memberships. It preserves original people. Independent authenticated bank closure needs a separate finance login; domain tests cover the successful closure and immutable-period rules. The worker must restart after workspace schema changes and should be checked serially after mutations using `node scripts/verify-worker-runtime.ts`.

Record integrity compares validated JSON values independently of object key order, while preserving array/audit ordering. This prevents PostgreSQL JSONB key normalization from falsely classifying an unchanged reviewed record as edited. Family-authored open reservations can be cancelled; immutable operational detail forms do not advertise an edit action.
