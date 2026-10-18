# Operational workflows and finance reconciliation

Approved scope: finish connected school workflows using existing feature schemas, operation records, shared school/year models and visual components. Gateway, bank feeds and external providers stay disconnected.

Sequence: (1) circulation and reservation fulfilment, (2) residence allocations/outpasses, (3) dated transport allocations and safe dispatch/boarding, (4) procurement/stock integrity, (5) service invoices and imported bank-statement reconciliation.

Architecture: contextual mutation guards live in each owning feature's domain. New request contracts are inferred from Zod. The existing authenticated workflow endpoint and canonical CAS transaction persist operations and their downstream invoices/journals atomically. Bank statements are bounded immutable snapshots with explicit matches; importing a statement never creates money or changes a payment. A separate finance identity closes the statement after all lines match and balances agree. Account names identify a ledger account, never bank credentials.

Assumptions: INR amounts are entered as rupees in screens and stored as integer minor units; statement amounts are signed (credit positive). Charges are explicit monthly invoices, not inferred tariffs. Existing historical rows remain readable; new safety rules apply to new mutations. Corrections use compensating records, preserving posted history. Partial purchase receipts allocate the approved order cost cumulatively in integer minor units. Automated routing and live GPS are separate integrations.

Risks: existing JSON workspace remains a bounded transitional datastore; CAS prevents lost updates but normalized tables will be needed at scale. Legacy loose records may require explicit repair before progression. No live bank connectivity, payment execution or statutory certification is implied.

Verification: invalid/cross-school requests, inactive students, queue priority, double allocations, expired dispatch, unsafe trip completion, negative stock and duplicate reconciliation; lifecycle domain tests, authenticated live synthetic flows, role denials, production build and targeted browser verification. Never alter existing account memberships for these tests.
