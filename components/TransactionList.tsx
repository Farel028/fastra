import {
  debtCategory,
  incomeCategory,
  transferCategory,
} from "@/constants/data";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { useCategories } from "@/contexts/categoryContext";
import useFetchData from "@/hooks/useFetchData";
import { isSystemWalletId } from "@/services/walletService";
import {
  TransactionItemProps,
  TransactionListType,
  TransactionType,
  WalletType,
} from "@/types";
import { formatRupiah } from "@/utils/common";
import { verticalScale } from "@/utils/styling";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Timestamp, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Loading from "./Loading";
import Typo from "./Typo";

type DebtMeta = {
  event: "DEBT" | "PAYMENT";
  debtId: string;
};

const parseDebtMeta = (description?: string): DebtMeta | null => {
  const raw = String(description ?? "").trim();
  const match = /^\[(DEBT|PAYMENT):([^\]]+)\]/i.exec(raw);
  if (!match) return null;

  const event = String(match[1] ?? "").toUpperCase();
  const debtId = String(match[2] ?? "").trim();
  if (!debtId) return null;

  return {
    event: event === "PAYMENT" ? "PAYMENT" : "DEBT",
    debtId,
  };
};

const parseDebtDisplay = (
  description?: string,
): { personName: string; note: string } | null => {
  const raw = String(description ?? "").trim();
  const meta = parseDebtMeta(raw);
  if (!meta) return null;

  const payload = raw.replace(/^\[(?:DEBT|PAYMENT):[^\]]+\]\s*/i, "").trim();
  if (!payload) return null;

  const oldFormat = /^(?:PIUTANG|HUTANG)\s*-\s*(.+)$/i.exec(payload);
  if (oldFormat) {
    const personName = String(oldFormat[1] ?? "").trim();
    if (!personName) return null;
    return { personName, note: "-" };
  }

  const parts = payload.split(" - ");
  const personName = String(parts.shift() ?? "").trim();
  if (!personName) return null;

  const note = parts.join(" - ").trim() || "-";
  return { personName, note };
};

const getWalletId = (w: WalletType) =>
  String((w as any)?.id ?? (w as any)?.docId ?? (w as any)?.walletId ?? "");

const parseTransactionDate = (date: TransactionType["date"]): Date | null => {
  const parsedDate =
    typeof (date as { toDate?: () => Date })?.toDate === "function"
      ? (date as { toDate: () => Date }).toDate()
      : date instanceof Date
        ? date
        : new Date(date as string);

  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
};

const getMonthYearKey = (date: TransactionType["date"]) => {
  const parsedDate = parseTransactionDate(date);
  if (!parsedDate) return "unknown";
  return `${parsedDate.getFullYear()}-${parsedDate.getMonth()}`;
};

const formatMonthYear = (date: TransactionType["date"], locale = "id-ID") => {
  const parsedDate = parseTransactionDate(date);
  if (!parsedDate) return "Unknown period";

  const currentYear = new Date().getFullYear();
  const transactionYear = parsedDate.getFullYear();
  const formatOptions: Intl.DateTimeFormatOptions =
    transactionYear === currentYear
      ? { month: "long" }
      : { month: "long", year: "numeric" };

  return parsedDate.toLocaleDateString(locale, formatOptions);
};

