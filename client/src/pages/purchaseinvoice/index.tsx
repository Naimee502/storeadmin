import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addPurchaseInvoices } from "../../redux/slices/purchaseinvoice";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { usePurchaseInvoicesQuery, usePurchaseInvoiceMutations } from "../../graphql/hooks/purchaseinvoice";
import { useAccountsQuery } from "../../graphql/hooks/accounts";

const PurchaseInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, refetch } = usePurchaseInvoicesQuery();
  const { deletePurchaseInvoiceMutation } = usePurchaseInvoiceMutations();
  const invoiceList = data?.getPurchaseInvoices || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const { data: accountData } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const accountsMap = new Map(accountsList.map((acc: any) => [acc.id, acc]));

  useEffect(() => {
    const fetchInvoices = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.purchaseinvoices) {
          dispatch(addPurchaseInvoices(data.purchaseinvoices));
        }
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchInvoices();
  }, [dispatch, refetch]);

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

  const tableData = invoiceList.map((invoice: any, index: number) => {
    const totalqty = invoice.products.reduce((sum: number, p: any) => sum + (p.qty || 0), 0);
    const account = accountsMap.get(invoice.partyacc);
    return {
      ...invoice,
      seqNo: index + 1,
      totalitem: invoice.products.length,
      totalqty,
      billtype_billnumber: `${invoice.billtype}-${invoice.billnumber}`,
      status: "Active",
      partyacc: account ? `${account.name} - ${account.mobile}` : invoice.partyacc,
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Purchase Invoices"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={true}
          onView={(row) => navigate(`/purchaseinvoice/view/${row.id}`)}
          onEdit={(row) => navigate(`/purchaseinvoice/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete invoice ${row.billnumber}?`)) {
              try {
                await deletePurchaseInvoiceMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: 'Invoice deleted successfully.', type: 'success' }));
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(showMessage({ message: 'Failed to delete invoice.', type: 'error' }));
              }
            }
          }}
          onAdd={() => navigate("/purchaseinvoice/addedit")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default PurchaseInvoices;
