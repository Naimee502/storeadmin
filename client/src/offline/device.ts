// This browser's device code (A, B, …) per login and its own bill number series.
import { gql } from "@apollo/client";
import { META_STORE, idbDelete, idbGet, idbPut, idbUpdate } from "./idb";
import { currentUserKey } from "./userkey";
import { getOfflineClient, onSyncComplete } from "./outbox";
import { bumpSeq, formatDeviceNumber, maxSeq, parseDeviceNumber, type DocType, type SeqMap } from "./core";

const REGISTER_DEVICE = gql`
  mutation RegisterOfflineDevice($name: String!) {
    registerOfflineDevice(name: $name) {
      id
      code
      adminid
      name
      lastSeq
    }
  }
`;

const DEVICE_HEARTBEAT = gql`
  mutation OfflineDeviceHeartbeat($code: String!, $lastSeq: JSON) {
    offlineDeviceHeartbeat(code: $code, lastSeq: $lastSeq) {
      id
      code
      adminid
      lastSeq
    }
  }
`;

export interface DeviceInfo {
  code: string;
  adminid: string;
  name: string;
  registeredAt: number;
}

type DeviceRecord = DeviceInfo & { key: string };
type SeqRecord = { key: string; seqs: SeqMap };

const lsKey = (userKey: string) => `offline:device:${userKey}`;
const deviceKey = (userKey: string) => `device:${userKey}`;
const seqKey = (d: DeviceInfo) => `seq:${d.adminid}:${d.code}`;
const REGISTER_RETRY_MS = 60000;

let memo: { userKey: string; info: DeviceInfo } | null = null;
let lastRegisterAttempt = 0;
let started = false;

const validInfo = (v: any): DeviceInfo | null =>
  v && typeof v.code === "string" && /^[A-Z]{1,3}$/.test(v.code) && typeof v.adminid === "string"
    ? { code: v.code, adminid: v.adminid, name: String(v.name || ""), registeredAt: Number(v.registeredAt) || 0 }
    : null;

function readLocal(userKey: string): DeviceInfo | null {
  try {
    return validInfo(JSON.parse(localStorage.getItem(lsKey(userKey)) || "null"));
  } catch {
    return null;
  }
}

function writeLocal(userKey: string, info: DeviceInfo | null) {
  try {
    if (info) localStorage.setItem(lsKey(userKey), JSON.stringify(info));
    else localStorage.removeItem(lsKey(userKey));
  } catch {
    // IndexedDB still has it.
  }
}

// Registered device of the current login, read synchronously (null if not registered yet).
export function getDevice(): DeviceInfo | null {
  const userKey = currentUserKey();
  if (!userKey) return null;
  if (memo?.userKey === userKey) return memo.info;
  const info = readLocal(userKey);
  if (info) memo = { userKey, info };
  return info;
}

export const getDeviceCode = (): string | null => getDevice()?.code ?? null;

async function loadDevice(): Promise<DeviceInfo | null> {
  const userKey = currentUserKey();
  if (!userKey) return null;
  let info: DeviceInfo | null = null;
  try {
    info = validInfo(await idbGet<DeviceRecord>(META_STORE, deviceKey(userKey)));
  } catch {
    // Fall back to the local copy.
  }
  if (!info) {
    info = readLocal(userKey);
    if (info) await idbPut(META_STORE, { ...info, key: deviceKey(userKey) }).catch(() => {});
  } else if (!readLocal(userKey)) {
    writeLocal(userKey, info);
  }
  if (info) memo = { userKey, info };
  return info;
}

async function saveDevice(userKey: string, info: DeviceInfo | null) {
  if (info) {
    await idbPut(META_STORE, { ...info, key: deviceKey(userKey) } satisfies DeviceRecord);
    memo = { userKey, info };
  } else {
    await idbDelete(META_STORE, deviceKey(userKey)).catch(() => {});
    memo = null;
  }
  writeLocal(userKey, info);
}

// "Chrome on Windows" style label shown in the device list.
export function deviceName(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /CrOS/.test(ua)
          ? "ChromeOS"
          : /Mac OS X|Macintosh/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return os ? `${browser} on ${os}` : browser;
}

async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks: any = typeof navigator !== "undefined" ? (navigator as any).locks : null;
  if (locks?.request) return locks.request(name, fn);
  return fn();
}

