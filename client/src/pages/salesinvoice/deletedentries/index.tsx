import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import {
  useSalesInvoiceMutations,
  useDeletedSalesInvoicesQuery,
} from "../../../graphql/hooks/salesinvoice";
import { showMessage } from "../../../redux/slices/message";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { formatDateDMY } from "../../../utils/helper";

const DeletedSalesInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector(state => selectModuleActions(state, "salesinvoice"));

  const { data, refetch } = useDeletedSalesInvoicesQuery();
  const invoiceList = data?.getDeletedSalesInvoices || [];
  
  const { resetSalesInvoiceMutation } = useSalesInvoiceMutations();

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
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "status" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const tableData = [...invoiceList].reverse().map((invoice: any, index: number) => {
    const totalqty = invoice.productservice.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...invoice,
      seqNo: index + 1,
      billdate: formatDateDMY(invoice.billdate),
      partyacc: `${invoice.partyacc?.accountname ?? "N/A"} - ${invoice.partyacc?.mobile ?? "N/A"}`,
      totalitem: invoice.productservice.length,
      totalqty,
      billtype_billnumber: `${capitalizeFirst(String(invoice.billtype))}-${invoice.billnumber}`,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      createdByDisplay: invoice.createdby_type
        ? `${invoice.createdby_name || "N/A"} (${capitalizeFirst(invoice.createdby_type)})`
        : (invoice.createdby_name || "N/A"),
      status: invoice.status ? "Active" : "Inactive",
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
          showReset={actions.canReset}
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
