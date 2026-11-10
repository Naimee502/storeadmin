import { gql } from "@apollo/client";

// Only what a service needs, so the Services screens stay light.
export const SERVICE_FIELDS = `
  id adminid branchid isservice name description imageurl imageurls status createdAt updatedAt
  categoryid { id categoryname }
  serviceaccountid { id ledgername }
  servicevariants {
    id name servicecode servicebarcode servicerate uom
    duration { amount unit }
    requiresappointment
    availabilityslots { day from to }
    locationType isRecurring recurrence { interval count } remarks
    gst saccode pricingunit taxinclusive visitcharge nextduedays warrantydays staffids commission capacity bufferminutes checklist
    materials { productserviceid variantid salesunitid qty }
  }
`;

export const GET_SERVICES_PAGE = gql`
  query GetServicesPage($filter: ProductServiceFilterInput, $page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]) {
    getServicesPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) { items { ${SERVICE_FIELDS} } total }
  }
`;
export const GET_SERVICE_BY_ID = gql`query GetServiceById($id: ID!) { getServiceById(id: $id) { ${SERVICE_FIELDS} } }`;