// Registers this browser once per login (online only); returns the device or null.
export async function ensureDevice(): Promise<DeviceInfo | null> {
  const existing = await loadDevice();
  if (existing) return existing;
  const client = getOfflineClient();
  const userKey = currentUserKey();
  if (!client || !userKey || navigator.onLine === false) return null;
  if (Date.now() - lastRegisterAttempt < REGISTER_RETRY_MS) return null;
  lastRegisterAttempt = Date.now();
  return withLock("storeadmin-offline-register", async () => {
    // Another tab may have registered while this one waited.
    const again = await loadDevice();
    if (again) return again;
    try {
      const res: any = await client.mutate({ mutation: REGISTER_DEVICE, variables: { name: deviceName() }, fetchPolicy: "no-cache" });
      const d = res?.data?.registerOfflineDevice;
      const info = validInfo({ ...d, registeredAt: Date.now() });
      if (!info || currentUserKey() !== userKey) return null;
      await saveDevice(userKey, info);
      await raiseCounters(d?.lastSeq);
      return info;
    } catch {
      return null;
    }
  });
}

export async function getLocalSeqs(): Promise<SeqMap> {
  const d = await loadDevice();
  if (!d) return {};
  try {
    return (await idbGet<SeqRecord>(META_STORE, seqKey(d)))?.seqs || {};
  } catch {
    return {};
  }
}

// Raises local counters to at least the given values (never lowers them).
export async function raiseCounters(lastSeq: unknown): Promise<void> {
  const d = await loadDevice();
  if (!d) return;
  const key = seqKey(d);
  await idbUpdate<SeqRecord>(META_STORE, key, (cur) => ({ key, seqs: maxSeq(cur?.seqs, lastSeq) })).catch(() => {});
}

// Next number of this device's series, persisted before it is returned; null when not registered.
export async function nextDeviceNumber(type: DocType): Promise<string | null> {
  const d = await loadDevice();
  if (!d) return null;
  const key = seqKey(d);
  const rec = await idbUpdate<SeqRecord>(META_STORE, key, (cur) => ({ key, seqs: bumpSeq(cur?.seqs, type).seqs }));
  return formatDeviceNumber(type, d.code, rec.seqs[type] || 0);
}

// Number the next nextDeviceNumber call would return (for display only).
export async function peekDeviceNumber(type: DocType): Promise<string | null> {
  const d = await loadDevice();
  if (!d) return null;
  const seqs = await getLocalSeqs();
  return formatDeviceNumber(type, d.code, (seqs[type] || 0) + 1);
}

// True when the value is a number of this device's own series for the type.
export function isOwnDeviceNumber(type: DocType, value: unknown): boolean {
  const p = parseDeviceNumber(type, value);
  return !!p && p.code === getDeviceCode();
}

// A number typed or reserved elsewhere still moves the counter past it.
export async function noteUsedNumber(type: DocType, value: unknown): Promise<void> {
  const p = parseDeviceNumber(type, value);
  if (!p || p.code !== getDeviceCode()) return;
  await raiseCounters({ [type]: p.seq });
}

// Tells the server the counters and takes back its higher ones; forgets a device the server no longer knows.
export async function heartbeat(): Promise<void> {
  const client = getOfflineClient();
  const userKey = currentUserKey();
  const d = await loadDevice();
  if (!client || !userKey || !d || navigator.onLine === false) return;
  try {
    const lastSeq = await getLocalSeqs();
    const res: any = await client.mutate({
      mutation: DEVICE_HEARTBEAT,
      variables: { code: d.code, lastSeq },
      fetchPolicy: "no-cache",
    });
    const dev = res?.data?.offlineDeviceHeartbeat;
    if (dev === null && res?.data && !res?.errors) {
      // Removed on the server: register again on the next start.
      await saveDevice(userKey, null);
      return;
    }
    if (dev?.lastSeq) await raiseCounters(dev.lastSeq);
  } catch {
    // Next start or sync tries again.
  }
}

// Registration and heartbeat on start, when back online and after each sync.
export function startDevice(): void {
  const run = () => void ensureDevice().then((d) => (d ? heartbeat() : undefined));
  if (!started) {
    started = true;
    onSyncComplete(() => void heartbeat());
    window.addEventListener("online", run);
  }
  run();
}
