import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useSalesInvoiceMutations,
  useDeletedSalesInvoicesQuery,
} from "../../../graphql/hooks/salesinvoice";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";

const DeletedSalesInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data, refetch } = useDeletedSalesInvoicesQuery();
  const { resetSalesInvoiceMutation } = useSalesInvoiceMutations();

  const invoiceList = data?.getDeletedSalesInvoices || [];

  const { data: accountData } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const accountsMap = new Map(accountsList.map((acc:any) => [acc.id, acc]));

  useEffect(() => {
    if (!data || !data.getDeletedSalesInvoices || data.getDeletedSalesInvoices.length === 0) {
      refetch();
    }
  }, [data, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Payment Type", key: "paymenttype" },
    { label: "Party A/c", key: "partyacc" },
    { label: "Total Items", key: "totalitem" },
    { label: "Total Qty", key: "totalqty" },
    { label: "Billing Date", key: "billdate" },
    { label: "Billing No", key: "billtype_billnumber" },
    { label: "Total Amount", key: "totalamount" },
    { label: "Status", key: "status" },
  ];

  // Then map your invoices
  const tableData = invoiceList.map((invoice: any, index: number) => {
    const totalqty = invoice.products.reduce((sum: number, p: any) => sum + (p.qty || 0), 0);
    const account = accountsMap.get(invoice.partyacc);
    return {
      ...invoice,
      seqNo: index + 1,
      totalitem: invoice.products.length,
      totalqty,
      billtype_billnumber: `${invoice.billtype}-${invoice.billnumber}`,
      status: invoice.status ? "Active" : "Inactive",
      partyacc: account ? `${account.name} - ${account.mobile}` : invoice.partyacc,
    };
});

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Sales Invoices"
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
          onReset={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to reset deleted invoice "${row.billnumber}"?`
              )
            ) {
              try {
                await resetSalesInvoiceMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Sales invoice reset successfully.",
                    type: "success",
                  })
                );
                navigate(-1);
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset sales invoice.",
                    type: "error",
                  })
                );
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

export default DeletedSalesInvoices;
