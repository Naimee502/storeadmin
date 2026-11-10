import { gql } from "@apollo/client";
import { BOM_FIELDS, WORK_ORDER_FIELDS, PRODUCTION_FIELDS } from "../../queries/manufacturing";

export const ADD_BOM = gql`mutation AddBom($input: BomInput!) { addBom(input: $input) { ${BOM_FIELDS} } }`;
export const EDIT_BOM = gql`mutation EditBom($id: ID!, $input: BomInput!, $expectedUpdatedAt: String) { editBom(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${BOM_FIELDS} } }`;
export const DELETE_BOM = gql`mutation DeleteBom($id: ID!, $expectedUpdatedAt: String) { deleteBom(id: $id, expectedUpdatedAt: $expectedUpdatedAt) }`;
export const RESET_BOM = gql`mutation ResetBom($id: ID!) { resetBom(id: $id) }`;

export const ADD_WORK_ORDER = gql`mutation AddWorkOrder($input: WorkOrderInput!) { addWorkOrder(input: $input) { ${WORK_ORDER_FIELDS} } }`;
export const EDIT_WORK_ORDER = gql`mutation EditWorkOrder($id: ID!, $input: WorkOrderInput!, $expectedUpdatedAt: String) { editWorkOrder(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${WORK_ORDER_FIELDS} } }`;
export const SET_WORK_ORDER_STATUS = gql`mutation SetWorkOrderStatus($id: ID!, $workStatus: String!, $expectedUpdatedAt: String) { setWorkOrderStatus(id: $id, workStatus: $workStatus, expectedUpdatedAt: $expectedUpdatedAt) { ${WORK_ORDER_FIELDS} } }`;
export const DELETE_WORK_ORDER = gql`mutation DeleteWorkOrder($id: ID!, $expectedUpdatedAt: String) { deleteWorkOrder(id: $id, expectedUpdatedAt: $expectedUpdatedAt) }`;
export const RESET_WORK_ORDER = gql`mutation ResetWorkOrder($id: ID!) { resetWorkOrder(id: $id) }`;

export const ADD_PRODUCTION_ENTRY = gql`mutation AddProductionEntry($input: ProductionEntryInput!) { addProductionEntry(input: $input) { ${PRODUCTION_FIELDS} } }`;
export const EDIT_PRODUCTION_ENTRY = gql`mutation EditProductionEntry($id: ID!, $input: ProductionEntryInput!, $expectedUpdatedAt: String) { editProductionEntry(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${PRODUCTION_FIELDS} } }`;
export const DELETE_PRODUCTION_ENTRY = gql`mutation DeleteProductionEntry($id: ID!, $expectedUpdatedAt: String) { deleteProductionEntry(id: $id, expectedUpdatedAt: $expectedUpdatedAt) }`;
export const RESET_PRODUCTION_ENTRY = gql`mutation ResetProductionEntry($id: ID!) { resetProductionEntry(id: $id) }`;
