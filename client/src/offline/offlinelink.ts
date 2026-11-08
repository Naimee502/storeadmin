// Apollo link (offline mode only) that queues sales invoice/order creates when there is no network.
import { ApolloLink, Observable, type FetchResult, type Operation } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { print, type FieldNode, type SelectionSetNode } from "graphql";
import { enqueue, newRequestId, type OutboxItem } from "./outbox";
import { scheduleCacheSave } from "./persist";
import { currentUserKey } from "./userkey";

// Root mutation field -> schema return type.
const HANDLED: Record<string, { typename: string; label: string }> = {
  addSalesInvoice: { typename: "SalesInvoice", label: "Sales Invoice" },
  addSalesOrder: { typename: "SalesOrder", label: "Sales Order" },
};

export const OFFLINE_ID_PREFIX = "offline-";

function handledField(operation: Operation): { field: FieldNode; typename: string; label: string } | null {
  try {
    const def: any = getMainDefinition(operation.query);
    if (def.kind !== "OperationDefinition" || def.operation !== "mutation") return null;
    const fields = def.selectionSet.selections.filter((s: any) => s.kind === "Field" && s.name.value !== "__typename");
    if (fields.length !== 1) return null;
    const spec = HANDLED[fields[0].name.value];
    return spec ? { field: fields[0], ...spec } : null;
  } catch {
    return null;
  }
}

// Fills a selection set from the input: matching scalars copied, the rest null or [].
function fill(sel: SelectionSetNode | undefined, src: Record<string, any>, out: Record<string, any>) {
  if (!sel) return out;
  for (const s of sel.selections) {
    if (s.kind === "InlineFragment") {
      fill(s.selectionSet, src, out);
      continue;
    }
    if (s.kind !== "Field") continue;
    const name = s.name.value;
    const key = s.alias?.value ?? name;
    if (name === "__typename") continue;
    const v = src?.[name];
    if (s.selectionSet) out[key] = Array.isArray(v) ? [] : null;
    else if (v === null || ["string", "number", "boolean"].includes(typeof v)) out[key] = v;
    else out[key] = Array.isArray(v) ? [] : null;
  }
  return out;
}

function syntheticResult(field: FieldNode, typename: string, input: Record<string, any>, crid: string): FetchResult {
  const obj = fill(field.selectionSet, input, {});
  obj.__typename = typename;
  obj.id = `${OFFLINE_ID_PREFIX}${crid}`;
  if (field.selectionSet?.selections.some((s) => s.kind === "Field" && s.name.value === "billnumber")) obj.billnumber = "OFFLINE";
  return { data: { [field.alias?.value ?? field.name.value]: obj } };
}

function partyNameFromCache(operation: Operation, partyId: unknown): string | null {
  if (typeof partyId !== "string" || !partyId) return null;
  try {
    const cache = operation.getContext().cache;
    const data = cache?.extract?.() || {};
    for (const k of Object.keys(data)) {
      if (!k.endsWith(`:${partyId}`)) continue;
      const e = data[k];
      const name = e?.name || e?.accountname || e?.ledgername;
      if (typeof name === "string" && name) return name;
    }
  } catch {
    // Name is optional.
  }
  return null;
}

// Network failure with no HTTP response at all (not a GraphQL or HTTP error).
function isNoResponse(err: any): boolean {
  if (!err) return false;
  if (err.name === "AbortError") return false;
  return typeof err.statusCode !== "number" && !err.response && !err.result;
}

export const offlineLink = new ApolloLink((operation, forward) => {
  const ctx = operation.getContext();
  if (ctx.offlineSync) {
    // Replay from the outbox: send under the branch it was saved with.
    if (typeof ctx.offlineBranch === "string") {
      operation.setContext(({ headers = {} }: any) => ({ headers: { ...headers, "x-branch-id": ctx.offlineBranch } }));
    }
    return forward(operation);
  }

  const spec = handledField(operation);
  const input = operation.variables?.input;
  if (!spec || !input || typeof input !== "object") {
    return new Observable<FetchResult>((observer) => {
      const sub = forward(operation).subscribe({
        next: (r) => observer.next(r),
        error: (e) => observer.error(e),
        complete: () => {
          scheduleCacheSave();
          observer.complete();
        },
      });
      return () => sub.unsubscribe();
    });
  }

  const crid: string = input.clientRequestId || newRequestId();
  const withId = { ...input, clientRequestId: crid };
  operation.variables = { ...operation.variables, input: withId };

  const queue = async (reason: string): Promise<FetchResult> => {
    const { billnumber: _drop, ...queued } = withId;
    void _drop;
    const item: OutboxItem = {
      id: crid,
      operationName: operation.operationName,
      query: print(operation.query),
      variables: { ...operation.variables, input: queued },
      createdAt: Date.now(),
      attempts: 0,
      lastError: reason,
      status: "pending",
      userKey: currentUserKey(),
      branchHeader: (() => {
        try {
          return localStorage.getItem("branchid") || "";
        } catch {
          return "";
        }
      })(),
      typename: spec.typename,
      label: spec.label,
      partyName: partyNameFromCache(operation, input.partyacc),
      amount: typeof input.totalamount === "number" ? input.totalamount : null,
      billdate: typeof input.billdate === "string" ? input.billdate : null,
    };
    await enqueue(item);
    return syntheticResult(spec.field, spec.typename, queued, crid);
  };

  return new Observable<FetchResult>((observer) => {
    let sub: { unsubscribe: () => void } | null = null;
    let closed = false;
    const fallback = (reason: string, original: unknown) => {
      queue(reason).then(
        (r) => {
          if (closed) return;
          observer.next(r);
          observer.complete();
        },
        () => !closed && observer.error(original)
      );
    };
    if (navigator.onLine === false) {
      fallback("Saved while offline", new Error("Offline and the outbox is unavailable"));
    } else {
      sub = forward(operation).subscribe({
        next: (r) => observer.next(r),
        error: (e) => (isNoResponse(e) ? fallback(e?.message || "Network error", e) : observer.error(e)),
        complete: () => {
          scheduleCacheSave();
          observer.complete();
        },
      });
    }
    return () => {
      closed = true;
      sub?.unsubscribe();
    };
  });
});
