// src/pages/payments/index.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  usePaymentsListQuery,
  usePaymentMutations,
} from "../../graphql/hooks/payments";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useAccountsLiteQuery } from "../../graphql/hooks/accounts";
import { selectModuleActions } from "../../redux/slices/permissions";
import { formatDateDMY } from "../../utils/helper";
import { paymentPartyLabel } from "../../utils/partylabel";

const Payment = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "payments"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // Lite listing query — only the table columns.
  const { data, refetch } = usePaymentsListQuery();
  const { deletePaymentMutation } = usePaymentMutations();

  const paymentList = data?.getPayments || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const { data: accountsData, refetch: accountsDataRefetch } = useAccountsLiteQuery();

  useEffect(() => {
    const fetchPayments = async () => {
      // Rows already in the cache (e.g. straight after a save, which writes
      // the new payment into it) → refresh quietly instead of blocking the
      // whole table behind the loader.
      const blocking = !data?.getPayments?.length;
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

  // Payments also arrive from elsewhere — staff and parties on the mobile app,
  // another admin tab, invoices with auto-receipt. Re-check quietly whenever
  // this tab comes back into view, so nobody has to hit browser refresh.
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
    // Who the money actually moved with. Without it two ₹720 receipts on the
    // same day are indistinguishable in the list.
    { label: "Party / Ledger", key: "partyDisplay" },
    { label: "Mode", key: "mode" },
    { label: "Date", key: "paymentdate" },
    { label: "Ledger", key: "ledgername" },
    { label: "Amount", key: "amount" },
    // How much of this payment is still floating (Tally's "On Account"), and
    // whether the bills were picked by hand or proposed by FIFO. Both exist so
    // an allocation can always be explained after the fact.
    { label: "Unallocated", key: "unallocatedDisplay" },
    { label: "Settlement", key: "settlementDisplay" },
    { label: "Created By", key: "createdByDisplay" },
    { label: "Status", key: "status" },
  ];

  const tableData = [...paymentList].reverse().map((pay: any, index: number) => {
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
      seqNo: index + 1,
      paymentdate: formattedDate,
      type: capitalizeFirstLetter(pay.type),
      partyDisplay,
      mode: capitalizeFirstLetter(pay.mode),
      ledgername: pay?.ledgerid?.ledgername || "-",
      amount: pay.amount?.toFixed(2) || "0.00",
      unallocatedDisplay:
        Number(pay.unallocatedamount) > 0 ? Number(pay.unallocatedamount).toFixed(2) : "-",
      // Mirror the two labels on the payment form's Settlement Mode toggle and
      // nothing more. The per-bill / opening breakdown lives on the payment
      // itself, where there's room to show it properly.
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
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default Payment;
