import { useMutation, useQuery } from "@apollo/client";
import { GET_VISITS } from "../../queries/visit";
import { ADD_VISIT, EDIT_VISIT, DELETE_VISIT } from "../../mutations/visit";
import { useAppSelector } from "../../../redux/hooks";

// Visits scoped to the logged-in admin (and optional extra filters passed in).
export const useVisitsQuery = (filter: any = {}) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid =
    type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid =
    type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_VISITS, {
    variables: { filter: { adminid, branchid: branchid || undefined, ...filter } },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });

  return { data, loading, error, refetch };
};

export const useVisitMutations = () => {
  const [addVisitMutation] = useMutation(ADD_VISIT);
  const [editVisitMutation] = useMutation(EDIT_VISIT);
  const [deleteVisitMutation] = useMutation(DELETE_VISIT);
  return { addVisitMutation, editVisitMutation, deleteVisitMutation };
};
