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
      name
      description
      imageurl
      imagename

      categoryid { id categoryname }
      subcategoryid { id subcategoryname }
      groupid { id productgroupname }
      modelid { id modelname }
      brandid { id brandname }
      sizeid { id sizename }

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
        }
        productlikecount
      }

      salesaccountid { id ledgername }
      purchaseaccountid { id ledgername }
      serviceaccountid { id ledgername }

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
      name
      description
      imageurl
      imagename

      categoryid { id categoryname }
      subcategoryid { id subcategoryname }
      groupid { id productgroupname }
      modelid { id modelname }
      brandid { id brandname }
      sizeid { id sizename }

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
        }
        productlikecount
      }

      salesaccountid { id ledgername }
      purchaseaccountid { id ledgername }
      serviceaccountid { id ledgername }

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

// Bulk import. adminid / branchid are deliberately absent — the server stamps
// both from the caller's token onto every product. dryRun validates and
// reports without writing, which is what the review screen shows.
export const IMPORT_PRODUCT_SERVICES = gql`
  mutation ImportProductServices($input: ProductImportInput!) {
    importProductServices(input: $input) {
      total
      created
      updated
      skipped
      dryRun
      errors {
        ref
        sheet
        row
        field
        message
      }
    }
  }
`;
