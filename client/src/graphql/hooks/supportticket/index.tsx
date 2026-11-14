import { useMutation, useQuery } from "@apollo/client";
import { GET_SUPPORT_TICKET, GET_SUPPORT_TICKETS } from "../../queries/supportticket";
import {
  ADD_SUPPORT_TICKET, ADD_SUPPORT_TICKET_COMMENT, DELETE_SUPPORT_TICKET, EDIT_SUPPORT_TICKET,
  RESET_SUPPORT_TICKET, SET_SUPPORT_TICKET_STATUS,
} from "../../mutations/supportticket";

export const TICKET_STATUS: Record<string, string> = {
  open: "Open", inprogress: "In Progress", waiting: "Waiting on Customer", resolved: "Resolved", closed: "Closed",
};
export const TICKET_PRIORITY: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export const useSupportTicketsQuery = (filter: Record<string, any> = {}) =>
  useQuery(GET_SUPPORT_TICKETS, { variables: { filter }, fetchPolicy: "cache-and-network" });

export const useSupportTicketQuery = (id?: string) =>
  useQuery(GET_SUPPORT_TICKET, { variables: { id }, skip: !id, fetchPolicy: "network-only" });

export const useSupportTicketMutations = () => {
  const [add] = useMutation(ADD_SUPPORT_TICKET);
  const [edit] = useMutation(EDIT_SUPPORT_TICKET);
  const [setStatus] = useMutation(SET_SUPPORT_TICKET_STATUS);
  const [comment] = useMutation(ADD_SUPPORT_TICKET_COMMENT);
  const [remove] = useMutation(DELETE_SUPPORT_TICKET);
  const [reset] = useMutation(RESET_SUPPORT_TICKET);
  return { add, edit, setStatus, comment, remove, reset };
};
