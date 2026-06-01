import {
  parseRawNotification,
  resolveTransaction
} from "@/services/notificationImportParser";
import { SourceAppKey } from "@/services/notificationImportRules";
import { NOTIFICATION_IMPORT_DEBUG_ENABLED } from "@/services/notificationImportRuntimeState";
import {
  appendNotificationImportDebugEvent,
  fetchVisibleWallets,
  getActiveNotificationImportUid,
  hasSeenKey,
  loadNotificationImportConfig,
  markSeenKey,
} from "@/services/notificationImportStorage";
import { createOrUpdateTransaction } from "@/services/transactionService";
import { devError, devLog, devWarn } from "@/utils/devLogger";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import {
  getPermissionStatus,
  requestPermission,
  RNAndroidNotificationListenerHeadlessJsName,
} from "react-native-android-notification-listener";

type ImportResult = { success: boolean; msg?: string };

const normalizeWhitespace = (value?: unknown): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeText = (value?: unknown): string =>
  normalizeWhitespace(value).toLowerCase();

const logImportDebug = (
  stage: string,
  message: string,
  data?: unknown,
  level: "info" | "warn" | "error" = "info",
): void => {
  if (!NOTIFICATION_IMPORT_DEBUG_ENABLED) return;

  const prefix = `[notif-import][${stage}]`;
  if (level === "error") {
    devError(prefix, message, data ?? "");
    return;
  }

  if (level === "warn") {
    devWarn(prefix, message, data ?? "");
    return;
  }

  devLog(prefix, message, data ?? "");
};

export const getNotificationListenerStatus = async (): Promise<
  "authorized" | "denied" | "unknown" | "unavailable"
> => {
  if (Platform.OS !== "android") return "unavailable";

  const status = await getPermissionStatus();
  logImportDebug("permission", "Current notification listener status", {
    status,
  });
  if (status === "authorized" || status === "denied" || status === "unknown") {
    return status;
  }

  return "unknown";
};

export const requestNotificationListenerPermission =
  async (): Promise<boolean> => {
    if (Platform.OS !== "android") return false;

    logImportDebug("permission", "Opening notification access settings");

    try {
      await Linking.sendIntent(
        "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS",
      );
      return true;
    } catch (error) {
      logImportDebug(
        "permission",
        "Expo intent launcher failed, falling back to native requestPermission",
        error,
        "warn",
      );
    }

    try {
      requestPermission();
      return true;
    } catch (error) {
      logImportDebug(
        "permission",
        "Failed to open notification access settings",
        error,
        "error",
      );
      return false;
    }
  };

const fetchWallets = async (uid: string) => {
  const wallets = await fetchVisibleWallets(uid);
  return wallets;
};

const resolveWalletId = async (
  uid: string,
  sourceKey: SourceAppKey | null,
  sourceLabel: string,
  sourceHint: string,
  fallbackWalletId: string | null,
): Promise<string | null> => {
  const wallets = await fetchWallets(uid);
  if (!wallets.length) return fallbackWalletId;

  const normalizedLabel = normalizeText(sourceLabel);
  const normalizedHint = normalizeText(sourceHint);

  const config = await loadNotificationImportConfig(uid);
  const mappedWalletId =
    sourceKey && config.sourceWalletMappings?.[sourceKey]
      ? String(config.sourceWalletMappings[sourceKey])
      : "";

  if (mappedWalletId) {
    const mappedWallet = wallets.find(
      (wallet) => String(wallet.id) === mappedWalletId,
    );
    if (mappedWallet) return String(mappedWallet.id);
  }

  if (fallbackWalletId) {
    const fallback = wallets.find(
      (wallet) => String(wallet.id) === fallbackWalletId,
    );
    if (fallback) return String(fallback.id);
  }

  const brandMatch = wallets.find((wallet) => {
    const walletName = normalizeText(wallet.name);
    return (
      Boolean(normalizedLabel && walletName.includes(normalizedLabel)) ||
      Boolean(normalizedHint && walletName.includes(normalizedHint))
    );
  });

  if (brandMatch?.id) return String(brandMatch.id);

  if (wallets.length === 1) return String(wallets[0].id ?? "");

  return String(wallets[0].id ?? "") || null;
};

