import { gql } from '@apollo/client';

const CLAIM_FIELDS = `
  id
  claimnumber
  claimdate
  category
  amount
  distancekm
  description
  receipts
  status
  approvedamount
  paidamount
  expensenumber
  approverremarks
  rejectionreason
  actionedby_name
  actionedAt
  createdAt
`;

export const GET_MY_EXPENSE_CLAIMS = gql`
  query GetMyExpenseClaims {
    getMyExpenseClaims { ${CLAIM_FIELDS} }
  }
`;

export const ADD_EXPENSE_CLAIM = gql`
  mutation AddExpenseClaim($input: ExpenseClaimInput!) {
    addExpenseClaim(input: $input) { ${CLAIM_FIELDS} }
  }
`;

export const EDIT_EXPENSE_CLAIM = gql`
  mutation EditExpenseClaim($id: ID!, $input: ExpenseClaimInput!) {
    editExpenseClaim(id: $id, input: $input) { ${CLAIM_FIELDS} }
  }
`;

export const CANCEL_EXPENSE_CLAIM = gql`
  mutation CancelExpenseClaim($id: ID!) {
    cancelExpenseClaim(id: $id) { ${CLAIM_FIELDS} }
  }
`;

export const IS_EXPENSE_CLAIMS_ENABLED = gql`
  query IsExpenseClaimsEnabled { isExpenseClaimsEnabled }
`;
