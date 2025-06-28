import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_TRANSFER_STOCK,
  EDIT_TRANSFER_STOCK,
  DELETE_TRANSFER_STOCK,
  RESET_TRANSFER_STOCK,        
} from '../../mutations/transferstock';
import {
  GET_TRANSFER_STOCKS,
  GET_TRANSFER_STOCK_BY_ID,
  GET_DELETED_TRANSFER_STOCKS, 
} from '../../queries/transferstock';

export const useTransferStockMutations = () => {
  const [addTransferStockMutation] = useMutation(ADD_TRANSFER_STOCK);
  const [editTransferStockMutation] = useMutation(EDIT_TRANSFER_STOCK);
  const [deleteTransferStockMutation] = useMutation(DELETE_TRANSFER_STOCK);
  const [resetTransferStockMutation] = useMutation(RESET_TRANSFER_STOCK); 

  return {
    addTransferStockMutation,
    editTransferStockMutation,
    deleteTransferStockMutation,
    resetTransferStockMutation,
  };
};

export const useTransferStocksQuery = (frombranchid?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_STOCKS, {
    variables: { frombranchid }
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedTransferStocksQuery = (frombranchid?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_TRANSFER_STOCKS, {
    variables: { frombranchid }
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useTransferStockByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_TRANSFER_STOCK_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};


