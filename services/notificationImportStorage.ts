import AsyncStorage from "@react-native-async-storage/async-storage";
import { firestore } from "@/config/firebase";
import { WalletType } from "@/types";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  NotificationImportConfig,
  NotificationImportDebugEvent,
  NOTIFICATION_SOURCE_RULES,
} from "@/services/notificationImportRules";
import { NOTIFICATION_IMPORT_DEBUG_ENABLED } from "@/services/notificationImportRuntimeState";

const STORAGE_PREFIX = "entrack:notification-import";
const ACTIVE_UID_KEY = `${STORAGE_PREFIX}:active-uid`;
const CONFIG_KEY = `${STORAGE_PREFIX}:config`;
const SEEN_KEY_PREFIX = `${STORAGE_PREFIX}:seen`;
const DEBUG_KEY_PREFIX = `${STORAGE_PREFIX}:debug`;
const MANUAL_ACCESS_KEY_PREFIX = `${STORAGE_PREFIX}:manual-access`;
const SEEN_MAX_ITEMS = 200;
const SEEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const getSeenStorageKey = (uid: string): string => `${SEEN_KEY_PREFIX}:${uid}`;
const getDebugStorageKey = (uid: string): string => `${DEBUG_KEY_PREFIX}:${uid}`;
const getManualAccessKey = (uid: string): string =>
  `${MANUAL_ACCESS_KEY_PREFIX}:${uid}`;

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

const getNotificationConfig = async (
  uid: string,
): Promise<NotificationImportConfig> => {
  const raw = await AsyncStorage.getItem(`${CONFIG_KEY}:${uid}`);
  if (!raw) {
    return {
      enabled: true,
      fallbackWalletId: null,
      sourceWalletMappings: {},
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationImportConfig>;
    return {
      enabled: parsed.enabled !== false,
      fallbackWalletId:
        typeof parsed.fallbackWalletId === "string" && parsed.fallbackWalletId
          ? parsed.fallbackWalletId
          : null,
      sourceWalletMappings:
        parsed.sourceWalletMappings && typeof parsed.sourceWalletMappings === "object"
          ? Object.fromEntries(
              Object.entries(parsed.sourceWalletMappings).filter(
                ([key, value]) =>
                  NOTIFICATION_SOURCE_RULES.some((rule) => rule.key === key) &&
                  typeof value === "string" &&
                  value.length > 0,
              ),
            )
          : {},
    };
  } catch {
    return {
      enabled: true,
      fallbackWalletId: null,
      sourceWalletMappings: {},
    };
  }
};

export const saveNotificationImportConfig = async (
  uid: string,
  config: NotificationImportConfig,
): Promise<void> => {
  await AsyncStorage.setItem(
    `${CONFIG_KEY}:${uid}`,
    JSON.stringify({
      ...config,
      sourceWalletMappings: config.sourceWalletMappings ?? {},
    }),
  );
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
