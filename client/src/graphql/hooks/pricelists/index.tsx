import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import {
  GET_PRICE_LISTS,
  GET_PRICE_LIST_BY_ID,
  GET_PRICE_ASSIGNMENTS,
  RESOLVE_PRICE,
} from "../../queries/pricelists";
import {
  CREATE_PRICE_LIST,
  UPDATE_PRICE_LIST,
  DELETE_PRICE_LIST,
  CREATE_PRICE_ASSIGNMENT,
  UPDATE_PRICE_ASSIGNMENT,
  DELETE_PRICE_ASSIGNMENT,
} from "../../mutations/pricelists";

export const usePriceListQuery = () => {
  const { admin } = useAppSelector((state) => state.auth);
  const adminid = admin?.id;

  const { data, loading, error, refetch } = useQuery(GET_PRICE_LISTS, {
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

export const usePriceResolvers = () => {
  const [resolvePriceQuery] = useLazyQuery(RESOLVE_PRICE);

  const resolvePrice = async (variables: any) => {
    const { data } = await resolvePriceQuery({ variables });
    return data?.resolvePrice;
  };

  return { resolvePrice };
};

export const usePriceListMutations = () => {
  const [createPriceList] = useMutation(CREATE_PRICE_LIST);
  const [updatePriceList] = useMutation(UPDATE_PRICE_LIST);
  const [deletePriceList] = useMutation(DELETE_PRICE_LIST);

  return { createPriceList, updatePriceList, deletePriceList };
};

export const usePriceAssignmentMutations = () => {
  const [createPriceAssignment] = useMutation(CREATE_PRICE_ASSIGNMENT);
  const [updatePriceAssignment] = useMutation(UPDATE_PRICE_ASSIGNMENT);
  const [deletePriceAssignment] = useMutation(DELETE_PRICE_ASSIGNMENT);

  return { createPriceAssignment, updatePriceAssignment, deletePriceAssignment };
};
