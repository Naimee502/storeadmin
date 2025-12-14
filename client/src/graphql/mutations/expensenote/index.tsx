import { gql } from "@apollo/client";

/* =========================
   ADD EXPENSE NOTE
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
      totalamount
      totalgst
      status
      expenses {
        expenseledgerid {
          id
          ledgername
        }
        amount
        gstpercent
        remarks
      }
    }
  }
`;

/* =========================
   EDIT EXPENSE NOTE
   ========================= */

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
      totalamount
      totalgst
      status
      expenses {
        expenseledgerid {
          id
          ledgername
        }
        amount
        gstpercent
        remarks
      }
    }
  }
`;

/* =========================
   DELETE EXPENSE NOTE
   ========================= */

export const DELETE_EXPENSE_NOTE = gql`
  mutation DeleteExpenseNote($id: ID!) {
    deleteExpenseNote(id: $id)
  }
`;

/* =========================
   RESET EXPENSE NOTE
   ========================= */

export const RESET_EXPENSE_NOTE = gql`
  mutation ResetExpenseNote($id: ID!) {
    resetExpenseNote(id: $id)
  }
`;
