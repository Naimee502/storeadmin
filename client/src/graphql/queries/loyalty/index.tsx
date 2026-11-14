import { gql } from "@apollo/client";

const RULES = `rules { enabled earnPer100 pointValue minBill maxEarn expiryDays minRedeem maxRedeemPercent }`;
const ACCOUNT = `${RULES} balance value earned redeemed history { id kind points docno note createdAt }`;

export const GET_PARTY_LOYALTY = gql`
  query GetPartyLoyalty($partyid: ID!) {
    getPartyLoyalty(partyid: $partyid) { ${ACCOUNT} }
  }
`;

export const GET_LOYALTY_SUMMARY = gql`
  query GetLoyaltySummary {
    getLoyaltySummary {
      ${RULES} earned redeemed expired balance liability
      parties { partyid name mobile city earned redeemed expired balance }
    }
  }
`;

export const ADJUST_LOYALTY_POINTS = gql`
  mutation AdjustLoyaltyPoints($partyid: ID!, $points: Float!, $note: String!) {
    adjustLoyaltyPoints(partyid: $partyid, points: $points, note: $note) { ${ACCOUNT} }
  }
`;
