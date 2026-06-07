import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addSalesInvoices } from "../../redux/slices/salesinvoice";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import {
  useSalesInvoicesQuery,
  useSalesInvoiceMutations,
} from "../../graphql/hooks/salesinvoice";
import { useSalesReturnsQuery } from "../../graphql/hooks/salesreturn";
import PrintableInvoice from "../../components/printinvoice";
import { useReactToPrint } from "react-to-print";
import { selectModuleActions } from "../../redux/slices/permissions";


const SalesInvoices = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const M = "salesinvoice";
  const actions = useAppSelector(state => selectModuleActions(state, M));
  
  const { data, refetch } = useSalesInvoicesQuery();
  const { deleteSalesInvoiceMutation } = useSalesInvoiceMutations();
  const invoiceList = data?.getSalesInvoices || [];
  console.log("Fetched Sales Invoices:", JSON.stringify(invoiceList));
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Build a Set of source-invoice ids that already have an active Sales
  // Return. Used to hide the per-row "Return" action so the user cannot
  // create a duplicate return against the same invoice. (Server still
  // validates per-line quantities as a safety net.)
  const { data: returnsData } = useSalesReturnsQuery();
  const returnedInvoiceIds = useMemo(() => {
    const set = new Set<string>();
    (returnsData?.getSalesReturns ?? []).forEach((r: any) => {
      if (r.sourceInvoiceId) set.add(String(r.sourceInvoiceId));
    });
    return set;
  }, [returnsData]);

  // Resolve the company name across role types so the WhatsApp share
  // signs the message off as the company, not the branch.
  const auth = useAppSelector((state) => state.auth);
  const companyName =
    auth.type === "admin"
      ? auth.admin?.companyName
      : auth.type === "branch"
        ? auth.branch?.admin?.companyName
        : auth.type === "staff"
          ? auth.staff?.admin?.companyName
          : "";

  // Open WhatsApp web/app with a pre-filled invoice summary. If the
  // customer has a stored mobile we open the chat directly with them;
  // otherwise we fall back to the share-text sheet.
  const handleWhatsAppShare = (row: any) => {
    const orig = invoiceList.find((inv: any) => inv.id === row.id);
    if (!orig) return;

    const mobile = (orig.partyacc?.mobile || "").replace(/\D/g, "");
    const items = (orig.productservice || [])
      .map(
        (p: any, i: number) =>
          `${i + 1}. ${p.productserviceid?.name ?? "Item"} x ${p.qty} @ ${Number(p.rate).toFixed(2)}`
      )
      .join("\n");

    const text =
      `*Invoice INV-${orig.billnumber}*\n` +
      `Date: ${orig.billdate}\n` +
      `Customer: ${orig.partyacc?.accountname ?? "-"}\n\n` +
      `${items}\n\n` +
      `Total: ₹ ${Number(orig.totalamount).toFixed(2)}\n\n` +
      `Thank you for your business!\n` +
      `${companyName ? `— ${companyName}` : ""}`;

    // wa.me requires a phone number with country code; if missing we
    // fall back to the bare share link which prompts the user to pick
    // a chat manually.
    const url = mobile
      ? `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Use ref for the printable component
  const componentRef = useRef<HTMLDivElement>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const [readyToPrint, setReadyToPrint] = useState(false);

  // React-to-Print hook setup
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "Sales Invoice",
    onAfterPrint: () => {
      setPrintInvoice(null);
      setReadyToPrint(false);
    },
    onPrintError: (error) => {
      console.error("Print error:", error);
    },
  });

  useEffect(() => {
    const fetchInvoices = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getSalesInvoices) {
          dispatch(addSalesInvoices(data.getSalesInvoices));
        }
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchInvoices();
  }, [dispatch, refetch]);

  // Step 1: When printInvoice is set, trigger readyToPrint
  useEffect(() => {
    if (printInvoice) {
      setReadyToPrint(true);
    }
  }, [printInvoice]);

  // Step 2: When readyToPrint and ref available, call handlePrint
  useEffect(() => {
    if (readyToPrint && componentRef.current) {
      handlePrint?.();
    }
  }, [readyToPrint, handlePrint]);

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
    { label: "Ordered By", key: "orderedByDisplay" },
    { label: "Delivery", key: "deliveryDisplay" },
    { label: "Status", key: "status" },
  ];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const tableData = invoiceList.map((invoice: any, index: number) => {
    const totalqty = invoice.productservice.reduce(
      (sum: number, p: any) => sum + (p.qty || 0),
      0
    );

    return {
      ...invoice,
      seqNo: index + 1,
      partyacc: `${invoice.partyacc?.accountname ?? "N/A"} - ${invoice.partyacc?.mobile ?? "N/A"}`,
      totalitem: invoice.productservice.length,
      totalqty,
      billtype_billnumber: `INV-${invoice.billnumber}`,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      createdByDisplay: invoice.createdby_type
        ? `${invoice.createdby_name || "N/A"} (${capitalizeFirst(invoice.createdby_type)})`
        : (invoice.createdby_name || "N/A"),
      orderedByDisplay: invoice.orderedby_name
        ? `${invoice.orderedby_name} (${invoice.orderedby_type ? capitalizeFirst(invoice.orderedby_type) : "Order"})`
        : "—",
      deliveryDisplay: (() => {
        const ds = invoice.deliveryStatus || "pending";
        const label = capitalizeFirst(ds);
        return ds === "delivered" && invoice.deliveredByName
          ? `${label} · ${invoice.deliveredByName}`
          : label;
      })(),
      status: invoice.status ? "Active" : "Inactive",
    };
  });


  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Sales Invoices"
          columns={columns}
          data={tableData}
          {...actions}
          onWhatsApp={handleWhatsAppShare}
          // Combine the "no duplicate return" rule with the user's
          // permission to perform a return at all.
          showReturn={(row: any) =>
            actions.showReturn && !returnedInvoiceIds.has(String(row.id))
          }
          onReturn={(row) => navigate(`/salesreturn/addedit?fromInvoice=${row.id}`)}
          onView={(row) => navigate(`/salesinvoice/view/${row.id}`)}
          onEdit={(row) => navigate(`/salesinvoice/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (
              window.confirm(
                `Are you sure you want to delete invoice ${row.billnumber}?`
              )
            ) {
              try {
                await deleteSalesInvoiceMutation({
                  variables: { id: row.id },
                });
                await refetch();
                dispatch(
                  showMessage({
                    message: "Invoice deleted successfully.",
                    type: "success",
                  })
                );
              } catch (error) {
                console.error("Delete error:", error);
                dispatch(
                  showMessage({
                    message: "Failed to delete invoice.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onAdd={() => navigate("/salesinvoice/addedit")}
          onShowDeleted={() => navigate("/salesinvoice/deletedentries")}
          onPrint={(row) => {
            setPrintInvoice(row);
          }}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />

        {/* Hidden printable content, positioned offscreen to keep mounted */}
        {printInvoice && (
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <PrintableInvoice ref={componentRef} invoice={printInvoice} />
          </div>
        )}

      </div>
    </HomeLayout>
  );
};

export default SalesInvoices;
