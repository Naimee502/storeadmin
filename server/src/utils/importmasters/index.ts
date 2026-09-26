import { Types } from "mongoose";
import { Category } from "../../models/categories";
import { SubCategory } from "../../models/subcategories";
import { Brand } from "../../models/brands";
import { Model } from "../../models/models";
import { Size } from "../../models/size";
import { ProductGroup } from "../../models/productgroups";
import { Unit } from "../../models/units";
import { AccountLedger } from "../../models/accountledgers";
import { AccountGroup } from "../../models/accountgroups";

/**
 * Find-or-create for the masters a product import may name by text.
 *
 * The spreadsheet lets the user type a Category, Sub Category, Brand, Model,
 * Size, Product Group, Unit or Account Ledger that is not in the dropdown.
 * This class decides, for every such name, whether it is an existing record or
 * a new one — and makes sure a new one is created exactly once, however many
 * rows use it.
 *
 * Rules that keep duplicates out:
 *  - Names are compared trimmed, with inner spaces collapsed, case-insensitive.
 *    "Hair Oil", " hair  oil" and "HAIR OIL" are the same record. The unique
 *    index on the collections is case-sensitive, so this check cannot be left
 *    to MongoDB.
 *  - Lookups include INACTIVE records. The dropdown only lists active ones, so
 *    a typed name can match an inactive record — that is reported, never
 *    silently duplicated.
 *  - Sub Category names are unique per business (not per Category), so a
 *    name that already exists under another Category is an error rather than
 *    a second record. Same idea for a new Account Ledger: it is filed under
 *    "Sales Account" or "Purchase Account" by the column it was typed in, so
 *    one new name cannot be both.
 *  - Nothing is written during a dry run, and at commit time only masters
 *    used by products that will actually be saved are created.
 *  - If a concurrent import created the same name first (duplicate-key
 *    error), the existing record is looked up and used instead.
 */

type Kind = "category" | "subcategory" | "brand" | "model" | "size" | "group" | "unit" | "ledger";

interface KindDef {
  kind: Kind;
  model: any;
  label: string;
  /** Name field on the master collection. */
  nameField: string;
  /** Extra fields to load (parent / group). */
  extraSelect?: string;
  hasImage?: boolean;
}

/** Load / create order: Category before Sub Category (parent id needed). */
const KINDS: KindDef[] = [
  { kind: "category", model: Category, label: "Category", nameField: "categoryname", hasImage: true },
  { kind: "subcategory", model: SubCategory, label: "Sub Category", nameField: "subcategoryname", extraSelect: "category", hasImage: true },
  { kind: "brand", model: Brand, label: "Brand", nameField: "brandname" },
  { kind: "model", model: Model, label: "Model", nameField: "modelname" },
  { kind: "size", model: Size, label: "Size", nameField: "sizename" },
  { kind: "group", model: ProductGroup, label: "Product Group", nameField: "productgroupname" },
  { kind: "unit", model: Unit, label: "Unit", nameField: "unitname" },
  { kind: "ledger", model: AccountLedger, label: "Account Ledger", nameField: "ledgername", extraSelect: "accountgroupid" },
];

const DEF: Record<Kind, KindDef> = Object.fromEntries(KINDS.map((d) => [d.kind, d])) as any;

/** Where a new Account Ledger is filed, by the column it was typed in. */
interface LedgerGroupSpec {
  role: "Sales" | "Purchase";
  groupName: string;
  category: "income" | "expenses";
}

/** Product-level fields that carry one master id each. */
interface FieldDef {
  kind: Kind;
  path: string;
  nameKey: string;
  permission: string;
  imageKey?: string;
  ledgerGroup?: LedgerGroupSpec;
}

const SALES_GROUP: LedgerGroupSpec = { role: "Sales", groupName: "Sales Account", category: "income" };
const PURCHASE_GROUP: LedgerGroupSpec = { role: "Purchase", groupName: "Purchase Account", category: "expenses" };

