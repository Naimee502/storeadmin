import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showMessage } from "../../../redux/slices/message";
import { useClearDeleted } from "../../../graphql/hooks/common";
import { quotationNo, useDeletedQuotationsQuery, useQuotationMutations } from "../../../graphql/hooks/quotation";
import { formatDateDMY } from "../../../utils/helper";
import { customerOf } from "..";

const DeletedQuotations = () => {
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "quotations"));
  const { data, refetch, loading } = useDeletedQuotationsQuery();
  const { resetQuotation } = useQuotationMutations();
  const clear = useClearDeleted("quotations", refetch, "quotation");

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Quotation No", key: "billnumber" },
    { label: "Date", key: "billdate" },
    { label: "Customer", key: "customer" },
    { label: "Amount", key: "totalamount" },
  ];
  const rows = (data?.getDeletedQuotations || []).map((q: any, i: number) => ({
    id: q.id,
    seqNo: i + 1,
    billnumber: quotationNo(q),
    billdate: formatDateDMY(q.billdate),
    customer: customerOf(q).name || "—",
    totalamount: `₹${Number(q.totalamount || 0).toFixed(2)}`,
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Quotations"
          columns={columns}
          data={rows}
          showView={false}
          showEdit={false}
          showDelete={false}
          showAdd={false}
          showImport={false}
          showExport={false}
          showDeleted={false}
          showReset={actions.canReset}
          onReset={async (row: any) => {
            if (!window.confirm(`Restore ${row.billnumber}?`)) return;
            try {
              await resetQuotation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Quotation restored.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Could not restore.", type: "error" }));
            }
          }}
          {...clear}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedQuotations;
