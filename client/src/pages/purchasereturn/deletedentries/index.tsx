import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showLoading, hideLoading } from "../../../redux/slices/loader";
import { showMessage } from "../../../redux/slices/message";
import {
  useDeletedPurchaseReturnsQuery,
  usePurchaseReturnMutations,
} from "../../../graphql/hooks/purchasereturn";

const DeletedPurchaseReturns = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector(state => selectModuleActions(state, "purchasereturn"));
  const { data, refetch } = useDeletedPurchaseReturnsQuery();
  const { resetPurchaseReturnMutation } = usePurchaseReturnMutations();

  const list = data?.getDeletedPurchaseReturns || [];

  useEffect(() => {
    const fetch = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } finally {
        dispatch(hideLoading());
      }
    };
    fetch();
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "DN No", key: "billnumber" },
    { label: "Against", key: "sourceBillNumber" },
    { label: "Date", key: "returndate" },
    { label: "Vendor", key: "partyacc" },
    { label: "Amount", key: "totalamount" },
    { label: "Created By", key: "createdByDisplay" },
  ];

  const rows = list.map((r: any, i: number) => ({
    ...r,
    seqNo: i + 1,
    partyacc: `${r.partyacc?.accountname ?? "N/A"} - ${r.partyacc?.mobile ?? ""}`,
    createdByDisplay: r.createdby_name || "N/A",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Purchase Returns"
          columns={columns}
          data={rows}
          showAdd={false}
          showEdit={false}
          showDelete={false}
          showView={false}
          showImport={false}
          showExport={false}
          showReset={actions.canReset}
          showDeleted={false}
          onReset={async (row) => {
            if (!window.confirm(`Restore Purchase Return ${row.billnumber}?`)) return;
            try {
              await resetPurchaseReturnMutation({ variables: { id: row.id } });
              dispatch(showMessage({ message: "Restored successfully.", type: "success" }));
              navigate("/purchasereturn");
            } catch (e) {
              dispatch(showMessage({ message: "Restore failed.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/purchasereturn")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedPurchaseReturns;
