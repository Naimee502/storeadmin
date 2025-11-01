import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showMessage } from "../../../redux/slices/message";
import {
  useAccountsQuery,
  useAccountMutations
} from "../../../graphql/hooks/accounts";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";

const DeletedAccounts = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // ✅ Use unified query with status = false
  const { data, refetch } = useAccountsQuery(false);
  const { data: ledgerData } = useAccountLedgersQuery();
  const { resetAccountMutation } = useAccountMutations();

  const deletedAccounts = data?.getAccounts || [];
  const ledgerList = ledgerData?.getAccountLedgers || [];

  useEffect(() => {
    if (!data || !data.getAccounts || data.getAccounts.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Account Code", key: "accountcode" },
    { label: "Name", key: "name" },
    { label: "Mobile", key: "mobile" },
    { label: "Email", key: "email" },
    { label: "Account Ledger", key: "ledgername" },
    { label: "Status", key: "status" },
  ];

  const tableData = deletedAccounts.map((account: any, index: number) => {
    const ledgerId = typeof account.ledgerid === "string"
      ? account.ledgerid
      : account.ledgerid?.id || account.ledgerid?._id;

    const ledger = ledgerList.find((g) => g.id === ledgerId);

    return {
      ...account,
      seqNo: index + 1,
      status: account.status ? "Active" : "Inactive",
      ledgername: ledger ? ledger.ledgername : "-",
    };
  });
  
  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Accounts"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          showReset={true}
          onReset={async (row: any) => {
            if (window.confirm(`Are you sure you want to reset deleted account "${row.name}"?`)) {
              try {
                await resetAccountMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Account reset successfully.", type: "success" }));
                navigate("/accounts");
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to reset account.", type: "error" }));
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

export default DeletedAccounts;
