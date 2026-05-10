import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "../../../redux/hooks";
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
  ];

  const rows = list.map((r: any, i: number) => ({
    ...r,
    seqNo: i + 1,
    partyacc: `${r.partyacc?.accountname ?? "N/A"} - ${r.partyacc?.mobile ?? ""}`,
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
          showReset={true}
          showDeleted={false}
          onReset={async (row) => {
            if (!window.confirm(`Restore Purchase Return ${row.billnumber}?`)) return;
            try {
              await resetPurchaseReturnMutation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Restored.", type: "success" }));
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
