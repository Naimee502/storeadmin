import { useMutation } from '@apollo/client';
import { UPLOAD_IMAGE } from '../../mutations/uploads';

export const useImageUpload = () => {
  const [uploadImageMutation, { data, loading, error }] = useMutation(UPLOAD_IMAGE);

  return {
    uploadImageMutation, 
    imagedata: data,
    loading,
    error,
  };
};