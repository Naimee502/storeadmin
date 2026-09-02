import React from 'react';
import { useCatalogBrowseMode } from '../../../utils';
import PartyStorefrontHome from './home';
import CatalogBrowse from './catalogbrowse';

/**
 * Which Home a party gets.
 *
 * A wrapper rather than a branch inside the Home screen itself: that screen
 * runs a dozen hooks before it renders anything, and returning a different tree
 * partway through would either break the hook order or mean running every one
 * of those queries for a layout that is not on screen. Here the decision is one
 * hook, taken before either screen mounts.
 *
 * Business Settings → "App Home browses a catalogue" is the switch; see
 * utils/catalogmode.ts.
 */
export default function PartyHome(props: any) {
  const catalogMode = useCatalogBrowseMode();
  return catalogMode ? <CatalogBrowse {...props} variant="home" /> : <PartyStorefrontHome {...props} />;
}
