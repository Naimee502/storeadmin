import { useMutation } from '@apollo/client';
import { DELETE_IMAGES, UPLOAD_IMAGE } from '../../mutations/uploads';

export const useImageUpload = () => {
  const [uploadImageMutation, { data, loading, error }] = useMutation(UPLOAD_IMAGE);
  const [deleteImagesMutation] = useMutation(DELETE_IMAGES);

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
