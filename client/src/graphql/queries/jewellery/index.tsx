import { gql } from "@apollo/client";

const RATE = `id date metal purity rate createdby_name updatedAt`;
export const GET_METAL_RATES = gql`query GetMetalRates($date: String) { getMetalRates(date: $date) { ${RATE} } }`;
export const GET_METAL_RATE_HISTORY = gql`query GetMetalRateHistory($metal: String!, $purity: String!) { getMetalRateHistory(metal: $metal, purity: $purity) { ${RATE} } }`;
export const SET_METAL_RATES = gql`mutation SetMetalRates($date: String!, $rates: [MetalRateInput!]!) { setMetalRates(date: $date, rates: $rates) { ${RATE} } }`;
