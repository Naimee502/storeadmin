// e-Invoice (NIC IRP schema 1.1) and e-Way Bill (NIC bulk JSON) built from our bills, with what is missing.

export const GST_STATE_CODES: Record<string, string> = {
  jammu_kashmir: "01", himachal_pradesh: "02", punjab: "03", chandigarh: "04", uttarakhand: "05", haryana: "06",
  delhi: "07", rajasthan: "08", uttar_pradesh: "09", bihar: "10", sikkim: "11", arunachal_pradesh: "12",
  nagaland: "13", manipur: "14", mizoram: "15", tripura: "16", meghalaya: "17", assam: "18", west_bengal: "19",
  jharkhand: "20", odisha: "21", chhattisgarh: "22", madhya_pradesh: "23", gujarat: "24",
  dadra_nagar_haveli_daman_diu: "26", maharashtra: "27", karnataka: "29", goa: "30", lakshadweep: "31",
  kerala: "32", tamil_nadu: "33", puducherry: "34", andaman_nicobar: "35", telangana: "36", andhra_pradesh: "37",
  ladakh: "38", international: "96",
};

export const GSTIN_RX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PIN_RX = /^[1-9]\d{5}$/;
const HSN_RX = /^\d{4,8}$/;

// Unit name -> UQC when a unit has none saved.
const UQC_GUESS: Array<[RegExp, string]> = [
  [/^(pc|pcs|piece|pieces|nos?|number)s?\b/i, "PCS"], [/^(kg|kgs|kilo|kilogram)/i, "KGS"], [/^(g|gm|gms|gram)/i, "GMS"],
  [/^(l|ltr|litre|liter)/i, "LTR"], [/^(ml|millilit)/i, "MLT"], [/^box/i, "BOX"], [/^(doz|dozen)/i, "DOZ"],
  [/^(pkt|packet|pack)/i, "PAC"], [/^(btl|bottle)/i, "BTL"], [/^bag/i, "BAG"], [/^(ctn|carton)/i, "CTN"],
  [/^(mtr|meter|metre)/i, "MTR"], [/^set/i, "SET"], [/^roll/i, "ROL"], [/^pair/i, "PRS"], [/^(ton|tonne)/i, "TON"],
  [/^(qtl|quintal)/i, "QTL"], [/^can/i, "CAN"], [/^(tab|tablet)/i, "TBS"], [/^(sq\.? ?ft|sqft)/i, "SQF"],
];
export const uqcOf = (unit: any): string => {
  if (unit?.uqc) return String(unit.uqc);
  const name = String(unit?.unitname || "").trim();
  for (const [rx, code] of UQC_GUESS) if (rx.test(name)) return code;
  return "OTH";
};

