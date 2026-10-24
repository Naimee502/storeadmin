import { API_CONFIG } from '../config';
import { getAuthToken } from '../apollo/client';

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
  const send = () => fetch(API_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Apollo Server's CSRF guard lets multipart through when this is set.
      'apollo-require-preflight': 'true',
    },
    body,
  });

  // Coming back from the camera (or any background), Android's HTTP client can
  // hand out a pooled connection the OS already closed — the first request then
  // fails with "Network request failed" while the very next one works. So a
  // network-level failure is retried a couple of times before giving up.
  // (A server answer, even an error, is never retried.)
  let res: Response | null = null;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3 && !res; attempt++) {
    if (attempt > 0) await new Promise<void>((r) => setTimeout(() => r(), 400 * attempt));
    try {
      res = await send();
    } catch (e: any) {
      lastErr = e;
    }
  }
  if (!res) {
    throw new Error(
      /network request failed/i.test(String(lastErr?.message))
        ? 'No internet connection. Please check your network and try again.'
        : lastErr?.message || 'Could not upload the photo. Please try again.',
    );
  }
  const json: any = await res.json().catch(() => null);
  const url = json?.data?.uploadImage?.url;
  if (!url) {
    throw new Error(json?.errors?.[0]?.message || 'Could not upload the photo. Please try again.');
  }
  return url;
};
