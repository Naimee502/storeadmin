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

export const GET_ADMIN_BY_CODE = gql`
  query GetAdminByCode($admincode: String!) {
    getAdminByCode(admincode: $admincode) {
      id
      admincode
      name
      companyName
      businesstype
      mobile
      email
      allowedmodules
    }
  }
`;
