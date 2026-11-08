# Local-first (offline) billing

Goal: work like Vyapar. Every write is saved on the device first and synced to the server; the app keeps working without internet.

## Decisions
- Switch: `AdminSettings.offlineBilling` per business. Existing businesses: off until the admin turns it on (no default on the schema). New businesses: set `true` when their settings row is created. A device switch can still turn it off on one device.
- Numbers (hybrid): online, the create is sent at once and the server's main number is used if it answers within 3 s; otherwise the bill takes the device series. Offline always uses the device series.
- Device series: `A/000123` invoice and order, `CN-A/000012` sales return, `#PAY-A/000012` receipt. Codes come from `registerOfflineDevice` and are never reused.
- Conflicts: the first change to reach the server wins; a later stale edit goes to "Needs review" (Apply mine / Discard mine). Edits send `expectedUpdatedAt`.
- Server stays the source of truth for stock, journals and numbering; the device shows its own pending changes on top of the last synced data.

## Client (`client/src/offline`)
- `localdb` (IndexedDB): records per collection (`collection:id`), the outbox and meta (last pull time, device, counters).
- Pull: `syncPull` on start, on reconnect and every few minutes; first run is a full pull.
- Push (outbox): write the local record, queue the operation, push. Creates carry `clientRequestId`; temp ids `offline-<id>` are swapped for server ids after sync.
- Reads: online queries go to the server. Without network, registered queries (lists, pages, by-id, dropdown lists, dashboard lists) are answered from `localdb` plus pending local records.
- UI: the header dot is the only status (Online / Offline, pending, needs review). When the network drops and the business has offline billing, an alert says bills will sync later. If it is off, the alert offers to turn it on for this device.

## Server contract
- `AdminSettings.offlineBilling: Boolean` (read and update through the existing settings query/mutation).
- `syncPull(collections: [String!]!, since: String): SyncPull!` → `{ serverTime, changes: [{ collection, docs: JSON, deletedIds: [ID!]! }] }`. Docs are shaped like the module's list query items. Tenant comes from the login. `since` null means full pull.
- Collections: `salesinvoice, salesorder, salesreturn, payment, product, account, ledger, unit, category, subcategory, brand, model, size, productgroup, branch, staff, pricelist, priceassignment, chargerule, adminsettings`; later `purchaseinvoice, purchaseorder, purchasereturn, stockadjustment, transferstock, expensenote, transaction`.
- Creates accept `clientRequestId`; device numbers are validated (`INVALID_DEVICE_NUMBER`, `DUPLICATE_NUMBER`); edits accept `expectedUpdatedAt` (`CONFLICT` with `current`).

## Phases
1. Foundation: business switch, `syncPull`, `localdb`, local reads, hybrid numbers, disconnect alert, dashboard offline. Billing screens (invoice, order, POS, return, receipt).
2. Purchase and stock: purchase invoice/order/return, stock adjustment, transfer.
3. Masters and expenses edited offline.
4. Reports from local data.
5. `clientapp` on the same contract.
