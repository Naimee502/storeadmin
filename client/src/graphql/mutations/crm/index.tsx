import { gql } from "@apollo/client";
import { LEAD_FIELDS } from "../../queries/lead";
import { OPPORTUNITY_FIELDS } from "../../queries/crm";

export const REFRESH_OPPORTUNITIES = gql`
  mutation RefreshOpportunities { refreshOpportunities { found kinds { kind count value } } }
`;
export const SET_OPPORTUNITY_STATE = gql`
  mutation SetOpportunityState($id: ID!, $state: String!) {
    setOpportunityState(id: $id, state: $state) { ${OPPORTUNITY_FIELDS} }
  }
`;
export const CONVERT_OPPORTUNITY_TO_LEAD = gql`
  mutation ConvertOpportunityToLead($id: ID!) { convertOpportunityToLead(id: $id) { ${LEAD_FIELDS} } }
`;
export const ASK_AI = gql`
  mutation AskAi($question: String!) { askAi(question: $question) { ok answer steps reason } }
`;
export const AI_READ_INQUIRY = gql`
  mutation AiReadInquiry($text: String!) {
    aiReadInquiry(text: $text) {
      ok reason
      fields { name company mobile email city state requirement qty expectedvalue temperature score scorereason }
    }
  }
`;
export const AI_DRAFT_MESSAGE = gql`
  mutation AiDraftMessage($leadid: ID!, $channel: String, $instruction: String) {
    aiDraftMessage(leadid: $leadid, channel: $channel, instruction: $instruction) { ok text reason }
  }
`;
export const AI_DRAFT_FOR_OPPORTUNITY = gql`
  mutation AiDraftForOpportunity($id: ID!) { aiDraftForOpportunity(id: $id) { ok text reason } }
`;
