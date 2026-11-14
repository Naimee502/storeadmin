import { gql } from "@apollo/client";

export const GET_MY_LOYALTY = gql`
  query GetMyLoyalty {
    getMyLoyalty {
      rules { enabled earnPer100 pointValue minBill maxEarn expiryDays minRedeem maxRedeemPercent }
      balance value earned redeemed
      history { id kind points docno note createdAt }
    }
  }
`;
