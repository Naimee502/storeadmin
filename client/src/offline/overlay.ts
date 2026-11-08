// Local changes not yet on the server, to add on top of cached stock and outstanding figures.
import { partyDelta, stockDelta, type OutboxItem } from "./core";
import { offlineStore } from "./outbox";

const items = () => offlineStore.getSnapshot().items;

/**
 * Stock not yet synced for a product variant in a branch (null = any branch).
 * Negative: queued sales invoices take stock out; positive: queued sales returns put it back.
 * Orders, service bills and cancelled offline docs add nothing. Counts pending and review items
 * (an edited offline document counts with its latest input). Pass the cached variant to get base
 * units (unit conversion as in utils/products/stockcheck); without it the result is qty x unitqty.
 * Display stock = cached variant.currentstock + this value.
 */
export function pendingStockDelta(
  productId: string,
  variantId: string | null,
  branchId: string | null,
  opts: { variant?: any; items?: OutboxItem[] } = {}
): number {
  return stockDelta(opts.items ?? items(), productId, variantId, branchId, opts.variant);
}

/**
 * Party outstanding not yet synced. Positive: the party owes more.
 * Invoice: + total - received (credit bills receive 0, as on the server).
 * Sales return: - total (0 when refunded in cash/bank with refundMode "auto").
 * Receipt: - (amount + discount + commission); payment out or refund: + the same.
 * Orders and cancelled offline docs: 0. Display outstanding = cached outstanding + this value.
 */
export function pendingPartyDelta(partyId: string, opts: { items?: OutboxItem[] } = {}): number {
  return partyDelta(opts.items ?? items(), partyId);
}
