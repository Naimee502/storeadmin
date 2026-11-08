# Local-first (offline) billing

Goal: work like Vyapar. Every write is saved on the device first and synced to the server; the app keeps working without internet.

## Decisions
- Switch: `AdminSettings.offlineBilling` per business (Business Settings). Existing businesses: off until the admin turns it on (no default on the schema). New businesses: set `true` in `createAdmin`. Device setting in Settings: Business setting / On / Off.
- Numbers: the business's main series is the only final number. Online, the create is sent at once and the server's number is used if it answers within 3 s. Offline (or no answer), the bill shows a provisional device number; on sync the server gives it the next main-series number and keeps the device number in `offlineNumber`.
- Device numbers (provisional only): `A/000123` invoice and order, `CN-A/000012` sales return, `#PAY-A/000012` receipt. Codes come from `registerOfflineDevice` and are never reused.
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
- `syncPull(collections: [String!]!, since: String): SyncPull!` → `{ serverTime, changes: [{ collection, docs: JSON, deletedIds: [ID!]!, nextSince }] }`. Docs are shaped like the module's list query items. Tenant comes from the login. `since` null means full pull. Max 5,000 docs per collection per call; `nextSince` set means pull that collection again from it.
- Collections: `salesinvoice, salesorder, salesreturn, payment, product, account, ledger, unit, category, subcategory, brand, model, size, productgroup, branch, staff, pricelist, priceassignment, chargerule, adminsettings`; later `purchaseinvoice, purchaseorder, purchasereturn, stockadjustment, transferstock, expensenote, transaction`.
- Creates accept `clientRequestId`; a device number sent as `billnumber`/`paymentcode` is moved to `offlineNumber` and the main series numbers the document. Edits accept `expectedUpdatedAt` (`CONFLICT` with `current`).

## Apps (`clientapp`, `clientweb`)
One file, identical in both: `clientapp/src/apollo/offline.ts` = `clientweb/src/graphql/offline.ts` (edit one, copy to the other). It is an Apollo link; screens need no change.
- Writes: `AddSalesOrder`, `AddPayment`, `AddSalesReturn` get a `clientRequestId`. No answer within 3 s or no network: saved in the device queue (per user) and synced later; the number shows `Pending sync` until the server numbers it in the main series. `EditSalesOrder`, `MarkSalesOrderDelivered`, `MarkSalesInvoiceDelivered`, `MarkVisit` are queued only when offline.
- Pending documents: shown at the top of `getSalesOrders`, `getPayments`, `getMySalesReturns` (only in lists whose party/salesman filter matches) and open by id (`offline-<id>`). Edit or delete of a pending document changes the queued create. After a create syncs, later queued entries get its server id.
- Reads: queries are saved per user (AsyncStorage / localStorage, max 3.5 MB). Offline, a query is answered from the saved copy; online reads never use it.
- Sync: on any successful request, every 30 s, and on the browser `online` event. Server errors drop the entry with a message; network errors keep it.
- Images: app `AppImage` (FastImage, `immutable`) keeps every image it showed on disk. Website `public/sw.js` keeps images it showed (newest 800) and the site itself, so an offline reload still opens. An image never shown online cannot appear offline; cart, checkout and order detail then hide the broken image.
- Status: header pill like the admin (`Offline` / `Syncing` + `N pending`, hidden when online with nothing pending): app `components/header.tsx`, website `components/header`. Sync messages: app Snackbar, website banner (`layouts/main`).
- Pending numbers: `PENDING_SYNC`, `pendingBadge` (app `utils/formatters.ts`) and `pendingClass` (website `utils/orders.ts`) show `Pending sync` as an indigo badge in order and payment lists.
- Not offline in the apps (by design): stock and outstanding are the last synced values; new parties, catalogue and masters need the network.
- Test: `node test.js` style check with a fake server (offline create, list/detail of pending, edit merge, id swap, 3 s timeout, no duplicate) passes on Apollo 3 (web) and 4 (app).

## Deploy
Server first, then client (the client asks for `offlineBilling` and `syncPull`).

## Phase 2 contract (purchase and stock)
- `syncPull` adds `purchaseinvoice, purchaseorder, purchasereturn, stockadjustment, transferstock`, shaped like their list queries.
- Their create mutations run through `createOnce` (`clientRequestId`, business from the login).
- Device numbers stay provisional: `A/000123` purchase invoice and order, `DN-A/000012` purchase return, `SA-A/000012` stock adjustment, `TR-A/000012` transfer; the server moves them to `offlineNumber` and the main series numbers the document. Edits never take a device number.
- Edit, cancel and delete of these documents accept `expectedUpdatedAt` (`CONFLICT` with `current`).
- Local stock: purchase invoice adds, purchase return removes, adjustments add or remove, a transfer moves stock between branches; vendor balance follows purchase invoices, returns and payments.

## Phases
1. Foundation: business switch, `syncPull`, `localdb`, local reads, hybrid numbers, disconnect alert, dashboard offline. Billing screens (invoice, order, POS, return, receipt).
2. Purchase and stock: purchase invoice/order/return, stock adjustment, transfer.
3. Masters and expenses edited offline.
4. Reports from local data.
5. Apps: sales (order, payment, sales return, delivery, visit) done in `clientapp` and `clientweb`.

## Status (handoff: read this first)
Branch `feature/server-paging-clear-offline`. One commit per finished step; never commit `.DS_Store`, builds, `dist`, notes or test scripts.
- Done and committed: Phase 1 (admin client + server), Phase 2 contract, Apps sales.
- Phase 2 in progress, NOT committed (26 files): server models/schemas/resolvers for purchase invoice/order/return, stock adjustment, transfer stock, `offlinedevice`, `utils/offlinesync.ts`; client `offline/core, docs, localdb, offlinelink, OfflineStatusBar` and purchase invoice/order/return addedit pages. Server `tsc` 0 errors. Next: client stock adjustment and transfer screens, local stock/vendor balance rules above, API tests, then commit.
- Next cleanup: `client/src/offline` has 19 files; merge the small ones (`network`, `saved`, `userkey`, `OfflineHeaderStatus`, `sw`) into their callers after Phase 2 is committed, so no two changes touch the same files.
- Checks: `vite build` needs the Mac (node_modules are macOS binaries); run it there before deploy.
