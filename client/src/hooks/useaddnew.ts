import { useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client";

/** Dropdown "Add New": opens the add screen in a new tab and reloads the list when this tab is back in focus. */
export function useAddNew(path: string, queries: string[]) {
  const client = useApolloClient();
  const waiting = useRef(false);
  useEffect(() => {
    const back = () => {
      if (!waiting.current) return;
      waiting.current = false;
      client.refetchQueries({ include: queries }).catch(() => undefined);
    };
    window.addEventListener("focus", back);
    return () => window.removeEventListener("focus", back);
  }, [client, queries.join(",")]);
  return () => {
    waiting.current = true;
    window.open(path, "_blank");
  };
}

export const PARTY_QUERIES = ["GetAccountsLite", "GetAccountsList", "GetAccounts"];
export const ITEM_QUERIES = ["GetProductServices"];
