import { gql } from '@apollo/client';

export const GET_BRANCHES = gql`
  query GetBranches($adminId: ID!) {
    getBranches(adminId: $adminId) {
      id
      branchname
      status
    }
  }
`;
