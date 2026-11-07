import { useMutation } from "@apollo/client";
import { CLEAR_DELETED_ENTRIES } from "../../mutations/common";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import { showMessage } from "../../../redux/slices/message";

/**
 * Clear props for a Deleted Entries DataTable. Cleared entries stay in the
 * database but never show in deleted lists or reports again.
 * `module` is the server target (usually the permission id); `permission`
 * overrides the permission id when they differ.
 */
export const useClearDeleted = (
  module: string,
  refetch: () => unknown,
  label = "entry",
  permission?: string
) => {
  const dispatch = useAppDispatch();
  const canClear = useAppSelector((state) => selectModuleActions(state, permission || module).canClear);
  const [clearMutation] = useMutation(CLEAR_DELETED_ENTRIES);

  const run = async (ids: string[], question: string) => {
    if (!ids.length || !window.confirm(question)) return;
    try {
      const { data } = await clearMutation({ variables: { module, ids } });
      await refetch();
      const count = data?.clearDeletedEntries ?? 0;
      dispatch(showMessage({ message: `${count} deleted ${count === 1 ? label : `${label}s`} cleared.`, type: "success" }));
    } catch (error: any) {
      dispatch(showMessage({ message: error?.message || "Failed to clear.", type: "error" }));
    }
  };

  const idOf = (row: any) => String(row?.id ?? row?._id ?? "");
  const note = "It will no longer show in deleted entries or reports. This cannot be undone.";

  return {
    showClear: canClear,
    onClear: (row: any) => run([idOf(row)].filter(Boolean), `Clear this deleted ${label}? ${note}`),
    onClearAll: (rows: any[]) =>
      run(rows.map(idOf).filter(Boolean), `Clear all ${rows.length} deleted ${label}s shown? ${note}`),
  };
};
