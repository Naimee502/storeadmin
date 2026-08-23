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
      categoryid { id categoryname }
      subcategoryid { id subcategoryname }
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

      categoryid { id categoryname }
      subcategoryid { id subcategoryname }
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

// Every dropdown list the import/export template needs, in one round trip.
// Generating the template used to mean nine separate master queries.
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