export const processNativeNotificationImport = async (
  rawNotification: string | Record<string, unknown>,
): Promise<ImportResult> => {
  const uid = await getActiveNotificationImportUid();
  if (!uid) {
    return { success: false, msg: "No active user for auto import" };
  }

  const config = await loadNotificationImportConfig(uid);
  if (!config.enabled) {
    return { success: false, msg: "Auto import disabled" };
  }

  logImportDebug("received", "Notification payload received", rawNotification);
  await appendNotificationImportDebugEvent(uid, {
    level: "info",
    stage: "received",
    message: "Notification listener received payload",
    data:
      typeof rawNotification === "string" ? rawNotification : rawNotification,
  });

  const payload = parseRawNotification(rawNotification);
  if (!payload) {
    logImportDebug(
      "parse",
      "Payload could not be parsed as JSON object",
      rawNotification,
      "warn",
    );
    await appendNotificationImportDebugEvent(uid, {
      level: "warn",
      stage: "parse",
      message: "Payload could not be parsed as JSON object",
      data: rawNotification,
    });
    return { success: false, msg: "Invalid notification payload" };
  }

  const resolved = resolveTransaction(payload);
  if (!resolved.shouldImport || !resolved.type || !resolved.amount) {
    logImportDebug(
      "resolve",
      resolved.reason ?? "Notification ignored",
      payload,
      "warn",
    );
    await appendNotificationImportDebugEvent(uid, {
      level: "warn",
      stage: "resolve",
      message: resolved.reason ?? "Notification ignored",
      data: {
        app: payload.app,
        title: payload.title,
        text: payload.text,
        bigText: payload.bigText,
      },
    });
    return { success: false, msg: resolved.reason ?? "Not a transaction" };
  }

  const dedupeKey = resolved.dedupeKey ?? "";
  if (!dedupeKey) {
    logImportDebug("dedupe", "Missing dedupe key", payload, "warn");
    await appendNotificationImportDebugEvent(uid, {
      level: "warn",
      stage: "dedupe",
      message: "Missing dedupe key",
    });
    return { success: false, msg: "Missing dedupe key" };
  }

  if (await hasSeenKey(uid, dedupeKey)) {
    logImportDebug("dedupe", "Duplicate notification ignored", { dedupeKey });
    await appendNotificationImportDebugEvent(uid, {
      level: "info",
      stage: "dedupe",
      message: "Duplicate notification ignored",
      data: { dedupeKey },
    });
    return { success: true, msg: "Duplicate notification ignored" };
  }

  const walletId = await resolveWalletId(
    uid,
    resolved.sourceKey ?? null,
    resolved.sourceLabel ?? resolved.sourceApp ?? "",
    resolved.sourceApp ?? "",
    config.fallbackWalletId,
  );

  if (!walletId) {
    logImportDebug(
      "wallet",
      "No wallet matched for auto import",
      {
        sourceKey: resolved.sourceKey,
        sourceApp: resolved.sourceApp,
        sourceLabel: resolved.sourceLabel,
        fallbackWalletId: config.fallbackWalletId,
        mappings: config.sourceWalletMappings,
      },
      "error",
    );
    await appendNotificationImportDebugEvent(uid, {
      level: "error",
      stage: "wallet",
      message: "No wallet matched for auto import",
      data: {
        sourceKey: resolved.sourceKey,
        sourceApp: resolved.sourceApp,
        sourceLabel: resolved.sourceLabel,
        fallbackWalletId: config.fallbackWalletId,
        mappings: config.sourceWalletMappings,
      },
    });
    return { success: false, msg: "No wallet matched for auto import" };
  }

  await appendNotificationImportDebugEvent(uid, {
    level: "info",
    stage: "resolved",
    message: "Transaction resolved and ready to save",
    data: {
      sourceKey: resolved.sourceKey,
      sourceApp: resolved.sourceApp,
      sourceLabel: resolved.sourceLabel,
      type: resolved.type,
      amount: resolved.amount,
      category: resolved.category,
      walletId,
      dedupeKey,
    },
  });

  const result = await createOrUpdateTransaction({
    uid,
    type: resolved.type,
    amount: resolved.amount,
    category: resolved.category,
    date: resolved.notificationTime ?? new Date(),
    description: resolved.description,
    walletId,
    autoImported: true,
    autoImportSource: resolved.sourceApp,
    autoImportSourceLabel: resolved.sourceLabel,
    autoImportDedupeKey: dedupeKey,
  } as any);

  if (!result.success) {
    logImportDebug(
      "save",
      result.msg ?? "Failed to save transaction",
      {
        walletId,
        type: resolved.type,
        amount: resolved.amount,
      },
      "error",
    );
    await appendNotificationImportDebugEvent(uid, {
      level: "error",
      stage: "save",
      message: result.msg ?? "Failed to save transaction",
      data: {
        walletId,
        type: resolved.type,
        amount: resolved.amount,
      },
    });
    return result;
  }

  await markSeenKey(uid, dedupeKey);
  logImportDebug("saved", "Transaction saved successfully", {
    walletId,
    type: resolved.type,
    amount: resolved.amount,
    dedupeKey,
  });
  await appendNotificationImportDebugEvent(uid, {
    level: "info",
    stage: "saved",
    message: "Transaction saved successfully",
    data: {
      walletId,
      type: resolved.type,
      amount: resolved.amount,
      dedupeKey,
    },
  });
  return { success: true, msg: "Auto imported transaction" };
};

export const registerAndroidNotificationHeadlessTask = (
  AppRegistry: any,
): void => {
  if (Platform.OS !== "android") return;

  logImportDebug("startup", "Registering Android headless notification task");
  AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () =>
      async ({
        notification,
      }: {
        notification: string | Record<string, unknown>;
      }) => {
        logImportDebug("headless", "Headless task invoked");
        await processNativeNotificationImport(notification);
      },
  );
};
