import { gql } from "@apollo/client";
import { DELIVERY_CHALLAN_FIELDS } from "../../queries/deliverychallan";

export const ADD_DELIVERY_CHALLAN = gql`
  mutation AddDeliveryChallan($input: DeliveryChallanInput!) {
    addDeliveryChallan(input: $input) { ${DELIVERY_CHALLAN_FIELDS} }
  }
`;
export const EDIT_DELIVERY_CHALLAN = gql`
  mutation EditDeliveryChallan($id: ID!, $input: DeliveryChallanInput!, $expectedUpdatedAt: String) {
    editDeliveryChallan(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${DELIVERY_CHALLAN_FIELDS} }
  }
`;
export const DELETE_DELIVERY_CHALLAN = gql`
  mutation DeleteDeliveryChallan($id: ID!, $expectedUpdatedAt: String) {
    deleteDeliveryChallan(id: $id, expectedUpdatedAt: $expectedUpdatedAt)
  }
`;
export const RESET_DELIVERY_CHALLAN = gql`
  mutation ResetDeliveryChallan($id: ID!) {
    resetDeliveryChallan(id: $id)
  }
`;
export const MARK_DELIVERY_CHALLAN_DELIVERED = gql`
  mutation MarkDeliveryChallanDelivered($id: ID!, $expectedUpdatedAt: String) {
    markDeliveryChallanDelivered(id: $id, expectedUpdatedAt: $expectedUpdatedAt) { ${DELIVERY_CHALLAN_FIELDS} }
  }
`;
export const MARK_DELIVERY_CHALLAN_RETURNED = gql`
  mutation MarkDeliveryChallanReturned($id: ID!, $expectedUpdatedAt: String) {
    markDeliveryChallanReturned(id: $id, expectedUpdatedAt: $expectedUpdatedAt) { ${DELIVERY_CHALLAN_FIELDS} }
  }
`;
