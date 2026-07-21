import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { useDeletedChargeRulesQuery, useChargeRuleMutations } from "../../../graphql/hooks/chargerules";
import { showMessage } from "../../../redux/slices/message";

const ChargeRuleDeletedEntries = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "chargerules"));
  const { admin } = useAppSelector((s: any) => s.auth);
  const adminId = admin?.id;

  const { data, refetch } = useDeletedChargeRulesQuery(adminId);
  const { resetChargeRule } = useChargeRuleMutations();

  const deleted = data?.getDeletedChargeRules || [];

  useEffect(() => {
    if (!data || !data.getDeletedChargeRules || data.getDeletedChargeRules.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  // Same columns as the main Charge Rules listing.
  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Charge", key: "name" },
    { label: "Type", key: "typeText" },
    { label: "Value", key: "valueText" },
    { label: "Applies To", key: "appliesText" },
    { label: "Payment", key: "paymentText" },
    { label: "Free Above", key: "freeText" },
    { label: "Active", key: "activeText" },
  ];

  const tableData = [...deleted].reverse().map((r: any, i: number) => ({
    ...r,
    seqNo: i + 1,
    typeText: r.chargeType === "percent" ? "Percent" : "Flat",
    valueText: r.chargeType === "percent" ? `${r.value}%` : `₹${r.value}`,
    appliesText: r.applyToCreatorTypes?.length ? r.applyToCreatorTypes.join(", ") : "Everyone",
    paymentText: r.paymentTypes?.length ? r.paymentTypes.join(", ").toUpperCase() : "Any",
    freeText: r.freeAboveValue ? `₹${r.freeAboveValue}` : "—",
    activeText: r.active ? "Active" : "Off",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Charge Rules — Deleted Entries"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          showReset={actions.canReset}
          onReset={async (row: any) => {
            if (!window.confirm(`Restore charge rule "${row.name}"?`)) return;
            try {
              await resetChargeRule({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Charge rule restored.", type: "success" }));
              navigate("/chargerules");
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to restore.", type: "error" }));
            }
          }}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default ChargeRuleDeletedEntries;