/** Category first, then Sub Category — the Sub Category check needs the Category id. */
const FIELDS: FieldDef[] = [
  { kind: "category", path: "categoryid", nameKey: "categoryname", permission: "categoryid", imageKey: "categoryimage" },
  { kind: "subcategory", path: "subcategoryid", nameKey: "subcategoryname", permission: "subcategoryid", imageKey: "subcategoryimage" },
  { kind: "brand", path: "brandid", nameKey: "brandname", permission: "brandid" },
  { kind: "model", path: "modelid", nameKey: "modelname", permission: "modelid" },
  { kind: "size", path: "sizeid", nameKey: "sizename", permission: "sizeid" },
  { kind: "group", path: "groupid", nameKey: "groupname", permission: "groupid" },
  { kind: "ledger", path: "salesaccountid", nameKey: "salesaccountname", permission: "salesaccount", ledgerGroup: SALES_GROUP },
  { kind: "ledger", path: "purchaseaccountid", nameKey: "purchaseaccountname", permission: "purchaseaccount", ledgerGroup: PURCHASE_GROUP },
];

/** Unit slots inside a variant, addressed by the client as "<v>.<slot>[.<i>]". */
const UNIT_SLOTS: Record<string, { permission: string; sheet: string; field: string }> = {
  baseunitid: { permission: "baseunitid", sheet: "Variants", field: "baseunitid" },
  purchaseunitid: { permission: "purchaseunitid", sheet: "Variants", field: "purchaseunitid" },
  unitconversions: { permission: "unitconversions_unitid", sheet: "UnitConversions", field: "unitid" },
  unitprices: { permission: "unitprices_unitid", sheet: "UnitPrices", field: "unitid" },
};

/** Same comparison the client uses. */
export const masterNameKey = (value: any): string =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const cleanName = (value: any): string => String(value ?? "").trim().replace(/\s+/g, " ");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case/space-insensitive exact-name regex, for lookups by name. */
const nameRegex = (name: string) =>
  new RegExp(`^\\s*${escapeRegex(name).replace(/ /g, "\\s+")}\\s*$`, "i");

/** Messages shared word-for-word with the client (importproducts.ts IMPORT_MESSAGES). */
const MESSAGES = {
  subNeedsCategory: (sub: string) =>
    `Sub Category "${sub}" is new, so it needs a Category on the same row.`,
  subSplitCategory: (sub: string, first: string, here: string) =>
    `New Sub Category "${sub}" is under Category "${first}" on another row but under "${here}" here. A Sub Category can only belong to one Category.`,
  subWrongCategory: (sub: string, actual: string, given: string) =>
    `Sub Category "${sub}" belongs to Category "${actual}", not "${given}". Pick the right Category, or use a different Sub Category name.`,
  ledgerSplitRole: (name: string, first: string, here: string) =>
    `New account "${name}" is used as a ${first} Account and as a ${here} Account. A new account can only be one of them — use two names, or create it under Account Ledgers first.`,
  ambiguous: (label: string, name: string) =>
    `More than one ${label} is named "${name}". Rename one of them, or pick from the dropdown so the file carries its id.`,
  inactive: (label: string, name: string) =>
    `${label} "${name}" already exists but is Inactive. Activate it under Masters, or use a different name.`,
};

interface Existing {
  id: string;
  name: string;
  status: any;
  image: string;
  parent?: string;
}

interface Planned {
  id: Types.ObjectId;
  kind: Kind;
  name: string;
  image?: string;
  /** Sub Category: parent Category id. */
  parent?: string;
  parentName?: string;
  /** Account Ledger: which group it is filed under. */
  ledgerGroup?: LedgerGroupSpec;
}

/** An image a product row offers for one of its masters. */
export interface ImageOffer {
  kind: Kind;
  id: string;
  image: string;
}

export interface ResolveIssue {
  field: string;
  message: string;
  sheet: string;
}

export interface CommitResult {
  /** Planned id → id actually used (only differs after a duplicate-key race). */
  remap: Map<string, Types.ObjectId>;
  /** Planned id → reason it could not be created. */
  failed: Map<string, string>;
  created: { label: string; name: string }[];
}

