import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import {
  ensureSystemWallets,
  SYSTEM_WALLET_IDS,
} from "@/services/walletService";
import { WalletType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type DebtKind = "PIUTANG" | "HUTANG";
type DebtStatus = "ONGOING" | "PAID";

type DebtDoc = {
  id?: string;
  uid: string;
  kind: DebtKind;

  personName: string;
  title?: string;
  note?: string;

  amount: number;
  paidAmount: number;
  status: DebtStatus;

  walletId: string;
  dueDate?: any; // Date | null | Timestamp
  created?: any;
  updated?: any;
};

type FilterTab = "ONGOING" | "OVERDUE" | "PAID";

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export default function Debts() {
  const router = useRouter();
  const { user } = useAuth();

  const [kind, setKind] = useState<DebtKind>("PIUTANG"); // Lent default
  const [filter, setFilter] = useState<FilterTab>("ONGOING");
  const [focusRefreshKey, setFocusRefreshKey] = useState(0);

  // ✅ ensure system wallets exist (safe, idempotent)
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) ensureSystemWallets(user.uid);
      setFocusRefreshKey((prev) => prev + 1);
    }, [user?.uid]),
  );

  const debtConstraints = useMemo(
    () => (user?.uid ? [where("uid", "==", user.uid)] : []),
    [user?.uid],
  );

  const walletConstraints = useMemo(
    () =>
      user?.uid
        ? [where("uid", "==", user.uid), orderBy("created", "desc")]
        : [],
    [user?.uid],
  );

  const { data: debtsRaw, loading } = useFetchData<DebtDoc>(
    user?.uid ? "debts" : "",
    debtConstraints,
    focusRefreshKey,
  );

  const { data: walletsRaw } = useFetchData<WalletType>(
    user?.uid ? "wallets" : "",
    walletConstraints,
    focusRefreshKey,
  );

  const wallets = useMemo(
    () => (walletsRaw ?? []).filter((w) => !w.hidden && !w.isSystem),
    [walletsRaw],
  );

  const walletNameById = useMemo(() => {
    const map = new Map<string, string>();
    wallets.forEach((w) => map.set(String(w.id), w.name));
    return map;
  }, [wallets]);

  const debtSummary = useMemo(() => {
    const rows = walletsRaw ?? [];
    const getWalletId = (w: WalletType) =>
      String((w as any)?.id ?? (w as any)?.docId ?? (w as any)?.walletId ?? "");

    const findByName = (name: string) =>
      rows.find(
        (w) =>
          String(w?.name ?? "")
            .trim()
            .toLowerCase() === name,
      );

    let receivableWallet: WalletType | undefined;
    let payableWallet: WalletType | undefined;

    if (user?.uid) {
      const ids = SYSTEM_WALLET_IDS(user.uid);
      receivableWallet = rows.find((w) => getWalletId(w) === ids.receivable);
      payableWallet = rows.find((w) => getWalletId(w) === ids.payable);
    }

    if (!receivableWallet) receivableWallet = findByName("receivable");
    if (!payableWallet) payableWallet = findByName("payable");

    return {
      owedToMe: Number(receivableWallet?.amount ?? 0),
      iOwe: Number(payableWallet?.amount ?? 0),
    };
  }, [walletsRaw, user?.uid]);

  const now = Date.now();

  const debts = useMemo(() => {
    const base = (debtsRaw ?? [])
      .map((d) => {
        const updatedMs = toDate((d as any)?.updated)?.getTime() ?? 0;
        const createdMs = toDate((d as any)?.created)?.getTime() ?? 0;

        return {
          ...d,
          id: String((d as any).id ?? (d as any).docId ?? d.id),
          __sortMs: Math.max(updatedMs, createdMs, 0),
        };
      })
      .sort(
        (a, b) =>
          Number((b as any).__sortMs ?? 0) - Number((a as any).__sortMs ?? 0),
      );

    const byKind = base.filter((d) => d.kind === kind);

    const filtered = byKind.filter((d) => {
      const amount = Number(d.amount ?? 0);
      const paid = Number(d.paidAmount ?? 0);
      const remaining = Math.max(0, amount - paid);

      const due = toDate(d.dueDate);
      const overdue =
        d.status !== "PAID" && remaining > 0 && !!due && due.getTime() < now;

      if (filter === "PAID") return d.status === "PAID" || remaining <= 0;
      if (filter === "OVERDUE") return overdue;
      // ongoing
      return (
        (d.status !== "PAID" && remaining > 0 && !overdue) ||
        (!d.status && remaining > 0)
      );
    });

    return filtered;
  }, [debtsRaw, kind, filter, now]);

  const openNewDebt = () => {
    router.push({ pathname: "/(modals)/debtModal" });
  };

  const openDetail = (d: DebtDoc) => {
    const due = toDate(d.dueDate);
    const created = toDate(d.created);

    router.push({
      pathname: "/debtDetail", // ✅ sesuaikan kalau route kamu beda
      params: {
        id: d.id ?? "",
        kind: d.kind,
        personName: d.personName ?? "",
        title: d.title ?? "",
        note: d.note ?? "",
        amount: String(d.amount ?? 0),
        paidAmount: String(d.paidAmount ?? 0),
        walletId: String(d.walletId ?? ""),
        dueDate: due ? due.toISOString() : "",
        created: created ? created.toISOString() : "",
      },
    });
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Debts"
          leftIcon={<BackButton />}
          style={{ paddingTop: scale(10) }}
        />

        {/* segmented */}
        <View style={styles.segmentWrap}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.segment, kind === "PIUTANG" && styles.segmentActive]}
            onPress={() => setKind("PIUTANG")}
          >
            <Typo
              fontWeight={"900"}
              color={kind === "PIUTANG" ? colors.black : colors.white}
            >
              Lent
            </Typo>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.segment, kind === "HUTANG" && styles.segmentActive]}
            onPress={() => setKind("HUTANG")}
          >
            <Typo
              fontWeight={"900"}
              color={kind === "HUTANG" ? colors.black : colors.white}
            >
              Borrow
            </Typo>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Typo size={12} color={colors.neutral400}>
              I Owe
            </Typo>
            <Typo size={18} fontWeight={"900"} color={colors.rose}>
              {formatRupiah(debtSummary.iOwe)}
            </Typo>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Typo size={12} color={colors.neutral400}>
              Owed to Me
            </Typo>
            <Typo size={18} fontWeight={"900"} color={colors.primary}>
              {formatRupiah(debtSummary.owedToMe)}
            </Typo>
          </View>
        </View>

        {/* filter pills */}
        <View style={styles.pillsRow}>
          {(["ONGOING", "OVERDUE", "PAID"] as FilterTab[]).map((t) => {
            const active = filter === t;
            return (
              <TouchableOpacity
                key={t}
                activeOpacity={0.88}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setFilter(t)}
              >
                <Typo
                  size={13}
                  fontWeight={"800"}
                  color={active ? colors.black : colors.neutral200}
                >
                  {t === "ONGOING"
                    ? "Ongoing"
                    : t === "OVERDUE"
                      ? "Overdue"
                      : "Paid"}
                </Typo>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* list */}
        <ScrollView
          style={styles.listScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            debts.length <= 2 && styles.listContentCompact,
          ]}
        >
          {loading ? (
            <View>
              <Typo color={colors.neutral400}>Loading...</Typo>
            </View>
          ) : debts.length === 0 ? (
            <View style={styles.empty}>
              <Icons.ClipboardTextIcon
                size={verticalScale(40)}
                color={colors.neutral500}
                weight="duotone"
              />
              <Typo fontWeight={"900"} style={{ marginTop: spacingY._10 }}>
                No debts yet
              </Typo>
              <Typo
                color={colors.neutral400}
                style={{ marginTop: spacingY._5 }}
              >
                Tap + to add Lent/Borrow.
              </Typo>
            </View>
          ) : (
            <View style={styles.debtsList}>
              {debts.map((d) => (
                <DebtCard
                  key={String(d.id)}
                  debt={d}
                  walletName={
                    walletNameById.get(String(d.walletId)) ?? "Wallet"
                  }
                  onPress={() => openDetail(d)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* floating add */}
        <Pressable style={styles.fab} onPress={openNewDebt}>
          <Icons.Plus
            size={verticalScale(22)}
            color={colors.black}
            weight="bold"
          />
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

function DebtCard({
  debt,
  walletName,
  onPress,
}: {
  debt: DebtDoc;
  walletName: string;
  onPress: () => void;
}) {
  const amount = Number(debt.amount ?? 0);
  const paid = Number(debt.paidAmount ?? 0);
  const remaining = Math.max(0, amount - paid);

  const due = toDate(debt.dueDate);
  const overdue =
    debt.status !== "PAID" &&
    remaining > 0 &&
    !!due &&
    due.getTime() < Date.now();

  const badgeText =
    remaining <= 0 || debt.status === "PAID"
      ? "PAID"
      : overdue
        ? "OVERDUE"
        : "ONGOING";

  const badgeBg =
    badgeText === "PAID"
      ? "#10221A"
      : badgeText === "OVERDUE"
        ? "#2A1012"
        : colors.neutral800;

  const badgeColor =
    badgeText === "PAID"
      ? colors.primary
      : badgeText === "OVERDUE"
        ? colors.rose
        : colors.neutral200;

  const dueText = due
    ? due.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: scale(12) }}
      >
        <View style={styles.cardIcon}>
          {debt.kind === "PIUTANG" ? (
            <Icons.HandCoins
              size={verticalScale(18)}
              color={colors.primary}
              weight="bold"
            />
          ) : (
            <Icons.Receipt
              size={verticalScale(18)}
              color={colors.rose}
              weight="bold"
            />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Typo fontWeight={"900"} numberOfLines={1} ellipsizeMode="tail">
            {debt.personName}
          </Typo>
          <Typo
            size={12}
            color={colors.neutral400}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {debt.title?.trim() ? debt.title : walletName}
          </Typo>
        </View>

        <View
          style={[
            styles.badge,
            { backgroundColor: badgeBg, borderColor: badgeBg },
          ]}
        >
          <Typo size={11} fontWeight={"900"} color={badgeColor}>
            {badgeText}
          </Typo>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={{ flex: 1 }}>
          <Typo size={12} color={colors.neutral400}>
            Remaining
          </Typo>
          <Typo
            fontWeight={"900"}
            color={debt.kind === "PIUTANG" ? colors.primary : colors.rose}
          >
            {formatRupiah(remaining)}
          </Typo>
        </View>

        <View style={{ flex: 1 }}>
          <Typo size={12} color={colors.neutral400}>
            Total
          </Typo>
          <Typo fontWeight={"900"}>{formatRupiah(amount)}</Typo>
        </View>

        <View style={{ flex: 1 }}>
          <Typo size={12} color={colors.neutral400}>
            Due
          </Typo>
          <Typo fontWeight={"800"}>{dueText}</Typo>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._15,
  },

  segmentWrap: {
    flexDirection: "row",
    gap: scale(10),
    marginTop: spacingY._10,
  },
  segment: {
    flex: 1,
    height: verticalScale(46),
    borderRadius: radius._17,
    borderWidth: 1,
    borderColor: colors.neutral800,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral900,
  },
  segmentActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },

  summaryCard: {
    marginTop: spacingY._12,
    borderWidth: 1,
    borderColor: colors.neutral800,
    borderRadius: radius._17,
    backgroundColor: colors.neutral900,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },
  summaryItem: {
    flex: 1,
    gap: spacingY._5,
  },
  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.neutral800,
  },

  pillsRow: {
    gap: scale(10),
    paddingVertical: spacingY._10,
    flexDirection: 'row'
  },

  listContent: {
    flexGrow: 1,
    paddingBottom: verticalScale(96),
  },
  listContentCompact: {
    paddingBottom: spacingY._20,
  },
  debtsList: {
    gap: spacingY._10,
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  pill: {
    height: verticalScale(36),
    paddingHorizontal: spacingX._15,
    borderRadius: radius._17,
    borderWidth: 1,
    borderColor: colors.neutral800,
    backgroundColor: colors.neutral900,
    justifyContent: "center",
    alignItems: "center",
  },
  pillActive: {
    backgroundColor: colors.neutral200,
    borderColor: colors.neutral200,
  },

  card: {
    borderWidth: 1,
    borderColor: colors.neutral800,
    borderRadius: radius._17,
    backgroundColor: colors.neutral900,
    padding: spacingY._12,
    gap: spacingY._10,
  },
  cardIcon: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: verticalScale(40),
    borderWidth: 1,
    borderColor: colors.neutral800,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.black,
  },
  badge: {
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._5,
    borderRadius: radius._12,
    borderWidth: 1,
  },
  cardBottom: {
    flexDirection: "row",
    gap: scale(10),
    alignItems: "flex-end",
  },

  empty: {
    marginTop: spacingY._35,
    alignItems: "center",
    paddingHorizontal: spacingX._10,
  },

  fab: {
    position: "absolute",
    right: spacingY._20,
    bottom: spacingY._20,
    width: verticalScale(56),
    height: verticalScale(56),
    borderRadius: verticalScale(56),
    backgroundColor: colors.neutral200,
    borderWidth: 1,
    borderColor: colors.neutral200,
    justifyContent: "center",
    alignItems: "center",
  },
});
