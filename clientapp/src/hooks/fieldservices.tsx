import React, { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { offline } from '../apollo/client';
import { GET_PRODUCTS } from '../apollo/queries/accounts';
import { PhotoWarmer } from '../components/appimage';
import { productImages } from '../components/productimageviewer';
import type { RootState } from '../store/rootreducer';
import { useLocationTracker } from './uselocationtracker';
import { useRegisterDeviceToken } from './useregisterdevicetoken';

/**
 * Headless component mounted inside the authenticated app. Runs the background
 * field services (foreground location tracking + FCM device-token registration)
 * for the logged-in user, and keeps catalogue photos on the phone for staff and salesmen.
 */
export default function FieldServices() {
  useRegisterDeviceToken();
  useLocationTracker();
  return <CatalogPhotos />;
}

// Staff and salesmen take orders offline, so the catalogue saved at login (warmupFor) gets its photos too.
function CatalogPhotos() {
  const role = useSelector((s: RootState) => String(s.auth.user?.role || '').toLowerCase());
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const field = role === 'staff' || role === 'salesman';
  const { online } = useSyncExternalStore(offline.subscribe, offline.getState);
  const { data } = useQuery(GET_PRODUCTS, {
    variables: { adminid, limit: 5000, offset: 0 },
    fetchPolicy: 'cache-only',
    skip: !field || !adminid,
  });
  const uris = useMemo(() => {
    const all = ((data as any)?.getProductServices ?? []).filter((p: any) => p && p.status !== false).map((p: any) => productImages(p)[0]);
    return [...new Set(all.filter(Boolean))] as string[];
  }, [data]);
  return field ? <PhotoWarmer uris={uris} active={online} /> : null;
}
