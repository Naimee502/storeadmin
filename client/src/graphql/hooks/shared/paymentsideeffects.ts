// Queries that must be re-fetched after any mutation whose SERVER-side handler
// auto-creates, updates or removes a Payment / Transaction as a side effect.
//
// Sales Invoice, Purchase Invoice, Sales Return, Purchase Return and Expense
// Note all do this (see `adjustStockAndTransactions` in the respective models,
// and `ExpenseNote.createJournalAndPayment`). Apollo has no way to know about
// it — it only sees the mutation's own response — so the GetPayments /
// GetTransactions caches silently go stale.
//
// The visible bug that caused this: create a cash Sales Invoice with
// auto-entry ON, then open Payments ▸ Add and pick that party. The invoice
// shows up as fully outstanding even though the server already settled it,
// because `paidByInvoice` was built from the stale cache. A hard refresh
// "fixed" it, which is the tell-tale sign of a cache problem.
//
// Referenced by operation NAME (not query document + variables) on purpose:
// Apollo then refetches every ACTIVE query with that name whatever its
// variables, so a branch switch or a differently-filtered list can't slip
// through. Queries that aren't mounted are covered by the `cache-and-network`
// default on usePaymentsQuery / useTransactionsQuery.
export const PAYMENT_SIDE_EFFECT_QUERIES = ["GetPayments", "GetTransactions"];
