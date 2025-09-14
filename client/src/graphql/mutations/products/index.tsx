import { gql } from '@apollo/client';

export const ADD_PRODUCT_SERVICE = gql`
  mutation AddProductService($input: ProductServiceInput!) {
    addProductService(input: $input) {
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
      salesaccountid
      purchaseaccountid
      serviceaccountid
      status
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PRODUCT_SERVICE = gql`
  mutation UpdateProductService($id: ID!, $input: ProductServiceInput!) {
    updateProductService(id: $id, input: $input) {
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
      salesaccountid
      purchaseaccountid
      serviceaccountid
      status
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_PRODUCT_SERVICE = gql`
  mutation DeleteProductService($id: ID!) {
    deleteProductService(id: $id)
  }
`;

export const RESET_PRODUCT_SERVICE = gql`
  mutation ResetProductService($id: ID!) {
    resetProductService(id: $id)
  }
`;
