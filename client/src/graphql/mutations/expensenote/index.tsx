import { gql } from "@apollo/client";

// Add expense note

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

// Edit expense note

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

// Delete expense note

export const DELETE_EXPENSE_NOTE = gql`
  mutation DeleteExpenseNote($id: ID!) {
    deleteExpenseNote(id: $id)
  }
`;

// Reset expense note

export const RESET_EXPENSE_NOTE = gql`
  mutation ResetExpenseNote($id: ID!) {
    resetExpenseNote(id: $id)
  }
`;
