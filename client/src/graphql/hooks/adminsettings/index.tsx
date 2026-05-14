import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import {
  GET_ADMIN_SETTINGS,
  UPDATE_ADMIN_SETTINGS,
  GET_PERMISSIONS,
  GET_EFFECTIVE_PERMISSIONS,
  SET_PERMISSIONS,
} from "../../queries/adminsettings";
import { useAppSelector } from "../../../redux/hooks";

const useAdminId = () => {
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  if (type === "admin") return admin?.id;
  if (type === "branch") return branch?.admin?.id;
  if (type === "staff") return staff?.admin?.id;
  return undefined;
};

export const useAdminSettingsQuery = (adminid?: string) => {
  const authAdminId = useAdminId();
  const finalId = adminid || authAdminId;
  const { data, loading, error, refetch } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid: finalId },
    skip: !finalId,
  });
  return { data, loading, error, refetch };
};

export const useAdminSettingsMutations = () => {
  const [updateAdminSettings] = useMutation(UPDATE_ADMIN_SETTINGS);
  return { updateAdminSettings };
};

export const usePermissionsLazy = (options?: Parameters<typeof useLazyQuery>[1]) =>
  useLazyQuery(GET_PERMISSIONS, options);
export const useEffectivePermissionsLazy = (options?: Parameters<typeof useLazyQuery>[1]) =>
  useLazyQuery(GET_EFFECTIVE_PERMISSIONS, options);
export const usePermissionsMutations = () => {
  const [setPermissions] = useMutation(SET_PERMISSIONS);
  return { setPermissions };
};