const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const dmy = (ymd: any) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(ymd || "");
};
const text = (v: any, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const stateCodeOf = (state: any, gstin?: any) =>
  GST_STATE_CODES[String(state || "").toLowerCase()] || (GSTIN_RX.test(String(gstin || "")) ? String(gstin).slice(0, 2) : "");

export type GstCheck = { errors: string[]; warnings: string[] };

/** Seller details from the GST profile, falling back to the business and branch address. */
export function sellerOf(settings: any, admin: any, branch: any) {
  const gstin = String(settings?.gstin || "").toUpperCase();
  return {
    gstin,
    legalName: text(settings?.legalName || admin?.companyName, 100),
    tradeName: text(settings?.tradeName || settings?.legalName || admin?.companyName, 100),
    address: text(settings?.gstAddress || admin?.address || branch?.address, 100),
    city: text(settings?.gstCity || branch?.city, 50),
    pincode: String(settings?.gstPincode || branch?.pincode || "").trim(),
    stateCode: stateCodeOf(settings?.companyState, gstin),
    phone: String(admin?.mobile || "").replace(/\D/g, "").slice(-10),
  };
}

function checkSeller(s: any, c: GstCheck) {
  if (!GSTIN_RX.test(s.gstin)) c.errors.push("Your GSTIN is missing or wrong — Business Settings → GST Profile.");
  if (s.legalName.length < 3) c.errors.push("Your legal name is missing — Business Settings → GST Profile.");
  if (s.address.length < 3) c.errors.push("Your address is missing — Business Settings → GST Profile.");
  if (s.city.length < 3) c.errors.push("Your city is missing — Business Settings → GST Profile.");
  if (!PIN_RX.test(s.pincode)) c.errors.push("Your pincode is missing or wrong — Business Settings → GST Profile.");
  if (!s.stateCode) c.errors.push("Your state is missing — Business Settings → GST Profile.");
  else if (GSTIN_RX.test(s.gstin) && s.gstin.slice(0, 2) !== s.stateCode) c.errors.push("Your state does not match your GSTIN's state code.");
}

function partyOf(p: any) {
  const gstin = String(p?.gstnumber || "").toUpperCase().trim();
  return {
    gstin,
    name: text(p?.name, 100),
    address: text(p?.address || p?.city, 100),
    city: text(p?.city, 50),
    pincode: String(p?.pincode || "").trim(),
    stateCode: stateCodeOf(p?.state, gstin),
    phone: String(p?.mobile || "").replace(/\D/g, "").slice(-10),
  };
}

function checkParty(b: any, c: GstCheck, needGstin: boolean) {
  const who = b.name || "the party";
  if (needGstin && !GSTIN_RX.test(b.gstin)) c.errors.push(`${who} has no valid GSTIN — e-Invoice is only for registered (B2B) parties.`);
  if (b.address.length < 3) c.errors.push(`${who}: address is missing — Party Accounts.`);
  if (b.city.length < 3) c.errors.push(`${who}: city is missing — Party Accounts.`);
  if (!PIN_RX.test(b.pincode)) c.errors.push(`${who}: pincode is missing or wrong — Party Accounts.`);
  if (!b.stateCode) c.errors.push(`${who}: state is missing — Party Accounts.`);
}

/** Lines with HSN, UQC and tax split; inter-state when the two state codes differ. */
function linesOf(doc: any, inter: boolean, c: GstCheck) {
  return (doc.productservice || []).map((l: any, i: number) => {
    const prod = l.productserviceid || {};
    const variant = (prod.productvariants || []).find((v: any) => String(v._id) === String(l.variantid));
    const isService = !!doc.isservice;
    const name = text(`${prod.name || "Item"}${variant?.name ? ` ${variant.name}` : ""}`, 300);
    const hsn = String(variant?.hsncode || "").replace(/\s/g, "");
    if (!HSN_RX.test(hsn)) c.errors.push(`${name}: HSN${isService ? "/SAC" : ""} code is missing — Products.`);
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const disc = Number(l.discount) || 0;
    const taxable = r2((rate - disc) * qty);
    const gstRt = Number(l.gst) || 0;
    const tax = r2((taxable * gstRt) / 100);
    const cgst = inter ? 0 : r2(tax / 2);
    return {
      slNo: String(i + 1), name, hsn, isService, qty, unit: uqcOf(l.salesunitid), rate: r2(rate),
      total: r2(rate * qty), discount: r2(disc * qty), taxable, gstRt,
      igst: inter ? tax : 0, cgst, sgst: inter ? 0 : r2(tax - cgst), value: r2(taxable + tax),
    };
  });
}

const sum = (rows: any[], k: string) => r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));

