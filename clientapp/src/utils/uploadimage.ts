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
  const res = await fetch(API_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Apollo Server's CSRF guard lets multipart through when this is set.
      'apollo-require-preflight': 'true',
    },
    body,
  });
  const json: any = await res.json().catch(() => null);
  const url = json?.data?.uploadImage?.url;
  if (!url) {
    throw new Error(json?.errors?.[0]?.message || 'Could not upload the photo. Please try again.');
  }
  return url;
};
