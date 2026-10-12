import { gql } from "@apollo/client";

export const EXPENSE_CLAIM_FIELDS = `
  id
  adminid
  branchid
  claimnumber
  staffid { id name staffcode role mobile }
  claimdate
  category
  amount
  distancekm
  description
  receipts
  status
  approvedamount
  expenseledgerid
  expenseledgername
  expensenoteid
  expensenumber
  paidamount
  approverremarks
  rejectionreason
  actionedby_name
  actionedby_type
  actionedAt
  createdby_name
  createdby_type
  isactive
  createdAt
`;

export const GET_EXPENSE_CLAIMS = gql`
  query GetExpenseClaims($filter: ExpenseClaimFilterInput) {
    getExpenseClaims(filter: $filter) { ${EXPENSE_CLAIM_FIELDS} }
  }
`;

export const GET_DELETED_EXPENSE_CLAIMS = gql`
  query GetDeletedExpenseClaims($filter: ExpenseClaimFilterInput) {
    getDeletedExpenseClaims(filter: $filter) { ${EXPENSE_CLAIM_FIELDS} }
  }
`;
