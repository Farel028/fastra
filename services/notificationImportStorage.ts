import AsyncStorage from "@react-native-async-storage/async-storage";
import { firestore } from "@/config/firebase";
import { WalletType } from "@/types";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  NotificationImportConfig,
  NotificationImportDebugEvent,
  PendingNotificationImport,
  NOTIFICATION_SOURCE_RULES,
} from "@/services/notificationImportRules";
import { NOTIFICATION_IMPORT_DEBUG_ENABLED } from "@/services/notificationImportRuntimeState";

const STORAGE_PREFIX = "entrack:notification-import";
const ACTIVE_UID_KEY = `${STORAGE_PREFIX}:active-uid`;
const SEEN_KEY_PREFIX = `${STORAGE_PREFIX}:seen`;
const DEBUG_KEY_PREFIX = `${STORAGE_PREFIX}:debug`;
const MANUAL_ACCESS_KEY_PREFIX = `${STORAGE_PREFIX}:manual-access`;
const PENDING_KEY_PREFIX = `${STORAGE_PREFIX}:pending`;
const SEEN_MAX_ITEMS = 200;
const SEEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PENDING_MAX_ITEMS = 30;
const PENDING_TEXT_MAX_LENGTH = 360;
const PENDING_META_MAX_LENGTH = 120;
const PENDING_RAW_MAX_LENGTH = 350_000;
const USER_NOTIFICATION_CONFIG_FIELD = "notificationImportConfig";

const getSeenStorageKey = (uid: string): string => `${SEEN_KEY_PREFIX}:${uid}`;
const getDebugStorageKey = (uid: string): string => `${DEBUG_KEY_PREFIX}:${uid}`;
const getManualAccessKey = (uid: string): string =>
  `${MANUAL_ACCESS_KEY_PREFIX}:${uid}`;
const getPendingStorageKey = (uid: string): string =>
  `${PENDING_KEY_PREFIX}:${uid}`;
const getUserDocRef = (uid: string) => doc(firestore, "users", uid);

const getDefaultNotificationImportConfig = (): NotificationImportConfig => ({
  enabled: true,
  fallbackWalletId: null,
  sourceWalletMappings: {},
  blockedSourceApps: [],
});

export const getActiveNotificationImportUid = async (): Promise<string | null> => {
  return AsyncStorage.getItem(ACTIVE_UID_KEY);
};

export const setNotificationImportActiveUid = async (
  uid: string | null,
): Promise<void> => {
  if (!uid) {
    await AsyncStorage.removeItem(ACTIVE_UID_KEY);
    return;
  }

  await AsyncStorage.setItem(ACTIVE_UID_KEY, uid);
};

const readSeenKeys = async (uid: string): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(getSeenStorageKey(uid));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const writeSeenKeys = async (uid: string, keys: string[]): Promise<void> => {
  await AsyncStorage.setItem(getSeenStorageKey(uid), JSON.stringify(keys));
};

export const markSeenKey = async (uid: string, key: string): Promise<void> => {
  const now = Date.now();
  const existing = await readSeenKeys(uid);
  const compact = existing
    .filter((item) => item !== key)
    .slice(-(SEEN_MAX_ITEMS - 1));

  compact.push(`${key}:${now}`);
  await writeSeenKeys(uid, compact);
};

export const hasSeenKey = async (uid: string, key: string): Promise<boolean> => {
  const now = Date.now();
  const existing = await readSeenKeys(uid);

  const fresh = existing.filter((item) => {
    const splitIndex = item.lastIndexOf(":");
    if (splitIndex <= 0) return false;
    const itemKey = item.slice(0, splitIndex);
    const timestamp = Number(item.slice(splitIndex + 1));
    if (!Number.isFinite(timestamp)) return false;
    if (now - timestamp > SEEN_MAX_AGE_MS) return false;
    return itemKey === key;
  });

  if (fresh.length !== existing.length) {
    await writeSeenKeys(uid, fresh);
  }

  return fresh.some((item) => item.startsWith(`${key}:`));
};

