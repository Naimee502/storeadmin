import { useQuery } from "@apollo/client";
import { GET_LOCATION_PINGS, GET_LATEST_LOCATIONS, GET_TRAVEL_SUMMARY } from "../../queries/locationping";
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

// Full GPS trail for a staff member; admin-scoped since pings cross branches.
export const useLocationPingsQuery = (filter: any = {}) => {
  const { adminid } = useAdminBranch();
  return useQuery(GET_LOCATION_PINGS, {
    variables: { filter: { adminid, ...filter } },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
};

// Latest ping per staff, admin-scoped.
export const useLatestLocationsQuery = (filter: any = {}) => {
  const { adminid } = useAdminBranch();
  return useQuery(GET_LATEST_LOCATIONS, {
    variables: { filter: { adminid, ...filter } },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
};

// KM travelled per staff per day for the filter's date range.
export const useTravelSummaryQuery = (filter: any = {}) => {
  const { adminid } = useAdminBranch();
  return useQuery(GET_TRAVEL_SUMMARY, {
    variables: { filter: { adminid, ...filter } },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
};
