// GraphQL document helpers for the offline link: root field lookup, argument injection, result shaping.
import { Kind, type DocumentNode, type FieldNode, type OperationDefinitionNode, type SelectionSetNode } from "graphql";

export function mainOperation(doc: DocumentNode): OperationDefinitionNode | null {
  const ops = doc.definitions.filter((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION);
  return ops.length === 1 ? ops[0] : null;
}

// The single root field of an operation (ignoring __typename), else null.
export function rootField(doc: DocumentNode): FieldNode | null {
  const op = mainOperation(doc);
  if (!op) return null;
  const fields = op.selectionSet.selections.filter(
    (s): s is FieldNode => s.kind === Kind.FIELD && s.name.value !== "__typename"
  );
  return fields.length === 1 ? fields[0] : null;
}

const name = (value: string) => ({ kind: Kind.NAME, value }) as const;

// Copy of the root field with an extra argument/variable and, when it returns an object, `updatedAt` selected.
export function withExpectedUpdatedAt(doc: DocumentNode, opts: { arg: boolean; selectUpdatedAt: boolean }): DocumentNode {
  const op = mainOperation(doc);
  const field = rootField(doc);
  if (!op || !field) return doc;
  let newField: FieldNode = field;
  let varDefs = op.variableDefinitions || [];
  if (opts.arg) {
    if (!varDefs.some((v) => v.variable.name.value === "expectedUpdatedAt")) {
      varDefs = [
        ...varDefs,
        {
          kind: Kind.VARIABLE_DEFINITION,
          variable: { kind: Kind.VARIABLE, name: name("expectedUpdatedAt") },
          type: { kind: Kind.NAMED_TYPE, name: name("String") },
        },
      ];
    }
    if (!(field.arguments || []).some((a) => a.name.value === "expectedUpdatedAt")) {
      newField = {
        ...newField,
        arguments: [
          ...(field.arguments || []),
          { kind: Kind.ARGUMENT, name: name("expectedUpdatedAt"), value: { kind: Kind.VARIABLE, name: name("expectedUpdatedAt") } },
        ],
      };
    }
  }
  if (opts.selectUpdatedAt && field.selectionSet) {
    const has = field.selectionSet.selections.some((s) => s.kind === Kind.FIELD && s.name.value === "updatedAt" && !s.alias);
    if (!has) {
      newField = {
        ...newField,
        selectionSet: {
          ...field.selectionSet,
          selections: [...field.selectionSet.selections, { kind: Kind.FIELD, name: name("updatedAt") }],
        },
      };
    }
  }
  if (newField === field && varDefs === op.variableDefinitions) return doc;
  const newOp: OperationDefinitionNode = {
    ...op,
    variableDefinitions: varDefs,
    selectionSet: { ...op.selectionSet, selections: op.selectionSet.selections.map((s) => (s === field ? newField : s)) },
  };
  return { ...doc, definitions: doc.definitions.map((d) => (d === op ? newOp : d)) };
}

// Shapes a source object by a selection set; "null" fills missing fields, "omit" leaves them out.
// `ref`: finds the record behind a bare id where an object is selected (offline masters only).
export function shapeBySelection(sel: SelectionSetNode | undefined, src: any, mode: "null" | "omit" = "null", ref?: (id: string) => any): any {
  if (src == null || typeof src !== "object") return src ?? null;
  const out: Record<string, any> = {};
  if (!sel) return out;
  for (const s of sel.selections) {
    if (s.kind === Kind.INLINE_FRAGMENT) {
      Object.assign(out, shapeBySelection(s.selectionSet, src, mode, ref));
      continue;
    }
    if (s.kind !== Kind.FIELD) continue;
    const fieldName = s.name.value;
    const key = s.alias?.value ?? fieldName;
    const v = src[fieldName];
    if (v === undefined) {
      if (mode === "null" && fieldName !== "__typename") out[key] = null;
      continue;
    }
    if (s.selectionSet) {
      if (Array.isArray(v)) out[key] = v.map((x) => (typeof x === "string" && ref ? shapeBySelection(s.selectionSet, ref(x) ?? { id: x }, mode, ref) : shapeBySelection(s.selectionSet, x, mode, ref)));
      else if (v && typeof v === "object") out[key] = shapeBySelection(s.selectionSet, v, mode, ref);
      else if (typeof v === "string" && v && ref) out[key] = shapeBySelection(s.selectionSet, ref(v) ?? { id: v }, mode, ref);
      else out[key] = null;
    } else if (v === null || ["string", "number", "boolean"].includes(typeof v)) {
      out[key] = v;
    } else if (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object")) {
      out[key] = v;
    } else if (mode === "null") {
      out[key] = null;
    }
  }
  return out;
}

// Selection set of a nested path inside a query's root field, e.g. ["items"].
export function selectionAt(doc: DocumentNode, path: string[] = []): SelectionSetNode | undefined {
  let sel = rootField(doc)?.selectionSet;
  for (const p of path) {
    const f = sel?.selections.find((s): s is FieldNode => s.kind === Kind.FIELD && (s.alias?.value ?? s.name.value) === p);
    sel = f?.selectionSet;
  }
  return sel;
}
