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
import { useAppSelector } from '../../../redux/hooks';

// ✅ Mutations
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

// ✅ Transfer Stocks Query (Active)
export const useTransferStocksQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;
  const frombranchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_STOCKS, {
    variables: { adminId, frombranchid },
  });

  return { data, loading, error, refetch };
};

// ✅ Deleted Transfer Stocks Query
export const useDeletedTransferStocksQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;
  const frombranchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_TRANSFER_STOCKS, {
    variables: { adminId, frombranchid },
  });

  return { data, loading, error, refetch };
};

// ✅ Get Transfer Stock by ID
export const useTransferStockByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;

  const { data, loading, error } = useQuery(GET_TRANSFER_STOCK_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
