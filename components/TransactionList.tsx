import { expenseCategories, incomeCategory } from "@/constants/data";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import {
  TransactionItemProps,
  TransactionListType,
  TransactionType,
} from "@/types";
import { formatRupiah } from "@/utils/common";
import { verticalScale } from "@/utils/styling";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Timestamp } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Loading from "./Loading";
import Typo from "./Typo";

const TransactionList = ({
  data,
  title,
  loading,
  emptyListMessage,
  fitParent = false,
  disableItemAnimation = false,
}: TransactionListType) => {
  const router = useRouter();
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
          data={data}
          keyExtractor={(item, index) =>
            String(item?.id ?? `${item?.type}-${item?.walletId}-${index}`)
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TransactionItem
              item={item}
              index={index}
              handleClick={handleClick}
              disableAnimation={disableItemAnimation}
            />
          )}
        />
      </View>
      {!loading && data.length == 0 && (
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
}: TransactionItemProps) => {
  const type = String(item?.type ?? "").toLowerCase();

  const fallbackCategory = {
    label: type === "transfer" ? "Transfer" : "Uncategorized",
    bgColor: colors.neutral800,
    icon: Icons.Receipt, // ganti kalau gak ada: Icons.FileText / Icons.Note
  };

  const resolveCategory = () => {
    // income
    if (type === "income") {
      // kalau incomeCategory gak ada, fallback
      return incomeCategory ?? fallbackCategory;
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

  const amountColor =
    type === "income"
      ? colors.primary
      : type === "transfer"
        ? colors.neutral200
        : colors.rose;

  const sign = type === "income" ? "+ " : type === "expense" ? "- " : "";

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
          {item?.description}
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
});
