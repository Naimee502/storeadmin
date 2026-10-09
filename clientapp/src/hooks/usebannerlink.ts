import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * What a tap on a Home banner does — the app's version of the website's
 * banner button, driven by the same "Button Link" the admin sets per slide
 * (Settings → Website → Hero Banner):
 *
 *   /product/<id>               → that product
 *   /shop?category=<id>&q=<txt> → Shop, with that category chip / search
 *   /shop (or anything else)    → Shop
 *   http(s)://…                 → opened in the browser
 *
 * The automatic slides (no admin slides configured) also land on Shop, same
 * as their "Start Shopping" / "Browse catalog" buttons say.
 */
export function useBannerLink() {
  const navigation = useNavigation<any>();

  return useCallback(
    (link?: string | null) => {
      const raw = String(link ?? '').trim();

      if (/^https?:\/\//i.test(raw)) {
        Linking.openURL(raw).catch(() => navigation.navigate('Catalog'));
        return;
      }

      const [path, query = ''] = raw.split('?');
      const product = path.match(/\/product\/([^/?#]+)/);
      if (product) {
        navigation.navigate('ProductDetail', { productId: product[1] });
        return;
      }

      const params: Record<string, string> = {};
      query.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v) params[k] = decodeURIComponent(v.replace(/\+/g, ' '));
      });

      navigation.navigate('Catalog', {
        categoryId: params.category || null,
        search: params.q || '',
        // Changes on every tap so the Shop screen re-applies the filter even
        // when the same banner is tapped twice.
        bannerTap: Date.now(),
      });
    },
    [navigation],
  );
}