/** Every master id a product payload carries, with a setter to rewrite it. */
const eachRef = (
  product: any,
  visit: (id: string, set: (value: any) => void) => void
) => {
  for (const field of FIELDS) {
    const id = product?.[field.path] ? String(product[field.path]) : "";
    if (id) visit(id, (v) => { product[field.path] = v; });
  }
  for (const variant of product?.productvariants || []) {
    if (!variant) continue;
    for (const key of ["baseunitid", "purchaseunitid"]) {
      if (variant[key]) visit(String(variant[key]), (v) => { variant[key] = v; });
    }
    for (const row of [...(variant.unitconversions || []), ...(variant.unitprices || [])]) {
      if (row?.unitid) visit(String(row.unitid), (v) => { row.unitid = v; });
    }
  }
};

export class ImportMasterPlanner {
  private byId = {} as Record<Kind, Map<string, Existing>>;
  private byName = {} as Record<Kind, Map<string, Existing[]>>;
  private planned = {} as Record<Kind, Map<string, Planned>>;
  private plannedById = new Map<string, Planned>();
  private groupCache = new Map<string, Types.ObjectId>();

  private constructor(private adminid: Types.ObjectId) {}

  /** One query per collection for the whole import — inactive records included. */
  static async load(adminid: Types.ObjectId): Promise<ImportMasterPlanner> {
    const planner = new ImportMasterPlanner(adminid);
    const lists = await Promise.all(
      KINDS.map((def) =>
        def.model
          .find({ admin: adminid })
          .select(`${def.nameField} status${def.hasImage ? " image" : ""}${def.extraSelect ? ` ${def.extraSelect}` : ""}`)
          .lean()
      )
    );

    KINDS.forEach((def, i) => {
      const byId = new Map<string, Existing>();
      const byName = new Map<string, Existing[]>();
      for (const doc of lists[i] as any[]) {
        const entry: Existing = {
          id: String(doc._id),
          name: String(doc[def.nameField] ?? ""),
          status: doc.status,
          image: String(doc.image ?? ""),
          parent: doc.category ? String(doc.category) : undefined,
        };
        byId.set(entry.id, entry);
        const key = masterNameKey(entry.name);
        const bucket = byName.get(key) ?? [];
        bucket.push(entry);
        byName.set(key, bucket);
      }
      planner.byId[def.kind] = byId;
      planner.byName[def.kind] = byName;
      planner.planned[def.kind] = new Map();
    });

    return planner;
  }

  private nameOf(kind: Kind, id: string): string {
    return this.byId[kind].get(id)?.name ?? this.plannedById.get(id)?.name ?? "";
  }

  /**
   * Existing id or planned id for a typed name. Returns null (and records the
   * issue) when the name is ambiguous or matches an inactive record.
   */
  private findOrPlan(kind: Kind, name: string, issue: (message: string) => void): string | null {
    const label = DEF[kind].label;
    const key = masterNameKey(name);
    const matches = this.byName[kind].get(key) ?? [];

    if (matches.length > 1) {
      issue(MESSAGES.ambiguous(label, name));
      return null;
    }
    if (matches.length === 1) {
      if (matches[0].status === false) {
        issue(MESSAGES.inactive(label, matches[0].name));
        return null;
      }
      return matches[0].id;
    }

    let plan = this.planned[kind].get(key);
    if (!plan) {
      plan = { id: new Types.ObjectId(), kind, name };
      this.planned[kind].set(key, plan);
      this.plannedById.set(String(plan.id), plan);
    }
    return String(plan.id);
  }

