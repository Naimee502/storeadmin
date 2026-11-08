// src/pages/payments/index.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  usePaymentsPageQuery,
  usePaymentMutations,
} from "../../graphql/hooks/payments";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useAccountsLiteQuery } from "../../graphql/hooks/accounts";
import { selectModuleActions } from "../../redux/slices/permissions";
import { formatDateDMY } from "../../utils/helper";
import { paymentPartyLabel } from "../../utils/partylabel";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";

// Columns the server can filter (Seq is per page, so it has none).
const SERVER_FILTER_KEYS = [
  "paymentcode", "type", "partyDisplay", "mode", "paymentdate", "ledgername",
  "amount", "unallocatedDisplay", "settlementDisplay", "createdByDisplay", "status",
];

const Payment = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "payments"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // One page of the listing — only the table columns.
  const table = useServerTable("payments", SERVER_FILTER_KEYS);
  const { items: paymentList, total, loading, refetch } = usePaymentsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const { deletePaymentMutation } = usePaymentMutations();

  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const { data: accountsData, refetch: accountsDataRefetch } = useAccountsLiteQuery();

  useEffect(() => {
    const fetchPayments = async () => {
      // Rows already cached: refresh quietly without the full-screen loader.
      const blocking = !paymentList.length;
      if (blocking) dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        if (blocking) dispatch(hideLoading());
      }
    };
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, refetch]);

  // Payments also come from the app and other tabs; refetch when this tab is visible.
  useEffect(() => {
    // Switching tabs fires both events; one fetch is enough.
    let last = 0;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 3000) return;
      last = Date.now();
      refetch().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refetch]);

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Code", key: "paymentcode" },
    { label: "Type", key: "type" },
    // Party or ledger the money moved with.
    { label: "Party / Ledger", key: "partyDisplay" },
    { label: "Mode", key: "mode" },
    { label: "Date", key: "paymentdate" },
    { label: "Ledger", key: "ledgername" },
    { label: "Amount", key: "amount" },
    // Unallocated (On Account) amount and whether bills were picked by hand or FIFO.
    { label: "Unallocated", key: "unallocatedDisplay" },
    { label: "Settlement", key: "settlementDisplay" },
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "status" },
  ];

  const tableData = paymentList.map((pay: any, index: number) => {
    // Format date
    let formattedDate = "-";
    if (pay.paymentdate) {
      const ts = Number(pay.paymentdate);
      const dt = new Date(ts);
      if (!isNaN(dt.getTime())) formattedDate = formatDateDMY(dt);
    }

    // Capitalize first letter
    const capitalizeFirstLetter = (str?: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "-";

    const partyDisplay = paymentPartyLabel(pay, accountsData?.getAccounts);

    return {
      ...pay,
      seqNo: table.offset + index + 1,
      paymentdate: formattedDate,
      type: capitalizeFirstLetter(pay.type),
      partyDisplay,
      mode: capitalizeFirstLetter(pay.mode),
      ledgername: pay?.ledgerid?.ledgername || "-",
      amount: pay.amount?.toFixed(2) || "0.00",
      unallocatedDisplay:
        Number(pay.unallocatedamount) > 0 ? Number(pay.unallocatedamount).toFixed(2) : "-",
      // Same labels as the form's Settlement Mode toggle.
      settlementDisplay:
        pay.allocationmode === "auto_fifo" || pay.allocationmode === "on_account"
          ? "Direct / On Account"
          : "Invoice-wise",
      createdByDisplay: pay.createdby_name || "N/A",
      status: pay.status ? "Active" : "Inactive",
    };
  });

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable requireBranchForAdd={true}
          title="Manage Payments"
          columns={columns}
          data={tableData}
          serverPaging={serverPaging}
          {...actions}
          onEdit={(row) => navigate(`/payments/addedit/${row.id}`)}
          onDelete={async (row: any) => {
            if (window.confirm(`Delete payment ${row.paymentcode}?`)) {
              try {
                await deletePaymentMutation({ variables: { id: row.id } });
                dispatch(
                  showMessage({
                    message: "Payment deleted successfully.",
                    type: "success",
                  })
                );
                await refetch();
              } catch (err) {
                console.error("Delete error:", err);
                dispatch(
                  showMessage({
                    message: "Failed to delete payment.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onAdd={() => navigate("/payments/addedit")}
          onShowDeleted={() => navigate("/payments/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={loading || isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default Payment;