/** NIC IRP e-Invoice JSON (schema 1.1) for a sales invoice. */
export function buildEInvoice(inv: any, seller: any): { payload: any; check: GstCheck } {
  const check: GstCheck = { errors: [], warnings: [] };
  checkSeller(seller, check);
  const buyer = partyOf(inv.partyacc);
  checkParty(buyer, check, true);
  const inter = !!seller.stateCode && !!buyer.stateCode && seller.stateCode !== buyer.stateCode;
  const items = linesOf(inv, inter, check);
  if (!items.length) check.errors.push("The invoice has no items.");
  // IRP document number: 1-16 characters, must not start with 0 or "/" (so "000032" goes as "INV-000032").
  const docNo = `INV-${inv.billnumber || ""}`.slice(0, 16);
  if (inv.cancelStatus === "cancelled") check.errors.push("This invoice is cancelled.");
  const charges = (inv.othercharges || []).reduce((s: number, ch: any) => s + (Number(ch.totalamount ?? ch.amount) || 0), 0);
  if ((inv.othercharges || []).some((ch: any) => Number(ch.gstamount) > 0)) {
    check.warnings.push("GST on other charges is sent inside 'Other Charges' (not as tax); add the charge as an item if the portal rejects it.");
  }
  const val = {
    AssVal: sum(items, "taxable"), CgstVal: sum(items, "cgst"), SgstVal: sum(items, "sgst"), IgstVal: sum(items, "igst"),
    CesVal: 0, StCesVal: 0,
    Discount: r2(inv.totalamount != null ? Math.max(0, sum(items, "value") + charges + (Number(inv.roundoff) || 0) - Number(inv.totalamount)) : 0),
    OthChrg: r2(charges), RndOffAmt: r2(inv.roundoff), TotInvVal: r2(inv.totalamount),
  };
  const ewb = inv.vehiclenumber
    ? { TransName: text(inv.transportname, 100) || undefined, Distance: Math.max(0, Math.round(Number(inv.distance) || 0)), VehNo: String(inv.vehiclenumber).toUpperCase().replace(/[^A-Z0-9]/g, ""), VehType: "R", TransMode: "1" }
    : undefined;
  const payload = {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: "N", IgstOnIntra: "N" },
    DocDtls: { Typ: "INV", No: docNo, Dt: dmy(inv.billdate) },
    SellerDtls: { Gstin: seller.gstin, LglNm: seller.legalName, TrdNm: seller.tradeName, Addr1: seller.address, Loc: seller.city, Pin: Number(seller.pincode) || 0, Stcd: seller.stateCode, ...(seller.phone.length === 10 ? { Ph: seller.phone } : {}) },
    BuyerDtls: { Gstin: buyer.gstin, LglNm: buyer.name, TrdNm: buyer.name, Pos: buyer.stateCode, Addr1: buyer.address, Loc: buyer.city, Pin: Number(buyer.pincode) || 0, Stcd: buyer.stateCode, ...(buyer.phone.length === 10 ? { Ph: buyer.phone } : {}) },
    ItemList: items.map((x: any) => ({
      SlNo: x.slNo, PrdDesc: x.name, IsServc: x.isService ? "Y" : "N", HsnCd: x.hsn, Qty: x.qty, FreeQty: 0, Unit: x.unit,
      UnitPrice: x.rate, TotAmt: x.total, Discount: x.discount, PreTaxVal: 0, AssAmt: x.taxable, GstRt: x.gstRt,
      IgstAmt: x.igst, CgstAmt: x.cgst, SgstAmt: x.sgst, CesRt: 0, CesAmt: 0, CesNonAdvlAmt: 0,
      StateCesRt: 0, StateCesAmt: 0, StateCesNonAdvlAmt: 0, OthChrg: 0, TotItemVal: x.value,
    })),
    ValDtls: val,
    ...(ewb ? { EwbDtls: ewb } : {}),
  };
  return { payload, check };
}

// Challan reason -> e-Way Bill sub supply type (NIC codes).
const SUB_SUPPLY: Record<string, [number, string]> = {
  sale: [8, "Supply on delivery challan"], jobwork: [4, ""], approval: [8, "Sent on approval"],
  repair: [8, "Sent for repair"], branchtransfer: [5, ""], other: [8, "Others"],
};

