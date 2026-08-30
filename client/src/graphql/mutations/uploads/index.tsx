import { gql } from "@apollo/client";

export const UPLOAD_IMAGE = gql`
    mutation UploadImage($file: Upload!) {
    uploadImage(file: $file) {
      filename
      mimetype
      encoding
      url
    }
  }
`;

/**
 * Ask the server to bin uploads nothing points at any more. Sent only after
 * the owning record has been saved, so the url is genuinely unreferenced by
 * then; the server re-checks anyway.
 */
export const DELETE_IMAGES = gql`
  mutation DeleteImages($urls: [String!]!) {
    deleteImages(urls: $urls)
  }
`;