export const loadNotificationImportDebugEvents = async (
  uid: string,
  limit = 30,
): Promise<NotificationImportDebugEvent[]> => {
  if (!NOTIFICATION_IMPORT_DEBUG_ENABLED) return [];

  const raw = await AsyncStorage.getItem(getDebugStorageKey(uid));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .slice(-Math.max(1, limit))
      .map((item) => ({
        time: String((item as any)?.time ?? new Date().toISOString()),
        level:
          (item as any)?.level === "warn" || (item as any)?.level === "error"
            ? (item as any).level
            : "info",
        stage: String((item as any)?.stage ?? "debug"),
        message: String((item as any)?.message ?? ""),
        data: (item as any)?.data,
      }));
  } catch {
    return [];
  }
};

export const clearNotificationImportDebugEvents = async (
  uid: string,
): Promise<void> => {
  if (!NOTIFICATION_IMPORT_DEBUG_ENABLED) return;

  await AsyncStorage.removeItem(getDebugStorageKey(uid));
};

export const appendNotificationImportDebugEvent = async (
  uid: string,
  event: Omit<NotificationImportDebugEvent, "time"> & { time?: string },
): Promise<void> => {
  if (!NOTIFICATION_IMPORT_DEBUG_ENABLED) return;

  const current = await loadNotificationImportDebugEvents(uid, 200);
  const next: NotificationImportDebugEvent[] = [
    ...current,
    {
      time: event.time ?? new Date().toISOString(),
      level: event.level,
      stage: event.stage,
      message: event.message,
      data: event.data,
    },
  ].slice(-200);

  await AsyncStorage.setItem(getDebugStorageKey(uid), JSON.stringify(next));
};

const sanitizeNotificationConfig = (
  value: unknown,
): NotificationImportConfig => {
  if (!value || typeof value !== "object") return getDefaultNotificationImportConfig();

  const parsed = value as Partial<NotificationImportConfig>;
  const validSourceKeys = new Set(NOTIFICATION_SOURCE_RULES.map((rule) => rule.key));
  const sourceWalletMappings =
    parsed.sourceWalletMappings && typeof parsed.sourceWalletMappings === "object"
      ? Object.entries(parsed.sourceWalletMappings).reduce(
          (acc, [rawKey, walletId]) => {
            const key = rawKey.startsWith("custom:")
              ? rawKey.replace(/^custom:/, "")
              : rawKey;
            if (validSourceKeys.has(key as any) && typeof walletId === "string" && walletId) {
              acc[key as keyof NotificationImportConfig["sourceWalletMappings"]] = walletId;
            }
            return acc;
          },
          {} as NotificationImportConfig["sourceWalletMappings"],
        )
      : {};

  return {
    enabled: parsed.enabled !== false,
    fallbackWalletId:
      typeof parsed.fallbackWalletId === "string" && parsed.fallbackWalletId
        ? parsed.fallbackWalletId
        : null,
    sourceWalletMappings,
    blockedSourceApps: Array.isArray(parsed.blockedSourceApps)
      ? parsed.blockedSourceApps
          .map((item) => String(item ?? "").trim().toLowerCase())
          .filter(Boolean)
      : [],
  };
};

const getNotificationConfig = async (
  uid: string,
): Promise<NotificationImportConfig> => {
  try {
    const snap = await getDoc(getUserDocRef(uid));
    const rawConfig = snap.exists()
      ? snap.data()?.[USER_NOTIFICATION_CONFIG_FIELD]
      : null;

    if (rawConfig && typeof rawConfig === "object") {
      return sanitizeNotificationConfig(rawConfig);
    }
  } catch {
    return getDefaultNotificationImportConfig();
  }

  return getDefaultNotificationImportConfig();
};

export const saveNotificationImportConfig = async (
  uid: string,
  config: NotificationImportConfig,
): Promise<void> => {
  const sanitized = sanitizeNotificationConfig(config);
  const userRef = getUserDocRef(uid);

  await setDoc(userRef, { [USER_NOTIFICATION_CONFIG_FIELD]: sanitized }, { merge: true });
  await updateDoc(userRef, {
    [`${USER_NOTIFICATION_CONFIG_FIELD}.customSourceRules`]: deleteField(),
  });
};

export const loadNotificationImportConfig = getNotificationConfig;

export const loadNotificationImportManualAccess = async (
  uid: string,
): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(getManualAccessKey(uid));
  return raw === "true";
};

export const saveNotificationImportManualAccess = async (
  uid: string,
  confirmed: boolean,
): Promise<void> => {
  await AsyncStorage.setItem(getManualAccessKey(uid), confirmed ? "true" : "false");
};