  /**
   * Fill the product's master ids from typed names, planning new records where
   * needed. Mutates `product`. Returns the image offers this row makes, to be
   * applied only if the product is actually saved.
   */
  resolve(
    product: any,
    names: Record<string, any> | null | undefined,
    permissions: Record<string, boolean | undefined>,
    issues: ResolveIssue[]
  ): ImageOffer[] {
    const offers: ImageOffer[] = [];
    const typed = names || {};

    /* ---------------- product-level masters ---------------- */
    for (const field of FIELDS) {
      if (permissions[field.permission] === false) continue;

      const issue = (message: string) =>
        issues.push({ field: field.path, message, sheet: "Products" });

      const name = cleanName(typed[field.nameKey]);
      let id = product?.[field.path] ? String(product[field.path]) : "";

      if (!id && name) {
        const found = this.findOrPlan(field.kind, name, issue);
        if (!found) {
          product[field.path] = null;
          continue;
        }
        id = found;
        product[field.path] = new Types.ObjectId(id);
      }

      if (!id) continue;
      const plan = this.plannedById.get(id);

      /* ---- Sub Category must sit under this row's Category ---- */
      if (field.kind === "subcategory") {
        const catId = product?.categoryid ? String(product.categoryid) : "";
        const catName = cleanName(typed.categoryname) || (catId ? this.nameOf("category", catId) : "");

        if (plan) {
          if (!catId) {
            issue(MESSAGES.subNeedsCategory(plan.name));
            product.subcategoryid = null;
            continue;
          }
          if (!plan.parent) {
            plan.parent = catId;
            plan.parentName = catName;
          } else if (plan.parent !== catId) {
            issue(MESSAGES.subSplitCategory(name || plan.name, plan.parentName ?? "", catName));
            product.subcategoryid = null;
            continue;
          }
        } else {
          const existing = this.byId.subcategory.get(id);
          if (existing?.parent && catId && existing.parent !== catId) {
            const parentName = this.nameOf("category", existing.parent);
            if (parentName) {
              issue(MESSAGES.subWrongCategory(existing.name, parentName, catName));
              product.subcategoryid = null;
              continue;
            }
          }
        }
      }

      /* ---- a new ledger is either a Sales or a Purchase account ---- */
      if (plan && field.ledgerGroup) {
        if (!plan.ledgerGroup) {
          plan.ledgerGroup = field.ledgerGroup;
        } else if (plan.ledgerGroup.role !== field.ledgerGroup.role) {
          issue(MESSAGES.ledgerSplitRole(plan.name, plan.ledgerGroup.role, field.ledgerGroup.role));
          product[field.path] = null;
          continue;
        }
      }

      if (field.imageKey) {
        const image = String(typed[field.imageKey] ?? "").trim();
        if (image) offers.push({ kind: field.kind, id, image });
      }
    }

    /* ---------------- units inside the variants ---------------- */
    const unitNames: { path?: string; name?: string }[] = Array.isArray(typed.units) ? typed.units : [];
    for (const entry of unitNames) {
      const name = cleanName(entry?.name);
      const [vRaw, slotKey, iRaw] = String(entry?.path ?? "").split(".");
      const slot = UNIT_SLOTS[slotKey];
      const variant = product?.productvariants?.[Number(vRaw)];
      if (!name || !slot || !variant) continue;
      if (permissions[slot.permission] === false) continue;

      const issue = (message: string) =>
        issues.push({ field: slot.field, message, sheet: slot.sheet });

      const isRowSlot = slotKey === "unitconversions" || slotKey === "unitprices";
      const target = isRowSlot ? variant[slotKey]?.[Number(iRaw)] : variant;
      const key = isRowSlot ? "unitid" : slotKey;
      if (!target || target[key]) continue; // already has an id from the dropdown

      const id = this.findOrPlan("unit", name, issue);
      target[key] = id ? new Types.ObjectId(id) : null;
    }

    return offers;
  }

  /** New masters the given products would create — for the dry-run summary. */
  pendingFor(products: any[]): { label: string; name: string }[] {
    const used = this.usedPlanIds(products);
    const out: { label: string; name: string }[] = [];
    for (const def of KINDS) {
      for (const plan of this.planned[def.kind].values()) {
        if (used.has(String(plan.id))) out.push({ label: def.label, name: plan.name });
      }
    }
    return out;
  }

  private usedPlanIds(products: any[]): Set<string> {
    const used = new Set<string>();
    for (const product of products) {
      eachRef(product, (id) => {
        if (this.plannedById.has(id)) used.add(id);
      });
    }
    return used;
  }

