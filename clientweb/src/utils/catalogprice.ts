import { useTenant } from "../contexts/tenant";
import { formatPrice } from "./format";

/**
 * The one place the "Show Double Price on App/Website" setting turns into a
 * number.
 *
 * The admin toggle (Business Settings -> Feature Toggles) is a *display*
 * markup for businesses that quote a padded list price up front and settle at
 * the real one. It multiplies what the shopper reads on the catalogue — Home,
 * Shop and Product Detail — and nothing else: the cart lines, the cart total,
 * the checkout summary and the order that is actually placed all keep the rate
 * the admin entered, so the invoice, the ledger and the party's outstanding
 * are untouched.
 *
 * Because of that split, this hook is deliberately *not* wired into
 * `formatPrice`. Doubling has to be opted into per call site, so a price that
 * belongs to a real transaction can never pick it up by accident.
 *
 *   const { formatCatalogPrice } = useCatalogPrice();
 *   formatCatalogPrice(product.price)   // "₹120" when the flag is on, "₹60" off
 */
export function useCatalogPrice() {
  const { doubleDisplayPrice } = useTenant();
  const multiplier = doubleDisplayPrice ? 2 : 1;

  /** Raw amount as the catalogue should show it. */
  const catalogPrice = (amount: number) => (Number(amount) || 0) * multiplier;

  /** Same thing, already run through the site's rupee formatter. */
  const formatCatalogPrice = (amount: number) => formatPrice(catalogPrice(amount));

  return { multiplier, doubleDisplayPrice, catalogPrice, formatCatalogPrice };
}
