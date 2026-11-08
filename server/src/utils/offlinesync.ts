import { ApolloError } from "apollo-server-express";
import { OfflineDevice } from "../models/offlinedevice";

// Offline billing support: device-series numbers and edit-conflict checks.

export type OfflineDocType = "salesinvoice" | "salesorder" | "salesreturn" | "payment";
export const OFFLINE_DOC_TYPES: OfflineDocType[] = ["salesinvoice", "salesorder", "salesreturn", "payment"];

/** Device series code: A..Z, AA..ZZ, AAA..ZZZ. */
export const DEVICE_CODE_RX = /^[A-Z]{1,3}$/;

const DEVICE_NUMBER_RX: Record<OfflineDocType, RegExp> = {
  salesinvoice: /^([A-Z]{1,3})\/(\d{6})$/,
  salesorder: /^([A-Z]{1,3})\/(\d{6})$/,
  salesreturn: /^CN-([A-Z]{1,3})\/(\d{6})$/,
  payment: /^#PAY-([A-Z]{1,3})\/(\d{6})$/,
};

export type DeviceNumber = { type: OfflineDocType; code: string; seq: number; value: string };

/** Parses a device-series number for this doc type, null when it is not one. */
export function parseDeviceNumber(type: OfflineDocType, value: any): DeviceNumber | null {
  if (typeof value !== "string") return null;
  const m = DEVICE_NUMBER_RX[type].exec(value);
  return m ? { type, code: m[1], seq: parseInt(m[2], 10), value } : null;
}

/** 0 -> A, 25 -> Z, 26 -> AA (bijective base 26). */
export function deviceCodeFromIndex(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Inverse of deviceCodeFromIndex; -1 for anything that is not a code. */
export function deviceCodeIndex(code: string): number {
  if (!/^[A-Z]+$/.test(String(code || ""))) return -1;
  let n = 0;
  for (const ch of code) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * When `value` is a device-series number: the device must belong to the
 * business and the number must not be used yet. Returns null for any other value.
 */
export async function checkDeviceNumber(
  type: OfflineDocType,
  adminid: any,
  value: any,
  model: any,
  field = "billnumber"
): Promise<DeviceNumber | null> {
  const parsed = parseDeviceNumber(type, value);
  if (!parsed) return null;
  const device = await OfflineDevice.exists({ adminid, code: parsed.code });
  if (!device) {
    throw new ApolloError(
      `Number ${value} uses device series "${parsed.code}", which is not registered for this business.`,
      "INVALID_DEVICE_NUMBER",
      { number: value, code: parsed.code }
    );
  }
  const dup = await model.exists({ adminid, [field]: value });
  if (dup) {
    throw new ApolloError(`Number ${value} is already used.`, "DUPLICATE_NUMBER", {
      number: value,
      existingId: String(dup._id),
    });
  }
  return parsed;
}

/** Raises the device's lastSeq for this doc type (never lowers). Best-effort. */
export async function raiseDeviceSeq(adminid: any, parsed: DeviceNumber | null) {
  if (!parsed) return;
  try {
    await OfflineDevice.updateOne(
      { adminid, code: parsed.code },
      { $max: { [`lastSeq.${parsed.type}`]: parsed.seq }, $set: { lastSeen: new Date() } }
    );
  } catch (e) { /* bookkeeping only */ }
}

/** Date as ISO string; accepts Date, epoch ms (number or digit string) or ISO text. */
export const isoOf = (d: any): string | null => {
  if (d === null || d === undefined || d === "") return null;
  const v = typeof d === "string" && /^\d+$/.test(d) ? Number(d) : d;
  const t = new Date(v);
  return isNaN(t.getTime()) ? null : t.toISOString();
};

/** Parses the optional expectedUpdatedAt argument; null when absent. */
export function parseExpectedUpdatedAt(value: any): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const iso = isoOf(String(value).trim());
  if (!iso) throw new ApolloError("expectedUpdatedAt is not a valid date.", "BAD_USER_INPUT");
  return new Date(iso);
}

/** CONFLICT error carrying the current document (as the API formats it). */
export async function conflictError(loadCurrent: () => Promise<any>) {
  let current: any = null;
  try {
    current = await loadCurrent();
  } catch (e) { /* still report the conflict */ }
  if (current) current = { ...current, updatedAt: isoOf(current.updatedAt) };
  return new ApolloError(
    "This record was changed on another device. Review the latest version and try again.",
    "CONFLICT",
    { current }
  );
}

/**
 * Throws CONFLICT when `expected` is given and differs from the stored
 * updatedAt (millisecond precision). Returns the stored stamp to guard the write
 * with, or null when no check was asked for.
 */
export async function assertFresh(
  stored: any,
  expected: Date | null,
  loadCurrent: () => Promise<any>
): Promise<Date | null> {
  if (!expected) return null;
  const storedAt = stored ? new Date(stored) : null;
  if (!storedAt || isNaN(storedAt.getTime()) || storedAt.getTime() !== expected.getTime()) {
    throw await conflictError(loadCurrent);
  }
  return storedAt;
}

/** findByIdAndUpdate, or a findOneAndUpdate that only matches the unchanged doc when guarded. */
export const updateByIdGuarded = (model: any, id: any, guardAt: Date | null, update: any, options?: any) =>
  guardAt
    ? model.findOneAndUpdate({ _id: id, updatedAt: guardAt }, update, options)
    : model.findByIdAndUpdate(id, update, options);
