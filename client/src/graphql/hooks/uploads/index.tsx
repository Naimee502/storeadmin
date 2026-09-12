import { useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { DELETE_IMAGES, UPLOAD_IMAGE } from '../../mutations/uploads';
import { compressImage, presetFor, type ImagePurpose } from '../../../utils/compressimage';

export const useImageUpload = () => {
  const [rawUploadImage, { data, loading, error }] = useMutation(UPLOAD_IMAGE);
  const [deleteImagesMutation] = useMutation(DELETE_IMAGES);

  /**
   * Upload, shrinking the file first.
   *
   * Every page that uploads goes through this hook, so putting the compression
   * here is what makes it universal instead of something five forms each have
   * to remember. A photo straight off a phone is routinely 2-8 MB and nothing
   * in this system ever draws one larger than about 1400px; the rest is paid
   * for by the person waiting on the save, by the nginx body limit that
   * refuses anything over 1 MB with a bare 413, and by every customer whose
   * phone downloads it afterwards.
   *
   * `purpose` picks the size: 'product' by default, 'logo' for line art that
   * must stay crisp, 'banner' for full-bleed photos. compressImage returns the
   * original untouched if it is already small, if it cannot decode it, or if
   * re-encoding would make it bigger — so this can never turn a working upload
   * into a failing one.
   */
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

  /**
   * Fire-and-forget cleanup of files the caller has stopped using.
   *
   * Deliberately never throws: the user's save has already succeeded by the
   * time this runs, and failing to tidy a leftover file is not something to
   * interrupt them with. Anything that goes wrong is logged and the file is
   * simply left for the next attempt.
   */
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
