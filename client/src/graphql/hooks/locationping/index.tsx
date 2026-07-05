import { useQuery } from "@apollo/client";
import { GET_LOCATION_PINGS, GET_LATEST_LOCATIONS } from "../../queries/locationping";
import { useAppSelector } from "../../../redux/hooks";

const useAdminBranch = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid =
    type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid =
    type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  return { adminid, branchid };
};

// Full GPS trail (ordered) — used to draw a salesman/delivery boy's travelled route.
export const useLocationPingsQuery = (filter: any = {}) => {
  const { adminid, branchid } = useAdminBranch();
  return useQuery(GET_LOCATION_PINGS, {
    variables: { filter: { adminid, branchid: branchid || undefined, ...filter } },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
};

// Most recent ping per staff — used for a live-location view.
export const useLatestLocationsQuery = (filter: any = {}) => {
  const { adminid, branchid } = useAdminBranch();
  return useQuery(GET_LATEST_LOCATIONS, {
    variables: { filter: { adminid, branchid: branchid || undefined, ...filter } },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
};
