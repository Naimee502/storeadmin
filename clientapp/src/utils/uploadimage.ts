import { API_CONFIG } from '../config';
import { getAuthToken } from '../apollo/client';
import { UPLOAD_PREFIX } from '../apollo/offline';

/**
 * Upload one local image (a camera / gallery uri) through the server's
 * `uploadImage` mutation and return its public url.
 *
 * The app's Apollo link is plain HTTP — it cannot send files — so this posts
 * the GraphQL multipart request (graphql-upload spec) by hand: `operations`
 * with the file variable left null, `map` saying where it goes, then the file.
 */
export const uploadImage = async (
  uri: string,
  fileName?: string | null,
  mimeType?: string | null,
  // No answer in this time: treated like no network, so the photo uploads on sync instead.
  opts?: { timeoutMs?: number },
): Promise<string> => {
  const name = fileName || `photo-${Date.now()}.jpg`;
  const type = mimeType || 'image/jpeg';

  const body = new FormData();
  body.append(
    'operations',
    JSON.stringify({
      query: 'mutation UploadImage($file: Upload!) { uploadImage(file: $file) { url } }',
      variables: { file: null },
    }),
  );
  body.append('map', JSON.stringify({ '0': ['variables.file'] }));
  body.append('0', { uri, name, type } as any);

  const token = getAuthToken();
  const abort = opts?.timeoutMs ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), opts!.timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(API_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Apollo Server's CSRF guard lets multipart through when this is set.
      'apollo-require-preflight': 'true',
    },
    body,
    signal: abort?.signal,
    });
  } catch {
    // No network: the photo stays on the phone and uploads on sync (apollo/offline.ts).
    return `${UPLOAD_PREFIX}${encodeURIComponent(JSON.stringify({ uri, name, type }))}`;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const json: any = await res.json().catch(() => null);
  const url = json?.data?.uploadImage?.url;
  if (!url) {
    throw new Error(json?.errors?.[0]?.message || 'Could not upload the photo. Please try again.');
  }
  return url;
};

/** Phone file behind an offline photo marker, or null. */
export const pendingUploadFile = (marker: string): { uri: string; name: string; type: string } | null => {
  if (!marker.startsWith(UPLOAD_PREFIX)) return null;
  try {
    return JSON.parse(decodeURIComponent(marker.slice(UPLOAD_PREFIX.length)));
  } catch {
    return null;
  }
};

/** Uploads an offline photo on sync; throws while there is still no network. */
export const uploadPendingPhoto = async (marker: string): Promise<string> => {
  const f = pendingUploadFile(marker);
  if (!f) throw new Error('Offline photo is missing.');
  const url = await uploadImage(f.uri, f.name, f.type);
  if (url.startsWith(UPLOAD_PREFIX)) throw new TypeError('Network request failed');
  return url;
};
