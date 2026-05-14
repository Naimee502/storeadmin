import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesReturnsQuery,
  useSalesReturnMutations,
} from "../../graphql/hooks/salesreturn";

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");

const SalesReturns = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "salesreturn"));
  const dispatch = useAppDispatch();
  const { data, refetch } = useSalesReturnsQuery();
  const { deleteSalesReturnMutation } = useSalesReturnMutations();
  const isLoading = useAppSelector((s) => s.loader.isLoading);

  const list = data?.getSalesReturns || [];

  useEffect(() => {
    const fetch = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (e) {
        console.error("Sales Return fetch error", e);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetch();
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "CN No", key: "billnumber" },
    { label: "Against", key: "sourceBillNumber" },
    { label: "Date", key: "returndate" },
    { label: "Customer", key: "partyacc" },
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
          title="Manage Sales Returns (Credit Notes)"
          columns={columns}
          data={tableData}
          
          
          
          
          
          
          showDeleted={true}
          onAdd={() => {
            // No source picked yet → user lands on "select invoice" mode
            navigate("/salesreturn/addedit");
          }}
          onEdit={(row) => navigate(`/salesreturn/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete Sales Return ${row.billnumber}?`)) return;
            try {
              await deleteSalesReturnMutation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Sales return deleted.", type: "success" }));
            } catch (e) {
              console.error(e);
              dispatch(showMessage({ message: "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/salesreturn/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default SalesReturns;
