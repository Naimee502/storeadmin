import { gql } from '@apollo/client';

export const GET_PRODUCT_SERVICES = gql`
  query GetProductServices($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      adminid
      vendorid
      branchid
      isservice
      isserialised
      name
      description
      imageurl
      imagename
      imageurls
      categoryid { id categoryname image }
      subcategoryid { id subcategoryname image }
      groupid { id productgroupname }
      modelid { id modelname }
      brandid { id brandname }
      sizeid { id sizename }
      salesaccountid { id ledgername }
      purchaseaccountid { id ledgername }
      serviceaccountid { id ledgername }
      seo {
        metatitle
        metadescription
        keywords
        slug
      }
      servicevariants {
        id
        name
        servicecode
        servicebarcode
        servicerate
        uom
        duration { amount unit }
        requiresappointment
        availabilityslots { day from to }
        locationType
        isRecurring
        recurrence { interval count }
        servicelikecount
        remarks
      }
      productvariants {
        id
        name
        sku
        productcode
        batchnumber
        manufacturedate
        expirydate
        baseunitid { id unitname }
        purchaseunitid { id unitname }
        purchaserate
        unitconversions {
          unitid { id unitname }
          factor
        }
        gst
        hsncode
        openingstock
        openingstockamount
        currentstock
        currentstockamount
        closingstock
        closingstockamount
        minimumstock
        reorderlevel
        racklocation
        serials {
          id
          imei
          serialnumber
          lotnumber
          status
          addedon
          soldon
          returnedon
          remarks
        }
        unitprices {
          quantity
          unitid { id unitname }
          mrp
          salesrate
          discount
          discounttype
          offerprice
          productbarcode
        }
        productlikecount
      }
      status
      createdAt
      updatedAt
    }
  }
`;

// Lite list for the Products page; Export and forms use the full query.
export const GET_PRODUCT_SERVICES_LIST = gql`
  query GetProductServicesList($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      isservice
      name
      status
      servicevariants {
        id
        name
        servicecode
        servicebarcode
        servicerate
        uom
        locationType
      }
      productvariants {
        id
        productcode
        currentstock
        minimumstock
        unitprices {
          quantity
          unitid { id unitname }
          salesrate
          discount
          discounttype
          productbarcode
        }
      }
    }
  }
`;

// One page of the Products list page: same fields as GET_PRODUCT_SERVICES_LIST.
export const GET_PRODUCT_SERVICES_PAGE = gql`
  query GetProductServicesPage(
    $filter: ProductServiceFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
    $lowStock: Boolean
  ) {
    getProductServicesPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters, lowStock: $lowStock) {
      total
      items {
        id
        isservice
        name
        status
        servicevariants {
          id
          name
          servicecode
          servicebarcode
          servicerate
          uom
          locationType
        }
        productvariants {
          id
          productcode
          currentstock
          minimumstock
          unitprices {
            quantity
            unitid { id unitname }
            salesrate
            discount
            discounttype
            productbarcode
          }
        }
      }
    }
  }
`;

export const GET_PRODUCT_SERVICE_BY_ID = gql`
  query GetProductServiceById($id: ID!, $adminId: ID, $branchId: ID) {
    getProductServiceById(id: $id, adminId: $adminId, branchId: $branchId) {
      id
      adminid
      vendorid
      branchid
      isservice
      isserialised
      name
      description
      imageurl
      imagename
      imageurls

      categoryid { id categoryname image }
      subcategoryid { id subcategoryname image }
      groupid { id productgroupname }
      modelid { id modelname }
      brandid { id brandname }
      sizeid { id sizename }

      salesaccountid { id ledgername }
      purchaseaccountid { id ledgername }
      serviceaccountid { id ledgername }

      seo {
        metatitle
        metadescription
        keywords
        slug
      }

      servicevariants {
        id
        name
        servicecode
        servicebarcode
        servicerate
        uom
        duration { amount unit }
        requiresappointment
        availabilityslots { day from to }
        locationType
        isRecurring
        recurrence { interval count }
        servicelikecount
        remarks
      }

      productvariants {
        id
        name
        sku
        productcode
        batchnumber
        manufacturedate
        expirydate
        
        baseunitid { id unitname }
        purchaseunitid { id unitname }

        purchaserate

        unitconversions {
          unitid { id unitname }
          factor
        }

        gst
        hsncode
        openingstock
        openingstockamount
        currentstock
        currentstockamount
        closingstock
        closingstockamount
        minimumstock
        reorderlevel
        racklocation
        
        serials {
          id
          imei
          serialnumber
          lotnumber
          status
          addedon
          soldon
          returnedon
          remarks
        }

        unitprices {
          quantity
          unitid { id unitname }
          mrp
          salesrate
          discount
          discounttype
          offerprice
          productbarcode
        }
        productlikecount
      }

      status
      createdAt
      updatedAt
    }
  }
`;

// All import/export template dropdown lists in one round trip.
export const GET_PRODUCT_IMPORT_MASTERS = gql`
  query GetProductImportMasters {
    getProductImportMasters {
      adminid
      branchid
      categories { id name parentid }
      subcategories { id name parentid }
      brands { id name parentid }
      models { id name parentid }
      sizes { id name parentid }
      groups { id name parentid }
      units { id name parentid }
      ledgers { id name parentid }
    }
  }
`;