const TransactionList = ({
  data,
  title,
  loading,
  emptyListMessage,
  fitParent = false,
  disableItemAnimation = false,
  showMonthYearHeader = false,
  monthYearLocale = "id-ID",
}: TransactionListType) => {
  const router = useRouter();
  const { user } = useAuth();

  const walletConstraints = useMemo(
    () => (user?.uid ? [where("uid", "==", user.uid)] : []),
    [user?.uid],
  );

  const { data: walletsRaw } = useFetchData<WalletType>(
    user?.uid ? "wallets" : "",
    walletConstraints,
  );

  const walletNameById = useMemo(() => {
    const map = new Map<string, string>();
    (walletsRaw ?? []).forEach((w) => {
      const id = getWalletId(w);
      if (id) map.set(id, String(w?.name ?? "").trim() || "Wallet");
    });
    return map;
  }, [walletsRaw]);

  const visibleData = useMemo(
    () =>
      (data ?? []).filter(
        (item) => {
          if (isSystemWalletId(String(item?.walletId ?? ""))) return false;

          const isTransfer = Boolean((item as any)?.isTransfer);
          if (!isTransfer) return true;

          const transferSide = String((item as any)?.transferSide ?? "").toLowerCase();
          const transferFromId = String((item as any)?.transferFromId ?? "");
          const walletId = String(item?.walletId ?? "");

          // Hide transfer from-wallet side (outgoing / white item)
          if (transferSide === "out") return false;
          if (transferFromId && walletId === transferFromId) return false;

          return true;
        },
      ),
    [data],
  );

  const getDisplayDescription = (item: TransactionType) => {
    const isDebt = Boolean(parseDebtMeta(item?.description));
    if (isDebt) {
      const parsed = parseDebtDisplay(item?.description);
      if (!parsed) return String(item?.description ?? "");
      return `${parsed.personName} - ${parsed.note}`;
    }

    const isTransfer = Boolean((item as any)?.isTransfer);
    if (isTransfer) {
      const plain = String(item?.description ?? "").trim();
      if (plain) return plain;

      const fromId = String((item as any)?.transferFromId ?? "");
      const toId = String((item as any)?.transferToId ?? "");
      const fromName = walletNameById.get(fromId) ?? "from";
      const toName = walletNameById.get(toId) ?? "to";
      return `Transfer ${fromName} -> ${toName}`;
    }

    const parsed = parseDebtDisplay(item?.description);
    if (parsed) return `${parsed.personName} - ${parsed.note}`;
    return String(item?.description ?? "");
  };

  const handleClick = (item: TransactionType) => {
    router.push({
      pathname: "/transactionDetail",
      params: {
        id: item?.id,
        type: item?.type,
        amount: item?.amount?.toString(),
        category: item?.category,
        date: (item.date as Timestamp)?.toDate()?.toISOString(),
        description: item?.description,
        image: item?.image,
        uid: item?.uid,
        walletId: item?.walletId,
      },
    });
  };

  return (
    <View style={[styles.container, fitParent && styles.containerFit]}>
      {title && (
        <Typo size={20} fontWeight={"500"}>
          {title}
        </Typo>
      )}
      <View style={[styles.list, fitParent && styles.listFit]}>
        <FlashList
          data={visibleData}
          keyExtractor={(item, index) =>
            String(item?.id ?? `${item?.type}-${item?.walletId}-${index}`)
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const previousItem = visibleData[index - 1];
            const shouldShowMonthHeader =
              showMonthYearHeader &&
              (!previousItem ||
                getMonthYearKey(previousItem.date) !== getMonthYearKey(item.date));

            return (
              <View>
                {shouldShowMonthHeader && (
                  <Typo
                    size={13}
                    color={colors.neutral300}
                    fontWeight={"600"}
                    style={styles.monthYearHeader}
                  >
                    {formatMonthYear(item.date, monthYearLocale)}
                  </Typo>
                )}
                <TransactionItem
                  item={item}
                  index={index}
                  handleClick={handleClick}
                  disableAnimation={disableItemAnimation}
                  descriptionText={getDisplayDescription(item)}
                />
              </View>
            );
          }}
        />
      </View>
      {!loading && visibleData.length === 0 && (
        <Typo
          size={15}
          color={colors.neutral400}
          style={{ textAlign: "center", marginTop: spacingY._15 }}
        >
          {emptyListMessage}
        </Typo>
      )}
      {loading && (
        <View style={{ top: verticalScale(100) }}>
          <Loading />
        </View>
      )}
    </View>
  );
};