/** NIC e-Way Bill bulk JSON for a sales invoice (docType INV) or a delivery challan (CHL). */
export function buildEWayBill(doc: any, kind: "invoice" | "challan", seller: any): { payload: any; check: GstCheck } {
  const check: GstCheck = { errors: [], warnings: [] };
  checkSeller(seller, check);
  const to = partyOf(doc.partyacc);
  checkParty(to, check, false);
  const inter = !!seller.stateCode && !!to.stateCode && seller.stateCode !== to.stateCode;
  const items = linesOf(doc, inter, check);
  if (!items.length) check.errors.push("There are no items.");
  if (!doc.vehiclenumber) check.warnings.push("Vehicle number is empty — the e-Way Bill is made with Part-A only; add the vehicle (Part-B) on the portal before the goods move.");
  const distance = Math.round(Number(doc.distance) || 0);
  if (!distance) check.warnings.push("Distance is 0 — the portal works it out from the two pincodes.");
  const [subType, subDesc] = kind === "invoice" ? [1, ""] : SUB_SUPPLY[doc.reason || "sale"] || SUB_SUPPLY.other;
  const branchTransfer = kind === "challan" && doc.reason === "branchtransfer";
  const totalValue = sum(items, "taxable");
  const taxes = { cgst: sum(items, "cgst"), sgst: sum(items, "sgst"), igst: sum(items, "igst") };
  const totInv = kind === "invoice" ? r2(doc.totalamount) : r2(totalValue + taxes.cgst + taxes.sgst + taxes.igst);
  const main = items.find((x: any) => HSN_RX.test(x.hsn))?.hsn || "";
  const bill = {
    userGstin: seller.gstin,
    supplyType: "O",
    subSupplyType: subType,
    subSupplyDesc: subDesc,
    docType: kind === "invoice" ? "INV" : "CHL",
    docNo: (kind === "invoice" ? `INV-${doc.billnumber || ""}` : `DC-${doc.billnumber || doc.offlineNumber || ""}`).slice(0, 16),
    docDate: dmy(doc.billdate),
    fromGstin: seller.gstin, fromTrdName: seller.tradeName, fromAddr1: seller.address, fromAddr2: "", fromPlace: seller.city,
    fromPincode: Number(seller.pincode) || 0, fromStateCode: Number(seller.stateCode) || 0, actFromStateCode: Number(seller.stateCode) || 0,
    toGstin: branchTransfer ? seller.gstin : GSTIN_RX.test(to.gstin) ? to.gstin : "URP",
    toTrdName: to.name, toAddr1: to.address, toAddr2: "", toPlace: to.city,
    toPincode: Number(to.pincode) || 0, toStateCode: Number(to.stateCode) || 0, actToStateCode: Number(to.stateCode) || 0,
    transactionType: 1,
    otherValue: r2(totInv - totalValue - taxes.cgst - taxes.sgst - taxes.igst),
    totalValue, cgstValue: taxes.cgst, sgstValue: taxes.sgst, igstValue: taxes.igst, cessValue: 0, cessNonAdvolValue: 0,
    totInvValue: totInv,
    transporterId: "", transporterName: text(doc.transportname, 100), transDocNo: "", transDocDate: "",
    transMode: doc.vehiclenumber ? "1" : "", transDistance: String(distance),
    vehicleNo: doc.vehiclenumber ? String(doc.vehiclenumber).toUpperCase().replace(/[^A-Z0-9]/g, "") : "",
    vehicleType: doc.vehiclenumber ? "R" : "",
    mainHsnCode: Number(main) || 0,
    itemList: items.map((x: any) => ({
      itemNo: Number(x.slNo), productName: x.name, productDesc: x.name, hsnCode: Number(x.hsn) || 0, quantity: x.qty,
      qtyUnit: x.unit, taxableAmount: x.taxable, sgstRate: inter ? 0 : x.gstRt / 2, cgstRate: inter ? 0 : x.gstRt / 2,
      igstRate: inter ? x.gstRt : 0, cessRate: 0, cessNonAdvol: 0,
    })),
  };
  return { payload: { version: "1.0.0621", billLists: [bill] }, check };
}
