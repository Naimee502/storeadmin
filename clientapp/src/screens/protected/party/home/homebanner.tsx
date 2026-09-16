import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HeroBanner } from '../../../../components';
import { useHeroBannerSlides } from '../../../../apollo/hooks/adminsettings';

/**
 * Home's hero banner, kept to itself.
 *
 * A component of its own rather than a block inside Home, because it is the
 * part most likely to keep changing — slides, artwork, what a tap does — and
 * none of that should reach the catalogue underneath. It owns its query here,
 * so when the admin's slides arrive it is this component that re-renders and
 * nothing else: Home's own render is untouched, and the memoised ProductCatalog
 * never sees a changed prop. Edit this file freely; the list cannot notice.
 *
 * `products` is deliberately empty. The carousel can build its own slides from
 * a catalogue when the admin has configured none, but Home does not fetch one —
 * ProductCatalog does that internally — and wiring the grid's data back up into
 * the banner is exactly the coupling this file exists to avoid. With no slides
 * configured the carousel draws its own gradient panels, which download
 * nothing.
 *
 * The wrapper's padding is not decoration: BannerCarousel sizes its card to the
 * screen minus `horizontalPadding` on each side, so the container has to inset
 * by the same amount or the next slide peeks in at the edge.
 */
export const HomeBanner: React.FC = React.memo(function HomeBanner() {
  const slides = useHeroBannerSlides();

  return (
    <View style={styles.wrap}>
      <HeroBanner
        slides={slides}
        products={[]}
        horizontalPadding={18}
        onPress={() => undefined}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  // Home pins its search box and category strip inside a container that is
  // already inset by 18, so the banner only needs its own vertical spacing.
  wrap: { marginBottom: 10 },
});
