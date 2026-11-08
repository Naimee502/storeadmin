import { useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { DELETE_IMAGES, UPLOAD_IMAGE } from '../../mutations/uploads';
import { compressImage, presetFor, type ImagePurpose } from '../../../utils/compressimage';

export const useImageUpload = () => {
  const [rawUploadImage, { data, loading, error }] = useMutation(UPLOAD_IMAGE);
  const [deleteImagesMutation] = useMutation(DELETE_IMAGES);

  /** Upload, compressing images first (`purpose` picks the size). */
  const uploadImageMutation = useCallback(
    async (options: any, purpose: ImagePurpose = 'product') => {
      const file = options?.variables?.file;
      if (!(file instanceof File)) return rawUploadImage(options);

      const compressed = await compressImage(file, presetFor(purpose));
      return rawUploadImage({
        ...options,
        variables: { ...options.variables, file: compressed },
      });
    },
    [rawUploadImage],
  );

  /** Fire-and-forget cleanup of unused files; never throws. */
  const deleteImages = async (urls: (string | undefined | null)[]) => {
    const cleanable = Array.from(
      new Set(urls.filter((u): u is string => Boolean(u) && !u.startsWith('blob:')))
    );
    if (!cleanable.length) return 0;

    try {
      const { data: result } = await deleteImagesMutation({ variables: { urls: cleanable } });
      return result?.deleteImages ?? 0;
    } catch (err) {
      console.error('Could not clean up unused images:', err);
      return 0;
    }
  };

  return {
    uploadImageMutation,
    deleteImagesMutation,
    deleteImages,
    imagedata: data,
    loading,
    error,
  };
};
