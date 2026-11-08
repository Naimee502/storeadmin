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
- Sync: on any successful request, every 30 s, and on the browser `online` event. Website status also follows the browser `online`/`offline` events (`setOnline`); the app turns Offline on the first failed request. Server errors drop the entry with a message; network errors keep it.
- Images: app `AppImage` (FastImage, `immutable`) keeps every image it showed on disk. Website `public/sw.js` keeps images it showed (newest 800) and the site itself, so an offline reload still opens. An image never shown online cannot appear offline; cart, checkout and order detail then hide the broken image.
- Attendance, expense claims, leave, announcements: `punch`, `AddExpenseClaim` (create, `Pending sync` number, status `pending`), `EditExpenseClaim`, `CancelExpenseClaim`, `addLeaveRequest`, `cancelLeaveRequest`, `MarkAnnouncementRead` are queued offline. A queued punch is sent with `offline: true` (the time is the phone's clock); the admin Attendance page shows "Offline punch". The punch screen follows the last queued punch (`getOpenPunch`), so the same punch is never offered twice.
- Photos offline (app): `uploadImage` returns a `pending-upload:` marker when there is no network; the photo is uploaded on sync before the entry that uses it, and `resolveMediaUrl` shows the phone file meanwhile.
- Status: header pill like the admin (`Offline` / `Syncing` + `N pending`, always shown: Online / Offline / Syncing): app `components/header.tsx`, website `components/header`. Sync messages: app Snackbar, website banner (`layouts/main`).
- Pending numbers: `PENDING_SYNC`, `pendingBadge` (app `utils/formatters.ts`) and `pendingClass` (website `utils/orders.ts`) show `Pending sync` as an indigo badge in order and payment lists.
- Not offline in the apps (by design): stock and outstanding are the last synced values; new parties, catalogue and masters need the network.
- Test: `node test.js` style check with a fake server (offline create, list/detail of pending, edit merge, id swap, 3 s timeout, no duplicate) passes on Apollo 3 (web) and 4 (app).

## Phase 3 contract (masters and expenses)
- Server: `withOfflineWrites` (utils/offlinesync.ts), applied in `graphql/resolvers/index.ts`, gives units, categories, sub categories, brands, models, sizes, product groups, products, accounts, ledgers, expense notes and transactions one create per `clientRequestId` and `expectedUpdatedAt` on edit/delete (`CONFLICT` with `current`). Types that had no `updatedAt` serve it as ISO.
- `syncPull` also serves `purchaseinvoice, purchaseorder, purchasereturn, stockadjustment, transferstock, expensenote, transaction`.
- Client: masters are queued like bills but take no device number (`MASTER_TYPES` in `core`). Offline lists, pages and by-id reads include pending masters; a bare id on a pending master shows the name from local records (`refById`). A bill that uses an offline party or product waits for it to sync, then gets its server id.
- Settings masters too: account groups, channels, charge rules, price lists, price assignments, sales routes, holidays, leave types (same helper; `syncPull` adds `accountgroup, channel, salesroute, holiday, leavetype`).
- Status actions (`kind: "action"`, `patch` in `OP_SPECS`): confirm, dispatch, deliver and delivery-boy assignment on sales orders and invoices; confirm and received on purchase orders. Server: `withOfflineActions` adds `expectedUpdatedAt`.
- Online only, on purpose: login/OTP/registration, subscriptions, branches and staff accounts (they carry passwords), business settings and permissions, restore and clear of deleted entries (deleted records are not kept on the device), order-to-invoice conversion and payment re-allocation in the admin (they create or move money entries the user must see), product import, leave and claim approvals, sending announcements and reminders, live location, uploads.
- Payment collection in the apps: `AddPayment` is queued. Offline the allocation preview is unavailable, so an on-account receipt is saved (settling bills always needs the user to see and approve the split); invoice-wise receipts use the bills last loaded online.

## Phase 4 (reports)
- Reports that read list queries (sales, purchase, GST, party, product, salesman, accounting, analytics, stock, delivery-boy orders and payments) work offline: those queries are answered from localdb plus this device's pending documents, and the page computes the report as online.
- Local reads apply the report date filters exactly as the server does (`inDateRange` in `core`): `<field>From/To` on date strings with To covering the whole day, `dateFrom/dateTo` on payment dates.
- Online only: attendance and leave reports, deleted-invoice reports, salesman performance/call log/order lines, travel and location (server-side data not kept on the device). Offline they show what was loaded in this session.
- Stock figures in reports are the last synced stock; billing screens add pending moves on top.

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
3. Masters and expenses edited offline: done.
4. Reports from local data: done.
5. Apps: sales (order, payment, sales return, delivery, visit) done in `clientapp` and `clientweb`.

## Status (handoff: read this first)
Branch `feature/server-paging-clear-offline`. One commit per finished step; never commit `.DS_Store`, builds, `dist`, notes or test scripts.
- Done and committed: Phases 1-3 (all billing, purchase, stock, masters, settings masters, expenses, status actions) and the apps (sales, payments, parties, visits, attendance, claims, leave, announcements, notifications). See "Online only, on purpose" for what stays online.
- `client/src/offline` files: `core` (rules: doc types, numbers, local stock and balance), `outbox` (queue and push), `localdb` (IndexedDB and pull), `offlinelink` (Apollo link, local reads), `docs` + `gql` (collections and their queries), `device` (device code and numbers), `settings` (on/off), `boot` (start/stop and service worker), `billing` (screen hooks and helpers), `listing` (list badges), `localprice`, `userkey`, and the UI (`OfflineStatusBar`, `OfflineHeaderStatus`, `OfflineModeCard`). Add to these; do not add new files.
- Next: nothing planned. New modules follow the same pattern (server `withOfflineWrites`/`withOfflineActions`, `OP_SPECS` + `MASTER_TYPES` in `core`, a `syncPull` collection and `LOCAL_QUERIES` entry).
- Checks: server `tsc` + `check-schema`; client `tsc` (many old errors in untouched pages; only touched files must be clean); `vite build` needs the Mac (node_modules are macOS binaries).
- Local testing: the server runs on the same Mac, so turning Wi-Fi off does not make the apps offline. Stop the server or use DevTools > Network > Offline.
