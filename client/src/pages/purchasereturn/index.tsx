import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  usePurchaseReturnsQuery,
  usePurchaseReturnMutations,
} from "../../graphql/hooks/purchasereturn";

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");

const PurchaseReturns = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "purchasereturn"));
  const dispatch = useAppDispatch();
  const { data, refetch } = usePurchaseReturnsQuery();
  const { deletePurchaseReturnMutation } = usePurchaseReturnMutations();
  const isLoading = useAppSelector((s) => s.loader.isLoading);

  const list = data?.getPurchaseReturns || [];

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
    { label: "Items", key: "totalitem" },
    { label: "Total Qty", key: "totalqty" },
    { label: "Amount", key: "totalamount" },
    { label: "Refund", key: "refundLabel" },
    { label: "Status", key: "statusLabel" },
  ];

  const tableData = list.map((r: any, i: number) => ({
    ...r,
    seqNo: i + 1,
    partyacc: `${r.partyacc?.accountname ?? "N/A"} - ${r.partyacc?.mobile ?? ""}`,
    totalitem: r.productservice?.length || 0,
    totalqty: r.productservice?.reduce((s: number, p: any) => s + (p.qty || 0), 0) || 0,
    refundLabel: cap(r.refundMode),
    statusLabel: r.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Manage Purchase Returns (Debit Notes)"
          columns={columns}
          data={tableData}
          
          
          
          
          
          
          showDeleted={true}
          onAdd={() => navigate("/purchasereturn/addedit")}
          onEdit={(row) => navigate(`/purchasereturn/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete Purchase Return ${row.billnumber}?`)) return;
            try {
              await deletePurchaseReturnMutation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Purchase return deleted.", type: "success" }));
            } catch (e) {
              dispatch(showMessage({ message: "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/purchasereturn/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default PurchaseReturns;
