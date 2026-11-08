import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  usePurchaseReturnsPageQuery,
  usePurchaseReturnMutations,
} from "../../graphql/hooks/purchasereturn";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";
import { formatDateDMY } from "../../utils/helper";
import { partyLabel } from "../../utils/partylabel";

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");

// Columns the server can filter (Seq is per page, so it has none).
const SERVER_FILTER_KEYS = [
  "billnumber", "sourceBillNumber", "returndate", "partyacc", "totalitem", "totalqty",
  "totalamount", "refundLabel", "createdByDisplay", "statusLabel",
];

const PurchaseReturns = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "purchasereturn"));
  const dispatch = useAppDispatch();
  // Lite listing query — only the table columns.
  const table = useServerTable("purchasereturn", SERVER_FILTER_KEYS);
  const { items: list, total, loading, refetch } = usePurchaseReturnsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const { deletePurchaseReturnMutation } = usePurchaseReturnMutations();
  const isLoading = useAppSelector((s) => s.loader.isLoading);

  useEffect(() => {
    const fetch = async () => {
      // Cached rows: refresh in the background without the full-screen loader.
      const blocking = !list.length;
      if (blocking) dispatch(showLoading());
      try {
        await refetch();
      } finally {
        if (blocking) dispatch(hideLoading());
      }
    };
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "statusLabel" },
  ];

  const tableData = list.map((r: any, i: number) => ({
    ...r,
    seqNo: table.offset + i + 1,
    returndate: formatDateDMY(r.returndate),
    returndateRaw: r.returndate,
    partyacc: partyLabel(r.partyacc) || "N/A",
    totalitem: r.productservice?.length || 0,
    totalqty: r.productservice?.reduce((s: number, p: any) => s + (p.qty || 0), 0) || 0,
    refundLabel: cap(r.refundMode),
    createdByDisplay: r.createdby_name || "N/A",
    statusLabel: r.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          {...actions}
          title="Manage Purchase Returns (Debit Notes)"
          columns={columns}
          data={tableData}
          serverPaging={serverPaging}
          
          
          
          
          
          
          showDeleted={actions.showDeleted}
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
          isLoading={loading || isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default PurchaseReturns;
