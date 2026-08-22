import { useQuery, useMutation } from "@apollo/client";
import {
  GET_SALES_ROUTES,
  GET_SALES_ROUTE_BY_ID,
} from "../queries/salesroutes";
import {
  CREATE_SALES_ROUTE,
  UPDATE_SALES_ROUTE,
  DELETE_SALES_ROUTE,
  RESET_SALES_ROUTE,
  UPDATE_SALES_ROUTE_STATUS,
} from "../mutations/salesroutes";

export const useSalesRoutesQuery = (
  filter: any = {},
  limit: number = 0,
  offset: number = 0,
  skip: boolean = false
) => {
  return useQuery(GET_SALES_ROUTES, {
    variables: { filter: { ...filter, status: true }, limit, offset },
    skip,
    fetchPolicy: "network-only",
  });
};

export const useDeletedSalesRoutesQuery = (
  filter: any = {},
  limit: number = 0,
  offset: number = 0,
  skip: boolean = false
) => {
  return useQuery(GET_SALES_ROUTES, {
    variables: { filter: { ...filter, status: false }, limit, offset },
    skip,
    fetchPolicy: "network-only",
  });
};

export const useGetSalesRouteById = (id: string, adminId?: string, branchId?: string) => {
  return useQuery(GET_SALES_ROUTE_BY_ID, {
    variables: { id, adminId, branchId },
    skip: !id,
    fetchPolicy: "network-only",
  });
};

export const useCreateSalesRoute = () => {
  const [createSalesRoute, { loading, error }] = useMutation(CREATE_SALES_ROUTE, {
    refetchQueries: [{ query: GET_SALES_ROUTES }],
  });
  return { createSalesRoute, loading, error };
};

export const useUpdateSalesRoute = () => {
  const [updateSalesRoute, { loading, error }] = useMutation(UPDATE_SALES_ROUTE, {
    refetchQueries: [{ query: GET_SALES_ROUTES }],
  });
  return { updateSalesRoute, loading, error };
};

export const useDeleteSalesRoute = () => {
  const [deleteSalesRoute, { loading, error }] = useMutation(DELETE_SALES_ROUTE, {
    refetchQueries: [{ query: GET_SALES_ROUTES }],
  });
  return { deleteSalesRoute, loading, error };
};

export const useResetSalesRoute = () => {
  const [resetSalesRoute, { loading, error }] = useMutation(RESET_SALES_ROUTE, {
    refetchQueries: [{ query: GET_SALES_ROUTES }],
  });
  return { resetSalesRoute, loading, error };
};

export const useUpdateSalesRouteStatus = () => {
  const [updateSalesRouteStatus, { loading, error }] = useMutation(UPDATE_SALES_ROUTE_STATUS, {
    refetchQueries: [{ query: GET_SALES_ROUTES }],
  });
  return { updateSalesRouteStatus, loading, error };
};
