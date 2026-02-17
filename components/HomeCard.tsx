import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import { TransactionType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import { orderBy, Timestamp, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import {
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import SheetModal from "./SheetModal";
import Typo from "./Typo";

const HomeCard = () => {
  const { user } = useAuth();
  const [checkMonthVisible, setCheckMonthVisible] = useState(false);

  const monthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }, []);

  const monthLabelLong = useMemo(
    () =>
      monthRange.start.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      }),
    [monthRange.start],
  );

  const transactionConstraints = useMemo(
    () =>
      user?.uid
        ? [
            where("uid", "==", user.uid),
            where("date", ">=", Timestamp.fromDate(monthRange.start)),
            where("date", "<=", Timestamp.fromDate(monthRange.end)),
            orderBy("date", "desc"),
          ]
        : [],
    [monthRange.end, monthRange.start, user?.uid],
  );

  const { data: monthlyTransactions, loading: transactionsLoading } =
    useFetchData<TransactionType>(
      user?.uid ? "transactions" : "",
      transactionConstraints,
    );

  const toSafeNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const isDebtTransaction = (description?: string) =>
    /^\[(DEBT|PAYMENT):[^\]]+\]/i.test(String(description ?? "").trim());
  const isTransferTransaction = (item: any) => Boolean(item?.isTransfer);

  const totals = useMemo(
    () =>
      (monthlyTransactions ?? []).reduce(
        (acc, item: any) => {
          if (isDebtTransaction(item?.description)) return acc;
          if (isTransferTransaction(item)) return acc;

          const amount = toSafeNumber(item?.amount);
          const type = String(item?.type ?? "").toLowerCase();

          if (type === "income") acc.income += amount;
          if (type === "expense") acc.expenses += amount;

          return acc;
        },
        { income: 0, expenses: 0 },
      ),
    [monthlyTransactions],
  );

  const monthlyBalance = totals.income - totals.expenses;
  const nonDebtTransactionsCount = useMemo(
    () =>
      (monthlyTransactions ?? []).filter(
        (item: any) =>
          !isDebtTransaction(item?.description) && !isTransferTransaction(item),
      ).length,
    [monthlyTransactions],
  );

  return (
    <>
      <ImageBackground
        source={require("../assets/images/card.png")}
        resizeMode="stretch"
        style={styles.bgImage}
      >
        <View style={styles.container}>
          <View>
            <View style={styles.totalBalanceRow}>
              <Typo color={colors.neutral800} size={17} fontWeight={"500"}>
                Monthly Balance
              </Typo>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCheckMonthVisible(true)}
                style={styles.moreBtn}
              >
                <Icons.DotsThreeOutlineIcon
                  size={verticalScale(23)}
                  color={colors.black}
                  weight="fill"
                />
              </TouchableOpacity>
            </View>
            <Typo color={colors.black} size={30} fontWeight={"bold"}>
              {transactionsLoading ? "----" : formatRupiah(monthlyBalance)}
            </Typo>
          </View>
          <View style={styles.stats}>
            <View style={{ gap: verticalScale(5) }}>
              <View style={styles.incomeExpense}>
                <View style={styles.statsIcon}>
                  <Icons.ArrowDownIcon
                    size={verticalScale(15)}
                    color={colors.black}
                    weight="bold"
                  />
                </View>
                <Typo color={colors.neutral700} size={16} fontWeight={"500"}>
                  Income
                </Typo>
              </View>
              <View style={{ alignSelf: "center" }}>
                <Typo size={17} color={colors.green} fontWeight={"600"}>
                  {transactionsLoading ? "----" : formatRupiah(totals.income)}
                </Typo>
              </View>
            </View>

            <View style={{ gap: verticalScale(5) }}>
              <View style={styles.incomeExpense}>
                <View style={styles.statsIcon}>
                  <Icons.ArrowUpIcon
                    size={verticalScale(15)}
                    color={colors.black}
                    weight="bold"
                  />
                </View>
                <Typo color={colors.neutral700} size={16} fontWeight={"500"}>
                  Expense
                </Typo>
              </View>
              <View style={{ alignSelf: "center" }}>
                <Typo size={17} color={colors.rose} fontWeight={"600"}>
                  {transactionsLoading ? "----" : formatRupiah(totals.expenses)}
                </Typo>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>
      <SheetModal
        visible={checkMonthVisible}
        title="Monthly Info"
        onClose={() => setCheckMonthVisible(false)}
        portal
        keyboardAware={false}
      >
        <View style={styles.sheetContent}>
          <Typo size={22} fontWeight={"900"}>
            {monthLabelLong}
          </Typo>

          <View style={styles.sheetStats}>
            <View style={{ flex: 1 }}>
              <Typo size={12} color={colors.neutral400}>
                Income
              </Typo>
              <Typo size={16} color={colors.green} fontWeight={"700"}>
                {transactionsLoading ? "----" : formatRupiah(totals.income)}
              </Typo>
            </View>
            <View style={{ flex: 1 }}>
              <Typo size={12} color={colors.neutral400}>
                Expense
              </Typo>
              <Typo size={16} color={colors.rose} fontWeight={"700"}>
                {transactionsLoading ? "----" : formatRupiah(totals.expenses)}
              </Typo>
            </View>
          </View>

          <View style={styles.sheetIdeas}>
            <Typo size={13} color={colors.neutral200}>
              1. Jumlah transaksi bulan ini: {nonDebtTransactionsCount}
            </Typo>
          </View>
        </View>
      </SheetModal>
    </>
  );
};

export default HomeCard;

const styles = StyleSheet.create({
  bgImage: {
    height: scale(210),
    width: "100%",
  },
  container: {
    padding: spacingX._20,
    paddingHorizontal: scale(23),
    height: "87%",
    width: "100%",
    justifyContent: "space-between",
  },
  totalBalanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._5,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsIcon: {
    backgroundColor: colors.neutral350,
    padding: spacingY._5,
    borderRadius: 50,
  },
  incomeExpense: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingY._7,
  },
  moreBtn: {
    padding: spacingY._5,
    borderRadius: 50,
  },
  sheetContent: {
    gap: spacingY._10,
  },
  sheetStats: {
    flexDirection: "row",
    gap: spacingX._12,
  },
  sheetIdeas: {
    gap: spacingY._7,
  },
});
