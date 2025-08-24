import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_PRODUCT_SERVICE,
  UPDATE_PRODUCT_SERVICE,
  DELETE_PRODUCT_SERVICE,
  RESET_PRODUCT_SERVICE,
} from '../../mutations/products';
import {
  GET_PRODUCT_SERVICES,
  GET_PRODUCT_SERVICE_BY_ID,
} from '../../queries/products';
import { useAppSelector } from '../../../redux/hooks';

export const useProductServiceMutations = () => {
  const [addProductServiceMutation] = useMutation(ADD_PRODUCT_SERVICE);
  const [updateProductServiceMutation] = useMutation(UPDATE_PRODUCT_SERVICE);
  const [deleteProductServiceMutation] = useMutation(DELETE_PRODUCT_SERVICE);
  const [resetProductServiceMutation] = useMutation(RESET_PRODUCT_SERVICE);

  return {
    addProductServiceMutation,
    updateProductServiceMutation,
    deleteProductServiceMutation,
    resetProductServiceMutation,
  };
};

export const useProductServicesQuery = (
  status: boolean = true,
  limit: number = 100,
  offset: number = 0
) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;
  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PRODUCT_SERVICES, {
    variables: {
      filter: {
        adminid: adminId,
        branchid,
        status,
      },
      limit,
      offset,
    },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });

  return { data, loading, error, refetch };
};

export const useProductServiceByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;
  const branchId =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PRODUCT_SERVICE_BY_ID, {
    variables: { id, adminId, branchId },
    skip: !id || !adminId,
  });

  console.log("Fetched Product Data in hook:", data);

  return { data, loading, error, refetch };
};

export const useDeletedProductServicesQuery = () => {
  return useProductServicesQuery(false);
};
