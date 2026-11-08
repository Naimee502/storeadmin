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

/** Ask the server to delete unreferenced uploads; sent after the owning record is saved. */
export const DELETE_IMAGES = gql`
  mutation DeleteImages($urls: [String!]!) {
    deleteImages(urls: $urls)
  }
`;
