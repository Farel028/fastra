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
  NotificationImportStatus,
  PendingNotificationImport,
  SourceAppKey,
  SourceRule,
  getNotificationListenerStatus,
  loadNotificationImportConfig,
  loadPendingNotificationImports,
  requestNotificationListenerPermission,
  saveNotificationImportConfig,
} from "@/services/notificationImportService";
import { filterVisibleWallets } from "@/services/walletService";
import { WalletType } from "@/types";
import { verticalScale } from "@/utils/styling";
import { Image } from "expo-image";
import { orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
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

const LOGO_DEV_PUBLIC_KEY = "pk_F2FvW5A7T-O4VDTvIMGxLQ";
const getLogoDevUrl = (domain: string) =>
  `https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=128&format=png`;

const normalizeSource = (source: string) =>
  source.trim().replace(/\s+/g, " ").toLowerCase();

const normalizeBlockedSources = (sources: string[] = []) =>
  Array.from(
    new Set(
      sources.map((source) => normalizeSource(String(source ?? ""))).filter(Boolean),
    ),
  );

type SourcePreset = {
  id: string;
  label: string;
  domain: string;
  category: "bank" | "ewallet";
};

type SourceOption = SourcePreset & {
  key: SourceAppKey;
  image: string;
  rule: SourceRule;
};

const SOURCE_PRESETS: SourcePreset[] = [
  { id: "bca", label: "BCA", domain: "bca.co.id", category: "bank" },
  { id: "bri", label: "BRI", domain: "bri.co.id", category: "bank" },
  {
    id: "mandiri",
    label: "Mandiri",
    domain: "bankmandiri.co.id",
    category: "bank",
  },
  { id: "bni", label: "BNI", domain: "bni.co.id", category: "bank" },
  { id: "btn", label: "BTN", domain: "btn.co.id", category: "bank" },
  { id: "bsi", label: "BSI", domain: "bankbsi.co.id", category: "bank" },
  {
    id: "cimb",
    label: "CIMB Niaga",
    domain: "cimbniaga.co.id",
    category: "bank",
  },
  {
    id: "danamon",
    label: "Danamon",
    domain: "danamon.co.id",
    category: "bank",
  },
  {
    id: "permata",
    label: "PermataBank",
    domain: "permatabank.com",
    category: "bank",
  },
  {
    id: "maybank",
    label: "Maybank",
    domain: "maybank.co.id",
    category: "bank",
  },
  { id: "ocbc", label: "OCBC", domain: "ocbc.id", category: "bank" },
  { id: "uob", label: "UOB", domain: "uob.co.id", category: "bank" },
  { id: "hsbc", label: "HSBC", domain: "hsbc.co.id", category: "bank" },
  { id: "dbs", label: "DBS", domain: "dbs.id", category: "bank" },
  { id: "panin", label: "Panin", domain: "panin.co.id", category: "bank" },
  { id: "mega", label: "Bank Mega", domain: "bankmega.com", category: "bank" },
  {
    id: "muamalat",
    label: "Muamalat",
    domain: "bankmuamalat.co.id",
    category: "bank",
  },
  { id: "jago", label: "Bank Jago", domain: "jago.com", category: "bank" },
  { id: "jenius", label: "Jenius", domain: "jenius.com", category: "bank" },
  {
    id: "seabank",
    label: "SeaBank",
    domain: "seabank.co.id",
    category: "bank",
  },
  { id: "neo", label: "Bank Neo", domain: "neobank.id", category: "bank" },
  {
    id: "allobank",
    label: "Allo Bank",
    domain: "allobank.com",
    category: "bank",
  },
  { id: "blu", label: "blu", domain: "bcadigital.co.id", category: "bank" },
  {
    id: "linebank",
    label: "LINE Bank",
    domain: "linebank.co.id",
    category: "bank",
  },
  { id: "gopay", label: "GoPay", domain: "gopay.co.id", category: "ewallet" },
  { id: "ovo", label: "OVO", domain: "ovo.id", category: "ewallet" },
  { id: "dana", label: "DANA", domain: "dana.id", category: "ewallet" },
  {
    id: "shopeepay",
    label: "ShopeePay",
    domain: "shopee.co.id",
    category: "ewallet",
  },
  {
    id: "linkaja",
    label: "LinkAja",
    domain: "linkaja.id",
    category: "ewallet",
  },
  {
    id: "astrapay",
    label: "AstraPay",
    domain: "astrapay.com",
    category: "ewallet",
  },
  { id: "doku", label: "DOKU", domain: "doku.com", category: "ewallet" },
];

const SOURCE_OPTIONS: SourceOption[] = SOURCE_PRESETS.map((source) => {
  const rule = NOTIFICATION_SOURCE_RULES.find((item) => item.key === source.id);
  if (!rule) {
    throw new Error(`Missing notification source rule for ${source.id}`);
  }

  return {
    ...source,
    key: rule.key,
    image: getLogoDevUrl(source.domain),
    rule,
  };
});

const SOURCE_RULES = SOURCE_OPTIONS.map((item) => item.rule);

const SOURCE_GROUPS = [
  {
    key: "bank",
    title: "Bank",
    options: SOURCE_OPTIONS.filter((item) => item.category === "bank"),
  },
  {
    key: "ewallet",
    title: "E-Wallet",
    options: SOURCE_OPTIONS.filter((item) => item.category === "ewallet"),
  },
];

const getLegacySourceTokens = (source: SourceRule) =>
  [source.key, source.label, ...source.aliases].map(normalizeSource).filter(Boolean);

const getSourceBlockToken = (source: SourceRule) => normalizeSource(source.key);

const NotificationImport = () => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [fallbackWalletId, setFallbackWalletId] = useState("");
  const [sourceWalletMappings, setSourceWalletMappings] = useState<
    Partial<Record<SourceAppKey, string>>
  >({});
  const [blockedSourceApps, setBlockedSourceApps] = useState<string[]>([]);
  const [blockSourceInput, setBlockSourceInput] = useState("");
  const [pendingImports, setPendingImports] = useState<
    PendingNotificationImport[]
  >([]);
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationImportStatus>("unknown");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [sourceRulesVisible, setSourceRulesVisible] = useState(false);
  const [blockSourceVisible, setBlockSourceVisible] = useState(false);
  const [mappingTarget, setMappingTarget] = useState<SourceAppKey | null>(null);

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

  const mappedCount = SOURCE_RULES.filter(
    (rule) => sourceWalletMappings[rule.key],
  ).length;
  const blockedCount = blockedSourceApps.length;
  const fallbackWalletName = fallbackWalletId
    ? (walletNameById.get(fallbackWalletId) ?? "Unknown wallet")
    : "Auto match only";

  const pendingSourceSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          pendingImports
            .flatMap((item) => [item.sourceApp, item.sourceLabel])
            .map((item) => normalizeSource(item ?? ""))
            .filter(Boolean),
        ),
      ).filter((source) => !blockedSourceApps.includes(source)),
    [blockedSourceApps, pendingImports],
  );

  const persistConfig = useCallback(
    async (next?: {
      enabled?: boolean;
      fallbackWalletId?: string;
      sourceWalletMappings?: Partial<Record<SourceAppKey, string>>;
      blockedSourceApps?: string[];
    }) => {
      if (!user?.uid) return;

      try {
        const current = await loadNotificationImportConfig(user.uid);
        await saveNotificationImportConfig(user.uid, {
          enabled: next?.enabled ?? current.enabled,
          fallbackWalletId: (next?.fallbackWalletId ?? current.fallbackWalletId) || null,
          sourceWalletMappings:
            next?.sourceWalletMappings ?? current.sourceWalletMappings ?? {},
          blockedSourceApps: normalizeBlockedSources(
            next?.blockedSourceApps ?? current.blockedSourceApps ?? [],
          ),
        });
      } catch (error: any) {
        Alert.alert("Notification Import", error?.message || "Failed to save.");
      }
    },
    [user?.uid],
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user?.uid) {
        if (mounted) {
          setEnabled(true);
          setFallbackWalletId("");
          setSourceWalletMappings({});
          setBlockedSourceApps([]);
          setPendingImports([]);
          setPermissionStatus("unknown");
          setLoadingConfig(false);
        }
        return;
      }

      setLoadingConfig(true);
      try {
        const config = await loadNotificationImportConfig(user.uid);

        if (!mounted) return;

        setEnabled(config.enabled);
        setFallbackWalletId(config.fallbackWalletId ?? "");
        setSourceWalletMappings(config.sourceWalletMappings ?? {});
        setBlockedSourceApps(normalizeBlockedSources(config.blockedSourceApps ?? []));
      } catch (error: any) {
        if (mounted) {
          Alert.alert(
            "Notification Import",
            error?.message || "Failed to load notification import config.",
          );
        }
      }

      const [status, pending] = await Promise.all([
        getNotificationListenerStatus().catch(() => "unknown" as NotificationImportStatus),
        loadPendingNotificationImports(user.uid, 30).catch(() => []),
      ]);

      if (!mounted) return;

      setPendingImports(pending);
      setPermissionStatus(status);
      setLoadingConfig(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const setEnabledAndSave = (value: boolean) => {
    setEnabled(value);
    void persistConfig({ enabled: value });
  };

  const setFallbackWalletAndSave = (walletId: string) => {
    setFallbackWalletId(walletId);
    void persistConfig({ fallbackWalletId: walletId });
  };

  const setSourceWallet = (sourceKey: SourceAppKey, walletId: string) => {
    setSourceWalletMappings((prev) => {
      const next = { ...prev };
      if (walletId) next[sourceKey] = walletId;
      else delete next[sourceKey];
      void persistConfig({ sourceWalletMappings: next });
      return next;
    });
  };

  const addBlockedSource = (source: string) => {
    const normalized = normalizeSource(source);
    if (!normalized) return;

    setBlockedSourceApps((prev) => {
      const normalizedPrev = normalizeBlockedSources(prev);
      const next = normalizedPrev.includes(normalized)
        ? normalizedPrev
        : [...normalizedPrev, normalized];
      void persistConfig({ blockedSourceApps: next });
      return next;
    });
    setBlockSourceInput("");
  };

  const removeBlockedSource = (source: string) => {
    setBlockedSourceApps((prev) => {
      const normalized = normalizeSource(source);
      const next = normalizeBlockedSources(prev).filter((item) => item !== normalized);
      void persistConfig({ blockedSourceApps: next });
      return next;
    });
  };

  const isRuleBlocked = (source: SourceRule) => {
    const tokens = getLegacySourceTokens(source);
    const blockedSet = new Set(normalizeBlockedSources(blockedSourceApps));
    return tokens.some((token) => blockedSet.has(token));
  };

  const toggleRuleBlock = (source: SourceRule) => {
    const blockToken = getSourceBlockToken(source);
    const cleanupTokens = getLegacySourceTokens(source);
    const blockedSet = new Set(normalizeBlockedSources(blockedSourceApps));
    const blocked = cleanupTokens.some((token) => blockedSet.has(token));

    setBlockedSourceApps((prev) => {
      const normalizedPrev = normalizeBlockedSources(prev);
      const next = blocked
        ? normalizedPrev.filter((item) => !cleanupTokens.includes(item))
        : Array.from(new Set([...normalizedPrev, blockToken]));
      void persistConfig({ blockedSourceApps: next });
      return next;
    });
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

  const renderSourceRow = (source: SourceOption) => {
    const mappedId = sourceWalletMappings[source.key] ?? "";
    const mappedName = mappedId
      ? (walletNameById.get(mappedId) ?? "Unknown wallet")
      : "Auto match";
    const blocked = isRuleBlocked(source.rule);

    return (
      <View
        key={source.key}
        style={[styles.sourceRow, blocked && styles.sourceRowBlocked]}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.sourceRowMain}
          onPress={() => {
            setMappingTarget(source.key);
            setWalletPickerVisible(true);
          }}
        >
          <View style={styles.logoWrap}>
            <Image
              source={source.image}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>

          <View style={styles.sourceText}>
            <View style={styles.sourceTitleRow}>
              <Typo fontWeight={"900"} numberOfLines={1}>
                {source.label}
              </Typo>
              {blocked ? (
                <View style={styles.blockedPill}>
                  <Typo size={10} fontWeight={"900"} color={colors.rose}>
                    BLOCKED
                  </Typo>
                </View>
              ) : null}
            </View>
            <Typo size={12} color={colors.neutral400} numberOfLines={1}>
              {blocked ? "Notifications ignored" : mappedName}
            </Typo>
          </View>

          <Icons.CaretRightIcon
            size={verticalScale(18)}
            color={colors.neutral400}
            weight="bold"
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[styles.sourceBlockBtn, blocked && styles.sourceUnblockBtn]}
          onPress={() => toggleRuleBlock(source.rule)}
        >
          {blocked ? (
            <Icons.CheckIcon
              size={verticalScale(18)}
              color={colors.black}
              weight="bold"
            />
          ) : (
            <Icons.ProhibitIcon
              size={verticalScale(18)}
              color={colors.rose}
              weight="bold"
            />
          )}
        </TouchableOpacity>
      </View>
    );
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
              <Icons.BellRingingIcon
                size={verticalScale(25)}
                color={colors.black}
                weight="fill"
              />
            </View>
            <View style={{ flex: 1, gap: spacingY._5 }}>
              <Typo size={18} fontWeight={"900"}>
                Notification rules
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Auto import stays lean: source rules and block list live in
                sheets.
              </Typo>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: spacingY._5 }}>
                <Typo fontWeight={"900"} size={16}>
                  Import pipeline
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  Parsed notifications go to inbox review first.
                </Typo>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabledAndSave}
                trackColor={{ false: colors.neutral700, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={{ flex: 1, gap: spacingY._5 }}>
                <Typo fontWeight={"800"}>Android permission</Typo>
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.permissionBtn}
                onPress={requestPermission}
              >
                <Typo fontWeight={"900"} color={colors.black}>
                  Grant
                </Typo>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.menuCard}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.menuRow}
              onPress={() => setSourceRulesVisible(true)}
            >
              <View style={styles.menuIcon}>
                <Icons.BankIcon
                  size={verticalScale(21)}
                  color={colors.black}
                  weight="fill"
                />
              </View>
              <View style={{ flex: 1, gap: spacingY._5 }}>
                <Typo fontWeight={"900"}>Source rules</Typo>
                <Typo size={12} color={colors.neutral400}>
                  {mappedCount}/{SOURCE_RULES.length} mapped
                </Typo>
              </View>
              <Icons.CaretRightIcon
                size={verticalScale(18)}
                color={colors.neutral400}
                weight="bold"
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.menuRow}
              onPress={() => setBlockSourceVisible(true)}
            >
              <View style={[styles.menuIcon, styles.blockMenuIcon]}>
                <Icons.ProhibitIcon
                  size={verticalScale(21)}
                  color={colors.rose}
                  weight="bold"
                />
              </View>
              <View style={{ flex: 1, gap: spacingY._5 }}>
                <Typo fontWeight={"900"}>Block source</Typo>
                <Typo size={12} color={colors.neutral400}>
                  {blockedCount
                    ? `${blockedCount} sources blocked`
                    : "No blocked source"}
                </Typo>
              </View>
              <Icons.CaretRightIcon
                size={verticalScale(18)}
                color={colors.neutral400}
                weight="bold"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1, gap: spacingY._5 }}>
                <Typo fontWeight={"900"} size={16}>
                  Fallback wallet
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  Used only when source mapping and auto matching fail.
                </Typo>
              </View>
              <Typo
                size={12}
                fontWeight={"800"}
                color={colors.neutral300}
                numberOfLines={1}
              >
                {fallbackWalletName}
              </Typo>
            </View>

            <View style={{ marginTop: spacingY._12, gap: spacingY._10 }}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={[
                  styles.walletItem,
                  fallbackWalletId === "" && styles.walletItemActive,
                ]}
                onPress={() => setFallbackWalletAndSave("")}
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
                    onPress={() => setFallbackWalletAndSave(id)}
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
        </ScrollView>

        <SheetModal
          visible={sourceRulesVisible}
          title="Source Rules"
          onClose={() => setSourceRulesVisible(false)}
        >
          <ScrollView
            style={{ maxHeight: verticalScale(470) }}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {SOURCE_GROUPS.map((group) => (
              <View key={group.key} style={styles.sourceSection}>
                <Typo
                  size={12}
                  fontWeight={"900"}
                  color={colors.neutral400}
                  style={styles.sourceSectionTitle}
                >
                  {group.title}
                </Typo>
                {group.options.map(renderSourceRow)}
              </View>
            ))}
          </ScrollView>
        </SheetModal>

        <SheetModal
          visible={blockSourceVisible}
          title="Block Source"
          onClose={() => setBlockSourceVisible(false)}
        >
          <ScrollView
            style={{ maxHeight: verticalScale(470) }}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.blockInputRow}>
              <TextInput
                value={blockSourceInput}
                onChangeText={setBlockSourceInput}
                placeholder="com.whatsapp or Shopee"
                placeholderTextColor={colors.neutral500}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.blockInput}
              />
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.addBlockBtn}
                onPress={() => addBlockedSource(blockSourceInput)}
              >
                <Icons.PlusIcon
                  size={verticalScale(18)}
                  color={colors.black}
                  weight="bold"
                />
              </TouchableOpacity>
            </View>

            {pendingSourceSuggestions.length > 0 ? (
              <View style={styles.suggestionBlock}>
                <Typo size={12} fontWeight={"800"} color={colors.neutral300}>
                  From inbox
                </Typo>
                <View style={styles.suggestionWrap}>
                  {pendingSourceSuggestions.map((source) => (
                    <TouchableOpacity
                      key={source}
                      activeOpacity={0.88}
                      style={styles.sourceSuggestion}
                      onPress={() => addBlockedSource(source)}
                    >
                      <Icons.PlusCircleIcon
                        size={verticalScale(14)}
                        color={colors.primary}
                        weight="fill"
                      />
                      <Typo
                        size={12}
                        fontWeight={"800"}
                        color={colors.neutral200}
                      >
                        {source}
                      </Typo>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {blockedSourceApps.length > 0 ? (
              <View style={styles.blockedList}>
                {blockedSourceApps.map((source) => (
                  <View key={source} style={styles.blockedItem}>
                    <View style={styles.blockedIcon}>
                      <Icons.ProhibitIcon
                        size={verticalScale(18)}
                        color={colors.rose}
                        weight="bold"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Typo fontWeight={"900"}>{source}</Typo>
                      <Typo size={12} color={colors.neutral400}>
                        Ignored before inbox review.
                      </Typo>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={styles.removeBlockBtn}
                      onPress={() => removeBlockedSource(source)}
                    >
                      <Icons.XCircleIcon
                        size={verticalScale(22)}
                        color={colors.rose}
                        weight="fill"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Icons.ShieldCheckIcon
                  size={verticalScale(24)}
                  color={colors.neutral500}
                  weight="fill"
                />
                <Typo color={colors.neutral400} style={{ textAlign: "center" }}>
                  Belum ada source yang diblokir.
                </Typo>
              </View>
            )}
          </ScrollView>
        </SheetModal>

        <SheetModal
          visible={walletPickerVisible}
          title="Map Wallet"
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
                  Use source hints and fallback wallet.
                </Typo>
              </View>
            </TouchableOpacity>

            {wallets.map((wallet) => {
              const id = String(wallet.id ?? "");
              const active = mappingTarget
                ? sourceWalletMappings[mappingTarget] === id
                : false;

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
  menuCard: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    backgroundColor: colors.neutral900,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._12,
  },
  menuIcon: {
    width: verticalScale(42),
    height: verticalScale(42),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  blockMenuIcon: {
    backgroundColor: "#211111",
    borderWidth: 1,
    borderColor: "#7F1D1D",
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacingX._12,
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
  sheetContent: {
    gap: spacingY._12,
    paddingTop: spacingY._5,
  },
  sourceSection: {
    borderWidth: 1,
    borderColor: colors.neutral800,
    borderRadius: radius._15,
    overflow: "hidden",
    backgroundColor: colors.neutral900,
  },
  sourceSectionTitle: {
    backgroundColor: colors.neutral800,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._7,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral800,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._12,
  },
  sourceRowBlocked: {
    backgroundColor: "#1F1111",
  },
  sourceRowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  logoWrap: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius._12,
    overflow: "hidden",
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  logoImage: {
    flex: 1,
  },
  sourceText: {
    flex: 1,
    minWidth: 0,
    gap: spacingY._5,
  },
  sourceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  blockedPill: {
    borderWidth: 1,
    borderColor: "#7F1D1D",
    borderRadius: 999,
    paddingHorizontal: spacingX._7,
    paddingVertical: 2,
    backgroundColor: "#450A0A",
  },
  sourceBlockBtn: {
    width: verticalScale(38),
    height: verticalScale(38),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#7F1D1D",
    backgroundColor: "#211111",
  },
  sourceUnblockBtn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  blockInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  blockInput: {
    flex: 1,
    minHeight: verticalScale(46),
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._12,
    paddingHorizontal: spacingX._12,
    color: colors.white,
    backgroundColor: "#111827",
  },
  addBlockBtn: {
    minHeight: verticalScale(46),
    width: verticalScale(46),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  suggestionBlock: {
    gap: spacingY._7,
  },
  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._7,
  },
  sourceSuggestion: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: 999,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._7,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
  },
  blockedList: {
    gap: spacingY._10,
  },
  blockedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._12,
    backgroundColor: "#101010",
  },
  blockedIcon: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#211111",
  },
  removeBlockBtn: {
    width: verticalScale(34),
    height: verticalScale(34),
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    paddingVertical: spacingY._12,
    alignItems: "center",
    justifyContent: "center",
    gap: spacingY._7,
  },
});
