import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  ADD_PRODUCT_SERVICE,
  UPDATE_PRODUCT_SERVICE,
  DELETE_PRODUCT_SERVICE,
  RESET_PRODUCT_SERVICE,
  IMPORT_PRODUCT_SERVICES,
} from '../../mutations/products';
import {
  GET_PRODUCT_SERVICES,
  GET_PRODUCT_SERVICE_BY_ID,
  GET_PRODUCT_IMPORT_MASTERS,
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
  limit: number = 0,
  offset: number = 0
) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

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
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchId =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

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

/* ------------------------------------------------------------------ *
 * Import / Export
 * ------------------------------------------------------------------ */

/**
 * Master lists for the spreadsheet template.
 *
 * Fetched lazily — the lists are only needed once someone opens the import
 * dialog or clicks Export, and pulling eight collections on every page load
 * would be wasteful.
 */
export const useProductImportMasters = () => {
  const [load, { data, loading, error }] = useLazyQuery(GET_PRODUCT_IMPORT_MASTERS, {
    fetchPolicy: "network-only",
  });

  const masters = data?.getProductImportMasters;

  return {
    loadMasters: load,
    masters: masters
      ? {
          categories: masters.categories ?? [],
          subcategories: masters.subcategories ?? [],
          brands: masters.brands ?? [],
          models: masters.models ?? [],
          sizes: masters.sizes ?? [],
          groups: masters.groups ?? [],
          units: masters.units ?? [],
          ledgers: masters.ledgers ?? [],
        }
      : null,
    adminid: masters?.adminid ?? null,
    branchid: masters?.branchid ?? null,
    loadingMasters: loading,
    mastersError: error,
  };
};

/** Bulk import, with a dry run for the review screen. */
export const useProductImport = () => {
  const [importMutation, { loading }] = useMutation(IMPORT_PRODUCT_SERVICES);

  const runImport = async (params: {
    products: any[];
    refs: string[];
    mode?: "CREATE" | "UPSERT";
    dryRun?: boolean;
    abortOnError?: boolean;
  }) => {
    const { data } = await importMutation({
      variables: {
        input: {
          products: params.products,
          refs: params.refs,
          mode: params.mode ?? "CREATE",
          dryRun: !!params.dryRun,
          abortOnError: !!params.abortOnError,
        },
      },
    });
    return data?.importProductServices;
  };

  return { runImport, importing: loading };
};
