import { gql } from "@apollo/client";
import { EXPENSE_CLAIM_FIELDS } from "../../queries/expenseclaim";

export const APPROVE_EXPENSE_CLAIM = gql`
  mutation ApproveExpenseClaim($id: ID!, $approvedamount: Float, $expenseledgerid: ID, $remarks: String) {
    approveExpenseClaim(id: $id, approvedamount: $approvedamount, expenseledgerid: $expenseledgerid, remarks: $remarks) { ${EXPENSE_CLAIM_FIELDS} }
  }
`;

export const REJECT_EXPENSE_CLAIM = gql`
  mutation RejectExpenseClaim($id: ID!, $reason: String!) {
    rejectExpenseClaim(id: $id, reason: $reason) { ${EXPENSE_CLAIM_FIELDS} }
  }
`;

export const DELETE_EXPENSE_CLAIM = gql`
  mutation DeleteExpenseClaim($id: ID!) { deleteExpenseClaim(id: $id) }
`;

export const RESET_EXPENSE_CLAIM = gql`
  mutation ResetExpenseClaim($id: ID!) { resetExpenseClaim(id: $id) }
`;
