import { useQuery, useMutation } from "@apollo/client";
import { GET_STOCK_ADJUSTMENTS, GET_STOCK_ADJUSTMENT_BY_ID } from "../../queries/stockadjustments";
import {
  CREATE_STOCK_ADJUSTMENT,
  UPDATE_STOCK_ADJUSTMENT,
  DELETE_STOCK_ADJUSTMENT,
  CANCEL_STOCK_ADJUSTMENT,
  RESET_STOCK_ADJUSTMENT,
} from "../../mutations/stockadjustments";

export const useGetStockAdjustments = (filter: any = {}, limit: number = 50, offset: number = 0) => {
  const { data, loading, error, refetch } = useQuery(GET_STOCK_ADJUSTMENTS, {
    variables: { filter, limit, offset },
    fetchPolicy: "network-only",
  });
  return { data, loading, error, refetch };
};

// Active entries (status = true)
export const useActiveStockAdjustments = (filter: any = {}) =>
  useGetStockAdjustments({ ...filter, status: true });

// Deleted entries (status = false)
export const useDeletedStockAdjustments = (filter: any = {}) =>
  useGetStockAdjustments({ ...filter, status: false });

export const useGetStockAdjustmentById = (id: string, adminId?: string, branchId?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_STOCK_ADJUSTMENT_BY_ID, {
    variables: { id, adminId, branchId },
    skip: !id,
    fetchPolicy: "network-only",
  });
  return { data, loading, error, refetch };
};

export const useCreateStockAdjustment = () => {
  const [createStockAdjustment, { loading, error }] = useMutation(CREATE_STOCK_ADJUSTMENT, {
    refetchQueries: [{ query: GET_STOCK_ADJUSTMENTS }],
  });
  return { createStockAdjustment, loading, error };
};

export const useUpdateStockAdjustment = () => {
  const [updateStockAdjustment, { loading, error }] = useMutation(UPDATE_STOCK_ADJUSTMENT, {
    refetchQueries: [{ query: GET_STOCK_ADJUSTMENTS }],
  });
  return { updateStockAdjustment, loading, error };
};

export const useDeleteStockAdjustment = () => {
  const [deleteStockAdjustment, { loading, error }] = useMutation(DELETE_STOCK_ADJUSTMENT, {
    refetchQueries: [{ query: GET_STOCK_ADJUSTMENTS }],
  });
  return { deleteStockAdjustment, loading, error };
};

export const useCancelStockAdjustment = () => {
  const [cancelStockAdjustment, { loading, error }] = useMutation(CANCEL_STOCK_ADJUSTMENT, {
    refetchQueries: [{ query: GET_STOCK_ADJUSTMENTS }],
  });
  return { cancelStockAdjustment, loading, error };
};

export const useResetStockAdjustment = () => {
  const [resetStockAdjustment, { loading, error }] = useMutation(RESET_STOCK_ADJUSTMENT, {
    refetchQueries: [{ query: GET_STOCK_ADJUSTMENTS }],
  });
  return { resetStockAdjustment, loading, error };
};
