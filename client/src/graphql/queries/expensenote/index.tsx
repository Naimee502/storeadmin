import { gql } from "@apollo/client";

/* =========================
   QUERIES
   ========================= */

export const GET_EXPENSE_NOTES = gql`
  query GetExpenseNotes($filter: ExpenseNoteFilterInput) {
    getExpenseNotes(filter: $filter) {
      id
      adminid
      branchid
      expensenumber
      expensedate
      paymenttype
      ledgerid {
        id
        ledgername
      }
      narration
      notes
      expenses {
        expenseledgerid {
          id
          ledgername
        }
        amount
        gstpercent
        remarks
      }
      totalamount
      totalgst
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_DELETED_EXPENSE_NOTES = gql`
  query GetDeletedExpenseNotes($filter: ExpenseNoteFilterInput) {
    getDeletedExpenseNotes(filter: $filter) {
      id
      adminid
      branchid
      expensenumber
      expensedate
      paymenttype
      ledgerid {
        id
        ledgername
      }
      narration
      notes
      expenses {
        expenseledgerid {
          id
          ledgername
        }
        amount
        gstpercent
        remarks
      }
      totalamount
      totalgst
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_EXPENSE_NOTE_BY_ID = gql`
  query GetExpenseNoteById($id: ID!, $adminid: ID) {
    getExpenseNoteById(id: $id, adminid: $adminid) {
      id
      adminid
      branchid
      expensenumber
      expensedate
      paymenttype
      ledgerid {
        id
        ledgername
      }
      narration
      notes
      expenses {
        expenseledgerid {
          id
          ledgername
        }
        amount
        gstpercent
        remarks
      }
      totalamount
      totalgst
      status
      createdAt
      updatedAt
    }
  }
`;

/* =========================
   MUTATIONS
   ========================= */

export const ADD_EXPENSE_NOTE = gql`
  mutation AddExpenseNote($input: ExpenseNoteInput!) {
    addExpenseNote(input: $input) {
      id
      adminid
      branchid
      expensenumber
      expensedate
      paymenttype
      ledgerid {
        id
        ledgername
      }
      narration
      notes
      expenses {
        expenseledgerid {
          id
          ledgername
        }
        amount
        gstpercent
        remarks
      }
      totalamount
      totalgst
      status
      createdAt
      updatedAt
    }
  }
`;

export const EDIT_EXPENSE_NOTE = gql`
  mutation EditExpenseNote($id: ID!, $input: ExpenseNoteInput!) {
    editExpenseNote(id: $id, input: $input) {
      id
      adminid
      branchid
      expensenumber
      expensedate
      paymenttype
      ledgerid {
        id
        ledgername
      }
      narration
      notes
      expenses {
        expenseledgerid {
          id
          ledgername
        }
        amount
        gstpercent
        remarks
      }
      totalamount
      totalgst
      status
      createdAt
      updatedAt
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