export const TransactionItem = ({
  item,
  index,
  handleClick,
  disableAnimation = false,
  descriptionText,
}: TransactionItemProps) => {
  const { categories: expenseCategories, incomeCategories } = useCategories();
  const type = String(item?.type ?? "").toLowerCase();
  const isDebt = Boolean(parseDebtMeta(item?.description));
  const isTransfer = Boolean((item as any)?.isTransfer);

  const fallbackCategory = {
    label: isDebt ? "Debt" : isTransfer ? "Transfer" : "Uncategorized",
    bgColor: colors.neutral800,
    icon: Icons.ReceiptIcon,
  };

  const resolveCategory = () => {
    if (isDebt) {
      return debtCategory ?? fallbackCategory;
    }

    if (isTransfer) {
      return transferCategory ?? fallbackCategory;
    }

    // income
    if (type === "income") {
      const key = String(item?.category ?? "");
      const cat = (incomeCategories as any)?.[key];
      return cat ?? incomeCategory ?? fallbackCategory;
    }

    // expense
    if (type === "expense") {
      const key = String(item?.category ?? "");
      const cat =
        (expenseCategories as any)?.[key] ??
        (expenseCategories as any)?.["others"] ??
        (expenseCategories as any)?.["other"];

      return cat ?? fallbackCategory;
    }

    // transfer / unknown
    return fallbackCategory;
  };

  const cat = resolveCategory();
  const IconComponent: any = cat?.icon;

  const date =
    (item?.date as any)?.toDate?.()?.toLocaleDateString?.("en-GB", {
      day: "numeric",
      month: "short",
    }) ??
    new Date(item?.date as any).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });

  const amountColor = isTransfer
    ? colors.neutral300
    : type === "income"
      ? colors.primary
      : colors.rose;

  const sign =
    isTransfer ? "" : type === "income" ? "+ " : type === "expense" ? "- " : "";

  const rowContent = (
    <TouchableOpacity
      activeOpacity={disableAnimation ? 1 : 0.85}
      style={styles.row}
      onPress={() => handleClick(item)}
    >
      <View style={[styles.icon, { backgroundColor: cat.bgColor }]}>
        {IconComponent ? (
          <IconComponent
            size={verticalScale(25)}
            weight="fill"
            color={colors.white}
          />
        ) : null}
      </View>

      <View style={styles.categoryDesc}>
        <Typo size={17}>{cat.label}</Typo>
        <Typo
          size={12}
          color={colors.neutral400}
          textProps={{ numberOfLines: 1 }}
        >
          {descriptionText ?? item?.description}
        </Typo>
      </View>

      <View style={styles.amountDate}>
        <Typo fontWeight={"500"} color={amountColor}>
          {sign}
          {formatRupiah(item?.amount ?? 0)}
        </Typo>
        <Typo size={13} color={colors.neutral400}>
          {date}
        </Typo>
      </View>
    </TouchableOpacity>
  );

  if (disableAnimation) return rowContent;

  return <Animated.View entering={FadeInDown.delay(index * 70)}>{rowContent}</Animated.View>;
};

export default TransactionList;

const styles = StyleSheet.create({
  container: {
    gap: spacingY._17,
  },
  containerFit: {
    flex: 1,
  },
  list: {
    minHeight: 3,
  },
  listFit: {
    flex: 1,
    minHeight: verticalScale(120),
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacingX._12,
    marginBottom: spacingY._12,
    backgroundColor: colors.neutral800,
    padding: spacingY._10,
    paddingHorizontal: spacingY._10,
    borderRadius: radius._17,
  },
  icon: {
    height: verticalScale(44),
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius._12,
    borderCurve: "continuous",
  },
  categoryDesc: {
    flex: 1,
    gap: 2.3,
  },
  amountDate: {
    alignItems: "flex-end",
    gap: 3,
  },
  monthYearHeader: {
    marginBottom: spacingY._7,
    marginTop: spacingY._5,
    marginLeft: spacingX._3,
    textTransform: "capitalize",
  },
});
