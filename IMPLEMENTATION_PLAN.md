# Flexible SaaS — Final Implementation Plan (Hindi)

> Status: **APPROVED design / implementation pending**. Har phase reloadable + non-breaking. Defaults aise rakhe hain ki purana behaviour na toote.

---

## Locked Decisions (saar)

1. **Menu visibility = sirf allowed-modules se.** Flags kabhi sidebar/menu hide-show nahi karenge — sirf andar ka behaviour badlenge.
2. **Sales route = koi flag nahi.** Salesman ko **route assign hai → route-wise** order; assign nahi → **direct channel-wise** party add + order. (Route module khud allowed-modules se on/off.)
3. **Channel hierarchy = Channel pe `handlesChannels` (multiselect).** Ek channel kai channels handle kar sakta hai (e.g., Superstockist → Wholesaler + Retailer).
4. **Parent party = party-add ke waqt choose hoga.** Parent-party dropdown me sirf un channels ki parties aayengi jo current party ke channel ko handle karti hain (`assignaccountid` set hoga).
5. **Channel + Region dropdown party add/edit me tabhi dikhe jab `channels` module allowed ho** (admin panel + app dono).
6. **Credit/Debit auto:** type=customer → `debit`, type=vendor → `credit` (user override kar sake).
7. **Status control Sales INVOICE listing pe** (single dropdown). Sales Order listing se confirm/dispatch/deliver **buttons hata denge** (kyunki convert pe order invoice me chala jata hai).
8. **App (staff/salesman/party/deliveryboy):** har jagah order/invoice ka **status sirf dikhana** (manage nahi); jahan miss hai wahan add karna.
9. **Party downline visibility** (apne + under ke orders/payment) = flag `partyManagesDownline` se.

### Defer (abhi NAHI):
- **Area master** (state ke andar area) — abhi state hi rahega.
- **Order-only mode me sale ledger kab post ho** (confirm pe vs button) — baad me.

---

## PHASE 1 — Channel Hierarchy (multiselect)

**Goal:** Channel define kare ki wo kaunse channels ko handle karta hai.

- **server/src/models/channel/index.ts** — `handlesChannels: [ObjectId ref Channel]` add.
- **server/src/graphql/schema/channel/index.ts** — type + input me `handlesChannels: [ID]`.
- **server/src/graphql/resolvers/channel/index.ts** — create/update me handlesChannels save, populate + format.
- **client/src/pages/channels/index.tsx** — channel form me **multiselect dropdown** "Handles which channels".
- **client/src/graphql/queries|mutations/channels** — handlesChannels field.

---

## PHASE 2 — Party add/edit improvements (admin + app)

**Goal:** Channel/Region gating, parent party, credit/debit auto.

> Note: Parent-party dropdown `partyManagesDownline` flag pe depend karta hai — isliye us flag ko (Phase 4) Phase 2 ke saath/pehle add kar lenge.

- **client/src/pages/accounts/addedit/index.tsx**
  - Channel + Region dropdown **sirf tab dikhe jab `channels` module allowed** ho (selectModuleActions / allowed check).
  - **Parent (Assign) party** field: **sirf tab dikhe jab `partyManagesDownline` flag ON ho** (warna hidden). Flag ON hone par options = handling-channel ki parties (`handlesChannels` reverse lookup) → `assignaccountid` set. OFF hone par koi parent assign nahi.
  - **Credit/Debit auto:** type=customer → openingbalancetype `debit`; vendor → `credit` (auto-set, editable).
  - **State vs Region confusion fix:** State (address/GST) aur Region (pricing) ko merge NAHI karna — purpose alag hai. **State** hamesha rahe (GST: IGST vs CGST/SGST). **Region** ko **Channel ke saath group + channel-module ke peeche gate** (channel off → Region hidden, sirf State → koi double-up nahi). Region ka label **"Region / Price Zone"**. Admin me State dropdown bhi `stateOptions` use kare (abhi galti se `regionOptions` use ho raha hai) taaki app ke saath consistent rahe.
- **clientapp** party-add screen (staff/salesman) — wahi gating + parent party (channel-filtered, **`partyManagesDownline` ON par hi dikhe**). Channel & Region section channel-module gated; State alag rahe.
- **server/src/graphql/resolvers/accounts/index.ts** — parent-party filter helper (channel → handled-by channel ki parties). Salesman channel-filter already maujood hai.

---

## PHASE 3 — Salesman route-optional behaviour

**Goal:** Route assign ho to route-wise, warna direct channel-wise.

- **clientapp salesman screens** (home / route / manage party / cart):
  - Agar salesman ko **route assigned** hai → abhi jaisa route list + visit flow.
  - Agar **nahi** → seedha apne **assigned channel** ki party list, usme se order le, nayi party add kare (route ke bina).
- Admin route module allowed-modules se hata sakta hai → app me route tab gayab (existing permission flow).
- Koi naya server flag nahi.

---

## PHASE 4 — Party Downline (orders + payment) — flag-gated

**Goal:** Channel party (wholesaler/retailer/distributor) apne + apne **under** ki parties ke orders/payment dekhe-kare.

