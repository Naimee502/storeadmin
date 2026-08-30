import { useSelector } from 'react-redux';
import type { RootState } from '../store/rootreducer';

/**
 * Is the signed-in party an end user (a shopper) rather than a trade account?
 *
 * The app shows two different Homes. A shopper gets the storefront layout —
 * hero banner, image category circles, a search bar, and no business figures.
 * A Retailer / Wholesaler / Distributor gets the ordering view, with their
 * outstanding balance and recent orders.
 *
 * Which one to show used to be keyed off the business code, so exactly one
 * business could have it and every party of that business got it whether they
 * were a shopper or a distributor. It belongs to the party, not the business:
 * a shop can serve both, and the same build has to do the right thing for each.
 *
 * A party with no channel counts as an end user. That is the state an account
 * is in before anyone has classified it — most often a self-registration — and
 * showing a shopper the shop is the safer of the two guesses. An admin who
 * wants the trade view says so by assigning a trade channel.
 */
export const isEndUserChannel = (channelName?: string | null) =>
  !channelName || channelName.trim().toLowerCase() === 'enduser';

/** The same question for the currently signed-in user. */
export const useIsEndUserParty = (): boolean => {
  const user = useSelector((s: RootState) => s.auth.user);
  if (!user || user.role !== 'party') return false;
  return isEndUserChannel(user.channelName);
};
