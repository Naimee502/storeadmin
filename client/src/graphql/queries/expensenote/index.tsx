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

// Queries

export const GET_EXPENSE_NOTES = gql`
  query GetExpenseNotes($filter: ExpenseNoteFilterInput) {
    getExpenseNotes(filter: $filter) {
      ${EXPENSE_NOTE_FIELDS}
    }
  }
`;

// Listing page: table columns only.
export const GET_EXPENSE_NOTES_LIST = gql`
  query GetExpenseNotesList($filter: ExpenseNoteFilterInput) {
    getExpenseNotes(filter: $filter) {
      id
      expensenumber
      expensedate
      paymenttype
      ledgerid { id ledgername }
      category
      staffid {
        id
        name
        staffcode
      }
      narration
      totalamount
      totalgst
      createdby_name
      createdby_type
      status
      createdAt
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

// Lazily fetch (or create) the "tada"/"salary" expense ledger.
export const GET_EXPENSE_CATEGORY_LEDGER = gql`
  query GetExpenseCategoryLedger($adminid: ID!, $category: String!) {
    getExpenseCategoryLedger(adminid: $adminid, category: $category) {
      id
      ledgername
    }
  }
`;

// Mutations

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

// One page of the Expense Notes list (same fields as GET_EXPENSE_NOTES_LIST).
export const GET_EXPENSE_NOTES_PAGE = gql`
  query GetExpenseNotesPage(
    $filter: ExpenseNoteFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getExpenseNotesPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        expensenumber
        expensedate
        paymenttype
        ledgerid { id ledgername }
        category
        staffid {
          id
          name
          staffcode
        }
        narration
        totalamount
        totalgst
        createdby_name
        createdby_type
        status
        createdAt
      }
    }
  }
`;
