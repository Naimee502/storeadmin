// hooks/transferStock.ts
import { useMutation, useQuery } from '@apollo/client';
import { ADD_TRANSFER_STOCK, EDIT_TRANSFER_STOCK, DELETE_TRANSFER_STOCK } from '../../mutations/transferstock';
import { GET_TRANSFER_STOCKS, GET_TRANSFER_STOCK_BY_ID } from '../../queries/transferstock';

export const useTransferStockMutations = () => {
  const [addTransferStockMutation] = useMutation(ADD_TRANSFER_STOCK);
  const [editTransferStockMutation] = useMutation(EDIT_TRANSFER_STOCK);
  const [deleteTransferStockMutation] = useMutation(DELETE_TRANSFER_STOCK);

  return { addTransferStockMutation, editTransferStockMutation, deleteTransferStockMutation };
};

export const useTransferStocksQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_STOCKS);

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
