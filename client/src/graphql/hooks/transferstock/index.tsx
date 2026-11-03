import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_TRANSFER_STOCK,
  EDIT_TRANSFER_STOCK,
  DELETE_TRANSFER_STOCK,
  RESET_TRANSFER_STOCK,
} from '../../mutations/transferstock';
import {
  GET_TRANSFER_STOCKS,
  GET_TRANSFER_STOCKS_LIST,
  GET_TRANSFER_STOCK_PRODUCTS,
  GET_TRANSFER_STOCK_BRANCHES,
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
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const frombranchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_STOCKS, {
    variables: { adminId, frombranchid },
  });

  return { data, loading, error, refetch };
};

// ✅ Transfer Stocks LIST (lite) — list page only. Same scope/variables as
// useTransferStocksQuery, GET_TRANSFER_STOCKS_LIST selection.
export const useTransferStocksListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const frombranchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_STOCKS_LIST, {
    variables: { adminId, frombranchid },
  });

  return { data, loading, error, refetch };
};

// ✅ Product lookup for the list + add/edit form. Same scope/variables as
// useProductServicesQuery (products hook); result is under getProductServices.
export const useTransferStockProductsQuery = (
  status: boolean = true,
  limit: number = 0,
  offset: number = 0
) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_STOCK_PRODUCTS, {
    variables: { filter: { adminid: adminId, branchid, status }, limit, offset },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
  return { data, loading, error, refetch };
};

// ✅ Branch names for the list columns and the destination picker. Same
// variables as useBranchesQuery; result is under getBranches.
export const useTransferStockBranchesQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_STOCK_BRANCHES, {
    variables: adminId ? { adminId } : {},
  });

  return { data, loading, error, refetch };
};

// ✅ Deleted Transfer Stocks Query
export const useDeletedTransferStocksQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const frombranchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_TRANSFER_STOCKS, {
    variables: { adminId, frombranchid },
  });

  return { data, loading, error, refetch };
};

// ✅ Get Transfer Stock by ID
export const useTransferStockByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminId = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_TRANSFER_STOCK_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
