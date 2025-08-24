import { useAppDispatch } from "../../../redux/hooks";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  usePurchaseInvoiceMutations,
  useDeletedPurchaseInvoicesQuery,
} from "../../../graphql/hooks/purchaseinvoice";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";

const DeletedPurchaseInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { data, refetch } = useDeletedPurchaseInvoicesQuery();
  const invoiceList = data?.getDeletedPurchaseInvoices || [];
  console.log("Deleted Purchase Invoices:", JSON.stringify(invoiceList));
  const { resetPurchaseInvoiceMutation } = usePurchaseInvoiceMutations();
  const { data: accountData } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const accountsMap = new Map(accountsList.map((acc: any) => [acc.id, acc]));

  const { data: productData, refetch: productRefetch } = useProductServicesQuery();
  const productList = productData?.getProductServices ?? [];
  const productMap = new Map(productList.map((p: any) => [p.id, p.name]));

  useEffect(() => {
    if (!data || !data.getDeletedPurchaseInvoices || data.getDeletedPurchaseInvoices.length === 0) {
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

  const tableData = invoiceList.map((invoice: any, index: number) => {
      const totalqty = invoice.productservice.reduce(
        (sum: number, p: any) => sum + (p.qty || 0),
        0
      );

      const account = accountsMap.get(invoice.partyacc);

      const productname = invoice.productservice
        .map((p: any) => productMap.get(p.productserviceid) || "Unknown")
        .join(", ");

      return {
        ...invoice,
        seqNo: index + 1,
        totalitem: invoice.productservice.length,
        totalqty,
        billtype_billnumber: `${invoice.billtype}-${invoice.billnumber}`,
        status: invoice.status ? "Active" : "Inactive",
        partyacc: account
          ? `${account.name} - ${account.mobile}`
          : invoice.partyacc,
        productname,
      };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Deleted Purchase Invoices"
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
                `Are you sure you want to reset deleted purchase invoice "${row.billnumber}"?`
              )
            ) {
              try {
                await resetPurchaseInvoiceMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Purchase invoice reset successfully.",
                    type: "success",
                  })
                );
                navigate(-1);
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to reset purchase invoice.",
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

export default DeletedPurchaseInvoices;
