import { gql } from "@apollo/client";

// Resolves which admin a storefront link (yourdomain.com/<storeslug>)
// belongs to. Public/anonymous — no auth needed to browse a catalog.
export const GET_STOREFRONT_BY_SLUG = gql`
  query GetStorefrontByStoreSlug($storeslug: String!) {
    getStorefrontByStoreSlug(storeslug: $storeslug) {
      adminid
      branchid
      companyName
      address
      codOnly
      displayProductPriceOnWebsite

      supportEmail
      supportPhone
      supportWhatsapp
      appDownloadUrl

      websiteAboutContent
      websitePrivacyContent
      websiteTermsContent
      websiteTagline

      socialFacebookUrl
      socialInstagramUrl
      socialTwitterUrl
      socialLinkedinUrl

      featuredProductItems {
        productid
        unitid
      }
      newArrivalItems {
        productid
        unitid
      }

      dealOfDayEnabled
      dealOfDayTitle
      dealOfDaySubtitle
      dealOfDayItems {
        productid
        unitid
      }

      heroBannerSlides {
        image
        title
        subtitle
        cta
        link
      }
      promoBanners {
        image
        title
        subtitle
        cta
        link
      }
      businessStats {
        label
        value
      }
    }
  }
`;
