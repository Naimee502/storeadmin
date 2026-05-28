import { gql } from '@apollo/client';

export const GET_ADMIN_BY_ID = gql`
  query GetAdminById($adminid: ID!) {
    getAdminById(id: $adminid) {
      id
      name
      companyName
      businesstype
      mobile
      email
      allowedmodules
    }
  }
`;
