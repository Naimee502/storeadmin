import { API_CONFIG } from "../config/apiconfig";
import { getAuthToken } from "../graphql/client";

/**
 * Upload one picked image through the server's `uploadImage` mutation.
 * The site's Apollo link is plain HTTP (no file support), so this sends the
 * GraphQL multipart request directly. Pictures are shrunk first: nginx turns
 * away anything over 1 MB.
 */
const shrink = (file: File, max = 1280, quality = 0.8): Promise<Blob> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 700_000) return resolve(file);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", quality);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });

export const uploadImage = async (file: File): Promise<string> => {
  const blob = await shrink(file);
  const body = new FormData();
  body.append(
    "operations",
    JSON.stringify({
      query: "mutation UploadImage($file: Upload!) { uploadImage(file: $file) { url } }",
      variables: { file: null },
    })
  );
  body.append("map", JSON.stringify({ "0": ["variables.file"] }));
  body.append("0", blob, (file.name || "picture").replace(/\.\w+$/, "") + ".jpg");

  const token = getAuthToken();
  const res = await fetch(API_CONFIG.GRAPHQL_URL, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "apollo-require-preflight": "true" },
    body,
  });
  const json: any = await res.json().catch(() => null);
  const url = json?.data?.uploadImage?.url;
  if (!url) throw new Error(json?.errors?.[0]?.message || "Could not upload the picture.");
  return url;
};