const normalizePendingImport = (
  item: Partial<PendingNotificationImport>,
): PendingNotificationImport | null => {
  if (!item || typeof item !== "object") return null;

  const compactText = (value: unknown, maxLength = PENDING_TEXT_MAX_LENGTH) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return undefined;
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  };

  const id = String(item.id ?? item.dedupeKey ?? "").trim();
  const dedupeKey = String(item.dedupeKey ?? id).trim();
  const sourceApp = compactText(item.sourceApp, PENDING_META_MAX_LENGTH) ?? "";
  const sourceLabel =
    compactText(item.sourceLabel, PENDING_META_MAX_LENGTH) ??
    (sourceApp || "Notification");
  const type = item.type === "income" ? "income" : item.type === "expense" ? "expense" : null;
  const amount = Number(item.amount ?? 0);
  const walletId = String(item.walletId ?? "").trim();

  if (!id || !dedupeKey || !type || !amount || amount <= 0 || !walletId) {
    return null;
  }

  return {
    id,
    createdAt: String(item.createdAt ?? new Date().toISOString()),
    dedupeKey,
    sourceApp,
    sourceLabel,
    sourceKey: item.sourceKey,
    title: compactText(item.title, PENDING_META_MAX_LENGTH),
    text: compactText(item.text),
    bigText: compactText(item.bigText),
    type,
    amount,
    category: compactText(item.category, PENDING_META_MAX_LENGTH),
    description: compactText(item.description),
    walletId,
    notificationTime: String(item.notificationTime ?? new Date().toISOString()),
  };
};

export type PendingNotificationImportSummary = {
  totalCount: number;
  items: PendingNotificationImport[];
};

export const loadPendingNotificationImportSummary = async (
  uid: string,
  limit = 50,
): Promise<PendingNotificationImportSummary> => {
  try {
    const raw = await AsyncStorage.getItem(getPendingStorageKey(uid));
    if (!raw) return { totalCount: 0, items: [] };
    if (raw.length > PENDING_RAW_MAX_LENGTH) {
      await writePendingNotificationImports(uid, []);
      return { totalCount: 0, items: [] };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { totalCount: 0, items: [] };

    const normalized = parsed
      .map((item) => normalizePendingImport(item))
      .filter((item): item is PendingNotificationImport => Boolean(item))
      .slice(-PENDING_MAX_ITEMS);

    try {
      await writePendingNotificationImports(uid, normalized);
    } catch {
      // Keep the review screen usable even if compacting old storage fails.
    }

    return {
      totalCount: normalized.length,
      items: normalized
        .slice(-Math.max(1, Math.min(limit, PENDING_MAX_ITEMS)))
        .reverse(),
    };
  } catch {
    return { totalCount: 0, items: [] };
  }
};

export const loadPendingNotificationImports = async (
  uid: string,
  limit = 50,
): Promise<PendingNotificationImport[]> => {
  const summary = await loadPendingNotificationImportSummary(uid, limit);
  return summary.items;
};

const writePendingNotificationImports = async (
  uid: string,
  items: PendingNotificationImport[],
): Promise<void> => {
  await AsyncStorage.setItem(
    getPendingStorageKey(uid),
    JSON.stringify(items.slice(-PENDING_MAX_ITEMS)),
  );
};

export const appendPendingNotificationImport = async (
  uid: string,
  item: PendingNotificationImport,
): Promise<void> => {
  const normalized = normalizePendingImport(item);
  if (!normalized) return;

  const current = (await loadPendingNotificationImports(uid, PENDING_MAX_ITEMS)).reverse();
  const next = [
    ...current.filter((existing) => existing.dedupeKey !== normalized.dedupeKey),
    normalized,
  ];

  await writePendingNotificationImports(uid, next);
};

export const removePendingNotificationImport = async (
  uid: string,
  id: string,
): Promise<PendingNotificationImport | null> => {
  const current = (await loadPendingNotificationImports(uid, PENDING_MAX_ITEMS)).reverse();
  const removed = current.find((item) => item.id === id) ?? null;
  await writePendingNotificationImports(
    uid,
    current.filter((item) => item.id !== id),
  );
  return removed;
};

export const fetchVisibleWallets = async (uid: string): Promise<WalletType[]> => {
  const walletQuery = query(
    collection(firestore, "wallets"),
    where("uid", "==", uid),
  );

  const snapshot = await getDocs(walletQuery);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as WalletType) }))
    .filter((wallet) => !wallet.hidden && !wallet.isSystem);
};
