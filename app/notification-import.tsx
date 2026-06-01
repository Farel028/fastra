import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import SheetModal from "@/components/SheetModal";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import {
  NOTIFICATION_SOURCE_RULES,
  SourceAppKey,
  getNotificationListenerStatus,
  loadNotificationImportConfig,
  NotificationImportStatus,
  requestNotificationListenerPermission,
  saveNotificationImportConfig,
} from "@/services/notificationImportService";
import { filterVisibleWallets } from "@/services/walletService";
import { WalletType } from "@/types";
import { verticalScale } from "@/utils/styling";
import { useRouter } from "expo-router";
import { orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";

const statusLabel: Record<NotificationImportStatus, string> = {
  authorized: "Allowed",
  denied: "Denied",
  unknown: "Unknown",
  unavailable: "Unavailable",
};

const statusColor: Record<NotificationImportStatus, string> = {
  authorized: "#22C55E",
  denied: "#EF4444",
  unknown: "#F59E0B",
  unavailable: colors.neutral400,
};

const NotificationImport = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [fallbackWalletId, setFallbackWalletId] = useState("");
  const [sourceWalletMappings, setSourceWalletMappings] = useState<
    Partial<Record<SourceAppKey, string>>
  >({});
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationImportStatus>("unknown");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [mappingTarget, setMappingTarget] = useState<SourceAppKey | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user?.uid) {
        if (mounted) {
          setEnabled(true);
          setFallbackWalletId("");
          setSourceWalletMappings({});
          setPermissionStatus("unknown");
          setLoadingConfig(false);
        }
        return;
      }

      setLoadingConfig(true);
      const [config, status] = await Promise.all([
        loadNotificationImportConfig(user.uid),
        getNotificationListenerStatus(),
      ]);

      if (!mounted) return;

      setEnabled(config.enabled);
      setFallbackWalletId(config.fallbackWalletId ?? "");
      setSourceWalletMappings(config.sourceWalletMappings ?? {});
      setPermissionStatus(status);
      setLoadingConfig(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const walletConstraints = useMemo(
    () =>
      user?.uid
        ? [where("uid", "==", user.uid), orderBy("created", "desc")]
        : [],
    [user?.uid],
  );

  const { data: walletsRaw } = useFetchData<WalletType>(
    user?.uid ? "wallets" : "",
    walletConstraints,
  );

  const wallets = useMemo(
    () => filterVisibleWallets(walletsRaw ?? []),
    [walletsRaw],
  );

  const walletNameById = useMemo(() => {
    const map = new Map<string, string>();
    wallets.forEach((wallet) => {
      const id = String(wallet.id ?? "");
      if (id) map.set(id, wallet.name);
    });
    return map;
  }, [wallets]);

  const openWalletPicker = (sourceKey: SourceAppKey) => {
    setMappingTarget(sourceKey);
    setWalletPickerVisible(true);
  };

  const setSourceWallet = (sourceKey: SourceAppKey, walletId: string) => {
    setSourceWalletMappings((prev) => ({
      ...prev,
      [sourceKey]: walletId,
    }));
  };

  const formatWalletMeta = (wallet: WalletType) => {
    const meta: string[] = [];
    if (wallet.hidden) meta.push("Hidden");
    if (wallet.isSystem) meta.push("System");
    meta.push("Visible wallet");
    return meta.join(" · ");
  };

  const save = async () => {
    if (!user?.uid) {
      Alert.alert("Notification Import", "Please login first.");
      return;
    }

    setSaving(true);
    try {
      await saveNotificationImportConfig(user.uid, {
        enabled,
        fallbackWalletId: fallbackWalletId || null,
        sourceWalletMappings,
      });
      Alert.alert("Notification Import", "Settings saved.");
    } catch (error: any) {
      Alert.alert("Notification Import", error?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const requestPermission = async () => {
    const opened = await requestNotificationListenerPermission();
    if (!opened) {
      Alert.alert(
        "Notification Access",
        "Android notification listener is not available in this build yet.",
      );
      return;
    }

    const nextStatus = await getNotificationListenerStatus();
    setPermissionStatus(nextStatus);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Notification Import"
          leftIcon={<BackButton />}
          style={{ marginVertical: spacingY._10 }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icons.BellIcon
                size={verticalScale(26)}
                color={colors.black}
                weight="fill"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Typo size={18} fontWeight={"900"}>
                Auto import from bank and e-wallet notifications
              </Typo>
              <Typo size={13} color={colors.neutral400}>
                When a notification contains transaction text, Fastra can parse
                it and create a transaction automatically.
              </Typo>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Typo fontWeight={"800"}>Enable auto import</Typo>
                <Typo size={12} color={colors.neutral400}>
                  Turn this on to allow parsed notifications to be saved.
                </Typo>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.neutral700, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Typo fontWeight={"800"}>Android permission</Typo>
                <Typo size={12} color={colors.neutral400}>
                  Status:{" "}
                  <Typo
                    size={12}
                    fontWeight={"800"}
                    color={statusColor[permissionStatus]}
                  >
                    {statusLabel[permissionStatus]}
                  </Typo>
                </Typo>
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.permissionBtn}
                onPress={requestPermission}
              >
                <Typo fontWeight={"900"} color={colors.black}>
                  Grant access
                </Typo>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Typo fontWeight={"900"} size={16}>
              Wallet mapping by source
            </Typo>
            <Typo size={12} color={colors.neutral400}>
              Pick one wallet for each bank or e-wallet source. This overrides
              the fallback wallet when available.
            </Typo>

            <View style={{ marginTop: spacingY._12, gap: spacingY._10 }}>
              {NOTIFICATION_SOURCE_RULES.map((source) => {
                const mappedId = sourceWalletMappings[source.key] ?? "";
                const mappedName = mappedId
                  ? walletNameById.get(mappedId) ?? "Unknown wallet"
                  : "Auto match";

                return (
                  <TouchableOpacity
                    key={source.key}
                    activeOpacity={0.88}
                    style={styles.mappingRow}
                    onPress={() => openWalletPicker(source.key)}
                  >
                    <View style={{ flex: 1 }}>
                      <Typo fontWeight={"800"}>{source.label}</Typo>
                      <Typo size={12} color={colors.neutral400}>
                        {mappedName}
                      </Typo>
                    </View>
                    <Icons.CaretRightIcon
                      size={verticalScale(18)}
                      color={colors.neutral300}
                      weight="bold"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Typo fontWeight={"900"} size={16}>
              Fallback wallet
            </Typo>
            <Typo size={12} color={colors.neutral400}>
              If source mapping and auto matching fail, this wallet will be used.
            </Typo>

            <View style={{ marginTop: spacingY._12, gap: spacingY._10 }}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={[
                  styles.walletItem,
                  fallbackWalletId === "" && styles.walletItemActive,
                ]}
                onPress={() => setFallbackWalletId("")}
              >
                <View style={{ flex: 1 }}>
                  <Typo fontWeight={"800"}>Auto match only</Typo>
                  <Typo size={12} color={colors.neutral400}>
                    No fallback wallet will be used.
                  </Typo>
                </View>
              </TouchableOpacity>

              {wallets.map((wallet) => {
                const id = String(wallet.id ?? "");
                const active = fallbackWalletId === id;
                return (
                  <TouchableOpacity
                    key={id}
                    activeOpacity={0.88}
                    style={[
                      styles.walletItem,
                      active && styles.walletItemActive,
                    ]}
                    onPress={() => setFallbackWalletId(id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Typo fontWeight={"800"} numberOfLines={1}>
                        {wallet.name}
                      </Typo>
                      <Typo size={12} color={colors.neutral400}>
                        {wallet.hidden ? "Hidden" : "Visible wallet"}
                      </Typo>
                    </View>
                    {active ? (
                      <Icons.CheckCircleIcon
                        size={verticalScale(20)}
                        color={colors.primary}
                        weight="fill"
                      />
                    ) : (
                      <Icons.CircleIcon
                        size={verticalScale(20)}
                        color={colors.neutral500}
                        weight="regular"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}

              {!loadingConfig && wallets.length === 0 && (
                <View style={styles.emptyState}>
                  <Typo color={colors.neutral400}>
                    No visible wallets found yet.
                  </Typo>
                </View>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Typo fontWeight={"900"} size={16}>
              How it works
            </Typo>
            <View style={styles.bulletList}>
              <Typo color={colors.neutral300}>
                1. Android listens for notifications after you grant access.
              </Typo>
              <Typo color={colors.neutral300}>
                2. Fastra reads transaction words like transfer, debit, credit,
                or payment.
              </Typo>
              <Typo color={colors.neutral300}>
                3. Matching text becomes a new transaction automatically.
              </Typo>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={save}
            disabled={saving}
          >
            <Typo fontWeight={"900"} color={colors.black}>
              {saving ? "Saving..." : "Save settings"}
            </Typo>
          </TouchableOpacity>

          <Pressable onPress={() => router.back()}>
            <Typo color={colors.neutral400} style={{ textAlign: "center" }}>
              Back to settings
            </Typo>
          </Pressable>
        </ScrollView>

        <SheetModal
          visible={walletPickerVisible}
          title={
            mappingTarget
              ? `Map ${NOTIFICATION_SOURCE_RULES.find((item) => item.key === mappingTarget)?.label ?? "Source"}`
              : "Map Source"
          }
          onClose={() => {
            setWalletPickerVisible(false);
            setMappingTarget(null);
          }}
        >
          <ScrollView style={{ maxHeight: verticalScale(360) }}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.walletRow,
                mappingTarget && !sourceWalletMappings[mappingTarget]
                  ? styles.walletRowActive
                  : undefined,
              ]}
              onPress={() => {
                if (!mappingTarget) return;
                setSourceWallet(mappingTarget, "");
                setWalletPickerVisible(false);
                setMappingTarget(null);
              }}
            >
              <View style={{ flex: 1 }}>
                <Typo fontWeight={"800"}>Auto match</Typo>
                <Typo size={12} color={colors.neutral400}>
                  Let parser choose wallet from the source and fallback rules.
                </Typo>
              </View>
            </TouchableOpacity>

            {wallets.map((wallet) => {
              const id = String(wallet.id ?? "");
              const active =
                mappingTarget ? sourceWalletMappings[mappingTarget] === id : false;

              return (
                <TouchableOpacity
                  key={id}
                  activeOpacity={0.88}
                  style={[styles.walletRow, active && styles.walletRowActive]}
                  onPress={() => {
                    if (!mappingTarget) return;
                    setSourceWallet(mappingTarget, id);
                    setWalletPickerVisible(false);
                    setMappingTarget(null);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Typo fontWeight={"800"} numberOfLines={1}>
                      {wallet.name}
                    </Typo>
                    <Typo size={12} color={colors.neutral400}>
                      {formatWalletMeta(wallet)}
                    </Typo>
                  </View>
                  {active ? (
                    <Icons.CheckCircleIcon
                      size={verticalScale(20)}
                      color={colors.primary}
                      weight="fill"
                    />
                  ) : (
                    <Icons.CircleIcon
                      size={verticalScale(20)}
                      color={colors.neutral500}
                      weight="regular"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SheetModal>
      </View>
    </ScreenWrapper>
  );
};

export default NotificationImport;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  content: {
    gap: spacingY._12,
    paddingBottom: spacingY._30,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    padding: spacingY._15,
    backgroundColor: colors.neutral900,
  },
  heroIcon: {
    width: verticalScale(48),
    height: verticalScale(48),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    padding: spacingY._15,
    backgroundColor: colors.neutral900,
    gap: spacingY._10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral800,
  },
  permissionBtn: {
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._10,
    borderRadius: radius._12,
    backgroundColor: colors.primary,
  },
  walletItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._12,
  },
  walletItemActive: {
    borderColor: colors.primary,
    backgroundColor: "#102015",
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._12,
    marginBottom: spacingY._10,
  },
  walletRowActive: {
    borderColor: colors.primary,
    backgroundColor: "#102015",
  },
  mappingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._12,
  },
  emptyState: {
    paddingVertical: spacingY._12,
  },
  bulletList: {
    gap: spacingY._7,
  },
  saveBtn: {
    height: verticalScale(50),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
});
