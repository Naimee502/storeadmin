import { gql } from "@apollo/client";

const EXPENSE_NOTE_FIELDS = `
  id
  adminid
  branchid
  expensenumber
  expensedate
  paymenttype
  ledgerid { id ledgername }
  category
  staffid {
    id
    name
    staffcode
    role
    ledgerid
    salary
  }
  salaryPeriod
  narration
  notes
  expenses {
    expenseledgerid { id ledgername }
    amount
    gstpercent
    remarks
  }
  totalamount
  totalgst
  createdby_id
  createdby_name
  createdby_type
  status
  createdAt
  updatedAt
`;

/* =========================
   QUERIES
   ========================= */

export const GET_EXPENSE_NOTES = gql`
  query GetExpenseNotes($filter: ExpenseNoteFilterInput) {
    getExpenseNotes(filter: $filter) {
      ${EXPENSE_NOTE_FIELDS}
    }
  }
`;

export const GET_DELETED_EXPENSE_NOTES = gql`
  query GetDeletedExpenseNotes($filter: ExpenseNoteFilterInput) {
    getDeletedExpenseNotes(filter: $filter) {
      ${EXPENSE_NOTE_FIELDS}
    }
  }
`;

export const GET_EXPENSE_NOTE_BY_ID = gql`
  query GetExpenseNoteById($id: ID!, $adminid: ID) {
    getExpenseNoteById(id: $id, adminid: $adminid) {
      ${EXPENSE_NOTE_FIELDS}
    }
  }
`;

// Used by the form to lazily fetch (and create if missing) the canonical
// expense ledger for "tada" or "salary".
export const GET_EXPENSE_CATEGORY_LEDGER = gql`
  query GetExpenseCategoryLedger($adminid: ID!, $category: String!) {
    getExpenseCategoryLedger(adminid: $adminid, category: $category) {
      id
      ledgername
    }
  }
`;

/* =========================
   MUTATIONS
   ========================= */

export const ADD_EXPENSE_NOTE = gql`
  mutation AddExpenseNote($input: ExpenseNoteInput!) {
    addExpenseNote(input: $input) {
      ${EXPENSE_NOTE_FIELDS}
    }
  }
`;

export const EDIT_EXPENSE_NOTE = gql`
  mutation EditExpenseNote($id: ID!, $input: ExpenseNoteInput!) {
    editExpenseNote(id: $id, input: $input) {
      ${EXPENSE_NOTE_FIELDS}
    }
  }
`;

export const DELETE_EXPENSE_NOTE = gql`
  mutation DeleteExpenseNote($id: ID!) {
    deleteExpenseNote(id: $id)
  }
`;

export const RESET_EXPENSE_NOTE = gql`
  mutation ResetExpenseNote($id: ID!) {
    resetExpenseNote(id: $id)
  }
`;
