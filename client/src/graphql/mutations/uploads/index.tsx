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