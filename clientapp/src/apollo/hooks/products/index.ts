import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_PRODUCTS } from '../../queries/accounts';

/**
 * One page of the catalogue at a time, with the search box and the category
 * filter applied ON THE SERVER.
 *
 * That last part is the whole point. Filtering on the client only ever looks at
 * the rows already downloaded, so the moment the list is paginated a
 * client-side search silently stops finding anything past the first page —
 * the product is in the database, the user types its exact name, and gets
 * "no products". Sending `name_contains` / `categoryid` down means the server
 * searches the entire catalogue and returns page 1 of the MATCHES.
 *
 * Paging stops when a page comes back shorter than `pageSize`; there is no
 * count query, so nothing has to stay in sync.
 */
export interface UseProductPageArgs {
  adminid?: string | null;
  /** Raw text from the search box — debounced here, not by the caller. */
  search?: string;
  /** Selected category id, or null for "All". */
  categoryid?: string | null;
  pageSize?: number;
}

const DEBOUNCE_MS = 350;

export function useProductPage({
  adminid,
  search = '',
  categoryid = null,
  // 50 keeps a 2-column grid about 25 rows deep — roughly five screens, so the
  // footer spinner is rare. Raising it further mostly costs the server: the
  // products resolver looks up stock per variant, so a page is N+1 queries.
  pageSize = 50,
}: UseProductPageArgs) {
  // Debounced so a fast typist fires one query, not one per character.
  const [term, setTerm] = useState(search.trim());
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  // Guards against onEndReached firing repeatedly while a page is in flight —
  // FlashList calls it on every scroll event near the bottom.
  const inFlight = useRef(false);

  const variables = {
    adminid,
    limit: pageSize,
    offset: 0,
    // undefined (not "") so the server skips the filter entirely.
    name_contains: term || undefined,
    categoryid: categoryid || undefined,
  };

  // notifyOnNetworkStatusChange is deliberately OFF. With it on, `loading`
  // flips true for fetchMore as well — and every screen that gates its skeleton
  // on `loading` then blanked the entire page each time the user scrolled to
  // the next 50 products. Appending a page must be invisible; `loadingMore`
  // below is the only signal for it.
  const { data, loading, fetchMore, refetch } = useQuery(GET_PRODUCTS, {
    variables,
    skip: !adminid,
  });

  const products: any[] = (data as any)?.getProductServices ?? [];

  // True only until the FIRST page has ever arrived. Changing the search term
  // or the category also sets `loading`, but by then the screen is already
  // built — reusing `loading` for the skeleton there would tear down the
  // banner, the search box and the category chips on every keystroke.
  const settled = useRef(false);
  if (!loading && data) settled.current = true;
  const initialLoading = loading && !settled.current;

  // A new search term or category is a new result set, so paging starts over.
  useEffect(() => {
    setExhausted(false);
    inFlight.current = false;
  }, [term, categoryid, adminid]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || exhausted || loading || !products.length) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const res: any = await fetchMore({
        variables: { ...variables, offset: products.length },
        updateQuery: (prev: any, { fetchMoreResult }: any) => {
          const next = fetchMoreResult?.getProductServices ?? [];
          if (!next.length) return prev;
          // De-duplicated by id: a product added while the user was scrolling
          // shifts every later offset by one, which would otherwise repeat a row.
          const seen = new Set((prev?.getProductServices ?? []).map((p: any) => p.id));
          return {
            ...prev,
            getProductServices: [
              ...(prev?.getProductServices ?? []),
              ...next.filter((p: any) => !seen.has(p.id)),
            ],
          };
        },
      });
      const got = res?.data?.getProductServices?.length ?? 0;
      if (got < pageSize) setExhausted(true);
    } catch (e) {
      // A failed page must not wedge the list — the next scroll may retry.
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [fetchMore, products.length, exhausted, loading, pageSize, term, categoryid, adminid]);

  return {
    products,
    loading,
    initialLoading,
    loadingMore,
    /** False once a short page proves there is nothing left to fetch. */
    hasMore: !exhausted && products.length >= pageSize,
    loadMore,
    refetch,
  };
}
