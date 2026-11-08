import { useState } from "react";
import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import {
  GET_PRICE_LISTS,
  GET_PRICE_LISTS_PAGE,
  GET_PRICE_LIST_BY_ID,
  GET_PRICE_ASSIGNMENTS,
  RESOLVE_PRICE,
  GET_DELETED_PRICE_LISTS,
  GET_DELETED_PRICE_ASSIGNMENTS,
} from "../../queries/pricelists";
import {
  CREATE_PRICE_LIST,
  UPDATE_PRICE_LIST,
  DELETE_PRICE_LIST,
  CREATE_PRICE_ASSIGNMENT,
  UPDATE_PRICE_ASSIGNMENT,
  DELETE_PRICE_ASSIGNMENT,
  RESET_PRICE_LIST,
  RESET_PRICE_ASSIGNMENT,
} from "../../mutations/pricelists";
import { isOfflineEnabled } from "../../../offline/settings";
import { isNoNetworkError, resolvePriceLocally } from "../../../offline/localprice";

export const usePriceListQuery = () => {
  const { admin } = useAppSelector((state) => state.auth);
  const adminid = admin?.id;

  const { data, loading, error, refetch } = useQuery(GET_PRICE_LISTS, {
    variables: { adminid },
    skip: !adminid,
  });

  return { data, loading, error, refetch };
};

export const usePriceListsPageQuery = ({
  page,
  pageSize,
  search,
  columnFilters = [],
}: {
  page: number;
  pageSize: number;
  search: string;
  columnFilters?: { key: string; value: string }[];
}) => {
  const { admin } = useAppSelector((state) => state.auth);
  const adminid = admin?.id;

  const { data, loading, error, refetch } = useQuery(GET_PRICE_LISTS_PAGE, {
    variables: { adminid, page, pageSize, search, columnFilters },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: data?.getPriceListsPage?.items ?? [],
    total: data?.getPriceListsPage?.total ?? 0,
    loading,
    error,
    refetch,
  };
};

export const useDeletedPriceListQuery = () => {
  const { admin } = useAppSelector((state) => state.auth);
  const adminid = admin?.id;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PRICE_LISTS, {
    variables: { adminid },
    skip: !adminid,
  });

  return { data, loading, error, refetch };
};

export const usePriceListByIdQuery = (id: string) => {
  const { data, loading, error, refetch } = useQuery(GET_PRICE_LIST_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error, refetch };
};

export const usePriceAssignmentQuery = () => {
  const { admin } = useAppSelector((state) => state.auth);
  const adminid = admin?.id;

  const { data, loading, error, refetch } = useQuery(GET_PRICE_ASSIGNMENTS, {
    variables: { adminid },
    skip: !adminid,
  });

  return { data, loading, error, refetch };
};

export const useDeletedPriceAssignmentQuery = () => {
  const { admin } = useAppSelector((state) => state.auth);
  const adminid = admin?.id;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PRICE_ASSIGNMENTS, {
    variables: { adminid },
    skip: !adminid,
  });

  return { data, loading, error, refetch };
};

export const usePriceResolvers = () => {
  const { admin, type } = useAppSelector((state) => state.auth);
  const noStaffDiscount = useAppSelector((state: any) => state.adminsettings?.settings?.salesmanPriceListDiscount === false);
  const adminid = admin?.id;
  const [resolvePriceQuery] = useLazyQuery(RESOLVE_PRICE);
  // Offline mode only: the last price could not be worked out without network.
  const [offlinePrice, setOfflinePrice] = useState(false);

  const resolvePrice = async (variables: any) => {
    if (!isOfflineEnabled()) {
      // Tenant-scoped and network-only so a customer change re-evaluates the price list.
      const { data } = await resolvePriceQuery({
        variables: { adminid, ...variables },
        fetchPolicy: "network-only",
      });
      return data?.resolvePrice;
    }
    let res: any;
    let thrown: any = null;
    try {
      res = await resolvePriceQuery({ variables: { adminid, ...variables }, fetchPolicy: "network-only" });
    } catch (e) {
      thrown = e;
    }
    const err = thrown || res?.error;
    if (!err || !isNoNetworkError(err)) {
      if (thrown) throw thrown;
      setOfflinePrice(false);
      return res?.data?.resolvePrice;
    }
    // No network: same rules over the cached price lists.
    const local = resolvePriceLocally({ adminid, ...variables, staff: type === "staff", noStaffDiscount });
    if (local.status === "ok") {
      setOfflinePrice(false);
      return local.price;
    }
    setOfflinePrice(true);
    return null;
  };

  return { resolvePrice, offlinePrice };
};

export const usePriceListMutations = () => {
  const [createPriceList] = useMutation(CREATE_PRICE_LIST);
  const [updatePriceList] = useMutation(UPDATE_PRICE_LIST);
  const [deletePriceList] = useMutation(DELETE_PRICE_LIST);
  const [resetPriceList] = useMutation(RESET_PRICE_LIST);

  return { createPriceList, updatePriceList, deletePriceList, resetPriceList };
};

export const usePriceAssignmentMutations = () => {
  const [createPriceAssignment] = useMutation(CREATE_PRICE_ASSIGNMENT);
  const [updatePriceAssignment] = useMutation(UPDATE_PRICE_ASSIGNMENT);
  const [deletePriceAssignment] = useMutation(DELETE_PRICE_ASSIGNMENT);
  const [resetPriceAssignment] = useMutation(RESET_PRICE_ASSIGNMENT);

  return { createPriceAssignment, updatePriceAssignment, deletePriceAssignment, resetPriceAssignment };
};
