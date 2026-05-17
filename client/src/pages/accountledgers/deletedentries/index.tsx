import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {  
  useAccountLedgerMutations,
  useDeletedAccountLedgersQuery
} from "../../../graphql/hooks/accountledgers";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const DeletedAccountLedgers = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "accountledgers"));
  const dispatch = useAppDispatch();
  const { data, refetch } = useDeletedAccountLedgersQuery();
  const { resetAccountLedgerMutation } = useAccountLedgerMutations();
  const ledgerList = data?.getDeletedAccountLedgers || [];

  useEffect(() => {
    if (!data || !data.getDeletedAccountLedgers || data.getDeletedAccountLedgers.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq#", key: "seqNo" },
    { label: "Ledger Code", key: "ledgercode" },
    { label: "Ledger Name", key: "ledgername" },
    { label: "Group", key: "accountgroup" },
    { label: "Type", key: "ledgertype" },
    { label: "Status", key: "status" },
  ];

  const tableData = ledgerList.map((lg: any, index: number) => ({
    ...lg,
    seqNo: index + 1,
    accountgroup: lg.accountgroupid?.accountgroupname ?? "-",
    ledgertype: lg.ledgertype || "-",
    status: lg.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          {...actions}
          title="Deleted Account Ledgers"
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
          onReset={async (row) => {
            if (window.confirm(`Restore deleted ledger "${row.ledgername}"?`)) {
              try {
                await resetAccountLedgerMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Account Ledger restored.", type: "success" }));
                navigate("/accountledgers");
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to restore ledger.", type: "error" }));
              }
            }
          }}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedAccountLedgers;