- **server/src/models/adminsettings + schema** — naya flag `partyManagesDownline` (default `false`).
- **server/src/graphql/resolvers/salesorder/index.ts** — party login ke liye `partyacc IN [self + downline party ids]`. Downline = `assignaccountid` chain (channel.handlesChannels ke hisaab se, recursive).
- **server/src/graphql/resolvers/payments/index.ts** — downline parties ke payment/outstanding visible + collect (party login).
- **clientapp party login** — "My Orders" me apne + downline orders; downline party ke against payment collection screen.
- **Downline status control (flag ON):** party apne **under ki party ke orders ka status bhi change** kar sake — bilkul jaise salesman karta hai (confirm/dispatch/deliver/cancel jo app me allowed ho). Yani downline orders pe party = "mini-admin" apne network ke liye.
- **Salesman status control:** salesman primarily order leta hai, par usko bhi apne orders pe **status-change ka option** rahega (sirf order lena nahi).
- **Payment collection app = admin parity:** app se jo payment collect ho wo admin wale hi flow/effect (Dr cash / Cr party ledger) ke saath ho. Party flag ON par **apne under ki party ka payment** bhi collect kar sake (downline outstanding ke against).
- Ye sab **`partyManagesDownline` flag ON hone par** hi app me dikhega/chalega; OFF par party sirf apne orders/payment dekhe aur sab manufacturer (admin) handle kare.
- **client/src/pages/businesssettings** — `partyManagesDownline` toggle.
- **client/src/graphql/queries/adminsettings** — field add.

---

## PHASE 5 — Status: Invoice dropdown + Order buttons hatao + App display

**Goal:** Status control admin invoice pe; order listing saaf; app me status badge + role/flag-based status-change (delivery boy, salesman, downline party).

- **client/src/pages/salesorder/index.tsx** — confirm/dispatch/deliver **buttons hatao**, unki jagah ek **status dropdown** (Pending / Confirmed / Dispatched / Delivered / Cancelled / Reopen). Ye dropdown un businesses ke liye useful hai jo order-level pe hi sab manage karte hain (invoice nahi banate). Dropdown canonical `orderStatus` ko set kare (Phase A mutations/sync use kare).
- **client/src/pages/salesinvoice/index.tsx** — wahi **status dropdown** (Dispatched / Delivered / Cancelled / Reopen) per row; existing invoice delivery mutations + Phase A sync use kare.
- **client/src/components/datatable** — ek reusable **status dropdown** support (order + invoice dono listing me use ho).
- **clientapp (4 logins)** — `MyOrders`/`Orders` tab me har order/invoice ka **status badge** (Pending/Confirmed/Dispatched/Delivered/Cancelled). staff, salesman, party, deliveryboy — sab me check, jahan miss wahan add.
  - **Status sirf display nahi — kuch logins status change bhi karenge (flag/role ke hisaab se):**
    - **Delivery boy:** Mark Dispatched / Delivered (existing).
    - **Salesman:** apne orders pe status-change option (confirm/dispatch/deliver/cancel jo allowed ho).
    - **Party (downline ON):** apne **under ki party** ke orders pe status-change — salesman jaisa hi (Phase 4 wala).
    - **Party (apne self orders):** sirf display.
  - Yani app me status control role + `partyManagesDownline` flag ke hisaab se; baaki sab jagah read-only badge.

---

## PHASE 6 — Attendance Punch-in Gate (allowed-module driven, no flag)

**Goal:** Punch-in (attendance) ke bina koi operation na ho — best practice for accountability + location/time tracking.

- **Koi flag NAHI.** Gate **`attendance` module ke allowed-modules me enable hone** se chalega:
  - Jis staff/salesman/deliveryboy ke liye **attendance module allowed hai → punch-in compulsory** (gate ON automatically).
  - Attendance module allowed nahi → koi gate nahi (abhi jaisa).
- **Rule:** punch-in module allowed wale user ne **aaj punch-in nahi kiya** to kuch bhi access **block** — na party add, na order, na payment collection, na delivery accept. Sirf punch-in / attendance screen khule; punch-in karte hi normal access.
- **clientapp:** login ke baad **attendance gate** — agar attendance allowed hai aur `isPunchedInToday` false → saare action screens lock + "Punch in to start" screen. Salesman (order), delivery boy (accept), staff (sab) gated.
- **admin panel:** staff/branch login pe bhi wahi gate (jinke allowed-modules me attendance hai). Admin/owner exempt.
- **server:** `isPunchedInToday(staffId)` helper; critical mutations (addSalesOrder / addPayment / accept) pe optional server-side guard (jab attendance module us user ko allowed ho) — double safety.
- Existing attendance module/backend (jo pehle wire ho chuka) ka hi punch-in use hoga.

---

## PHASE 7 (Defer) — Order-only ledger posting

- Flag `postSaleOnOrderConfirm`: order confirm pe halki sale posting (Dr party / Cr sales) bina full invoice; payment us receivable ke against.
- Abhi defer — baad me design + implement.

---

## Naye Flags (sab AdminSettings me, behaviour-only)

| Flag | Default | Kaam |
|------|---------|------|
| `partyManagesDownline` | false | Party apne under ke orders/payment dekhe-kare |
| `postSaleOnOrderConfirm` | (Phase 7) | Order-only ledger posting |

> Note: **Attendance punch-in gate** ke liye koi flag nahi — `attendance` module allowed hone par compulsory.

(Pehle ke `deliveryMode`, `encryptInvoicePrices` waise hi.)

---

## Implementation order

1. Phase 1 (Channel hierarchy) → 2. Phase 2 (Party add/edit) → 3. Phase 4 (Downline) → 4. Phase 3 (Route-optional) → 5. Phase 5 (Status invoice/app) → 6. Phase 6 (Attendance punch-in gate).
Har phase ke baad: server `npm run build` + restart, admin reload, app reload — test, fir agla.
