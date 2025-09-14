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
      isshowinpos
      isfeatured
      name
      description
      imageurl
      imagename
      categoryid
      subcategoryid
      groupid
      modelid
      brandid
      sizeid
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
        duration {
          amount
          unit
        }
        requiresappointment
        availabilityslots {
          day
          from
          to
        }
        locationType
        isRecurring
        recurrence {
          interval
          count
        }
        servicelikecount
        remarks
      }
      productvariants {
        id
        name
        sku
        productcode
        productbarcode
        batchnumber
        manufacturedate
        expirydate
        baseunitid
        purchaseunitid
        purchaserate
        unitconversions {
          unitid
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
        pricing {
          region
          channel
          unitprices {
            quantity
            unitid
            mrp
            salesrate
            discount
            discounttype
            offerprice
          }
        }
        productlikecount
      }
      isshowinpos
      isfeatured
      salesaccountid
      purchaseaccountid
      serviceaccountid
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
      isshowinpos
      isfeatured
      name
      description
      imageurl
      imagename
      categoryid
      subcategoryid
      groupid
      modelid
      brandid
      sizeid
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
        duration {
          amount
          unit
        }
        requiresappointment
        availabilityslots {
          day
          from
          to
        }
        locationType
        isRecurring
        recurrence {
          interval
          count
        }
        servicelikecount
        remarks
      }
      productvariants {
        id
        name
        sku
        productcode
        productbarcode
        batchnumber
        manufacturedate
        expirydate
        baseunitid
        purchaseunitid
        purchaserate
        unitconversions {
          unitid
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
        pricing {
          region
          channel
          unitprices {
            quantity
            unitid
            mrp
            salesrate
            discount
            discounttype
            offerprice
          }
        }
        productlikecount
      }
      isshowinpos
      isfeatured
      salesaccountid
      purchaseaccountid
      serviceaccountid
      status
      createdAt
      updatedAt
    }
  }
`;
