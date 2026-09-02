import React from 'react';
import { useCatalogBrowseMode } from '../../../utils';
import PartyProductCatalog from './catalog';
import CatalogBrowse from './catalogbrowse';

/**
 * Which Shop a party gets — the same decision the Home tab makes.
 *
 * Both tabs move together on purpose. A business that browses its stock by
 * category and orders off a sheet does that everywhere; leaving Shop as a
 * picture grid would mean the same catalogue answered two different ways
 * depending on which tab was pressed, and the customer would have to learn
 * both.
 *
 * Business Settings → "App Home browses a catalogue" is the switch; see
 * utils/catalogmode.ts.
 */
export default function Catalog(props: any) {
  const catalogMode = useCatalogBrowseMode();
  return catalogMode ? <CatalogBrowse {...props} variant="shop" /> : <PartyProductCatalog {...props} />;
}