  /** "Sales Account" / "Purchase Account" group id, created if the business has none. */
  private async ledgerGroupId(spec: LedgerGroupSpec): Promise<Types.ObjectId> {
    const cached = this.groupCache.get(spec.groupName);
    if (cached) return cached;
    let group: any = await AccountGroup.findOne({
      admin: this.adminid,
      accountgroupname: nameRegex(spec.groupName),
    }).select("_id").lean();
    if (!group) {
      try {
        group = await AccountGroup.create({
          admin: this.adminid,
          accountgroupname: spec.groupName,
          category: spec.category,
          status: true,
        });
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
        group = await AccountGroup.findOne({ admin: this.adminid, accountgroupname: spec.groupName }).select("_id").lean();
      }
    }
    this.groupCache.set(spec.groupName, group._id);
    return group._id;
  }

  /**
   * Create the planned masters the saved products need, and give existing
   * Category / Sub Category records an image when they have none. An existing
   * image is never overwritten from a spreadsheet.
   */
  async commit(products: any[], offers: ImageOffer[]): Promise<CommitResult> {
    const used = this.usedPlanIds(products);
    const remap = new Map<string, Types.ObjectId>();
    const failed = new Map<string, string>();
    const created: { label: string; name: string }[] = [];

    // First offer wins, for new and existing masters alike.
    const existingFills = new Map<string, ImageOffer>();
    for (const offer of offers) {
      const plan = this.plannedById.get(offer.id);
      if (plan) {
        if (!plan.image) plan.image = offer.image;
        continue;
      }
      const existing = this.byId[offer.kind].get(offer.id);
      const key = `${offer.kind}:${offer.id}`;
      if (existing && !existing.image && !existingFills.has(key)) existingFills.set(key, offer);
    }

    for (const def of KINDS) {
      for (const plan of this.planned[def.kind].values()) {
        const planId = String(plan.id);
        if (!used.has(planId)) continue;

        const doc: any = {
          _id: plan.id,
          [def.nameField]: plan.name,
          status: true,
          admin: this.adminid,
        };
        if (def.hasImage) doc.image = plan.image ?? "";

        try {
          if (def.kind === "subcategory") {
            if (!plan.parent || failed.has(plan.parent)) {
              failed.set(planId, `Sub Category "${plan.name}" was not created because its Category could not be created.`);
              continue;
            }
            doc.category = remap.get(plan.parent) ?? new Types.ObjectId(plan.parent);
          }
          if (def.kind === "ledger") {
            const spec = plan.ledgerGroup ?? SALES_GROUP;
            doc.accountgroupid = await this.ledgerGroupId(spec);
            doc.ledgertype = "other";
            doc.openingbalance = 0;
            doc.openingbalancetype = spec.role === "Sales" ? "credit" : "debit";
          }

          await def.model.create(doc);
          created.push({ label: def.label, name: plan.name });
        } catch (err: any) {
          if (err?.code === 11000) {
            // Someone else created it between our check and now — use theirs.
            const found: any = await def.model
              .findOne({ admin: this.adminid, [def.nameField]: nameRegex(plan.name) })
              .select("_id status")
              .lean();
            if (found && found.status !== false) {
              remap.set(planId, found._id);
              continue;
            }
            failed.set(
              planId,
              found
                ? MESSAGES.inactive(def.label, plan.name)
                : `${def.label} "${plan.name}" could not be created because the name is already taken.`
            );
            continue;
          }
          failed.set(planId, `${def.label} "${plan.name}" could not be created: ${err?.message || "unknown error"}.`);
        }
      }
    }

    for (const offer of existingFills.values()) {
      const def = DEF[offer.kind];
      await def.model.updateOne(
        {
          _id: new Types.ObjectId(offer.id),
          admin: this.adminid,
          $or: [{ image: "" }, { image: null }, { image: { $exists: false } }],
        },
        { $set: { image: offer.image } }
      );
    }

    return { remap, failed, created };
  }

  /**
   * Point a product at the ids actually created. Returns the first failure
   * message if the product depends on a master that could not be created.
   */
  static applyCommit(product: any, result: CommitResult): string | null {
    let failure: string | null = null;
    eachRef(product, (id, set) => {
      if (failure) return;
      const reason = result.failed.get(id);
      if (reason) {
        failure = reason;
        return;
      }
      const mapped = result.remap.get(id);
      if (mapped) set(mapped);
    });
    return failure;
  }
}
