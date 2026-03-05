import Header from "@/components/Header";
import Loading from "@/components/Loading";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { useCategories } from "@/contexts/categoryContext";
import {
  fetchMonthlyStats,
  fetchWeeklyStats,
  fetchYearlyStats,
} from "@/services/transactionService";
import { ExpenseCategoriesType, TransactionType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  BarChart,
  PieChart,
  type pieDataItem,
} from "react-native-gifted-charts";

type ChartDataItem = {
  value: number;
  label?: string;
};

type PeriodInsight = {
  label: string;
  income: number;
  expense: number;
  net: number;
};

type InsightSummary = {
  hasData: boolean;
  totalIncome: number;
  totalExpense: number;
  net: number;
  savingsRate: number;
  expenseRatio: number;
  bestNetPeriod: PeriodInsight | null;
  highestExpensePeriod: PeriodInsight | null;
};

type CategoryBreakdownItem = {
  key: string;
  label: string;
  amount: number;
  percentage: number;
  color: string;
  tooltipText: string;
};

type ExpenseCategorySummary = {
  hasData: boolean;
  totalAmount: number;
  donutData: pieDataItem[];
  breakdown: CategoryBreakdownItem[];
  topCategory: CategoryBreakdownItem | null;
};

const periodLabels = ["Last 7 days", "Last 12 months", "All years"];

const fallbackCategoryPalette = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
];

const isTransferTransaction = (transaction: TransactionType) =>
  Boolean(
    (transaction as TransactionType & { isTransfer?: boolean })?.isTransfer,
  );

const formatStatsTransactionDate = (date: TransactionType["date"]) => {
  const parsedDate =
    typeof (date as { toDate?: () => Date })?.toDate === "function"
      ? (date as { toDate: () => Date }).toDate()
      : date instanceof Date
        ? date
        : new Date(date as string);

  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const resolveExpenseCategory = (
  categoryMap: ExpenseCategoriesType,
  rawValue?: string,
  fallbackColorIndex = 0,
) => {
  const key = String(rawValue ?? "")
    .trim()
    .toLowerCase();
  const normalizedKey = key && categoryMap[key] ? key : "others";
  const fallbackColor =
    fallbackCategoryPalette[
      fallbackColorIndex % fallbackCategoryPalette.length
    ];
  const defaultCategory = categoryMap.others;
  const resolved = categoryMap[normalizedKey] || defaultCategory;

  return {
    key: normalizedKey,
    label: resolved?.label ?? "Others",
    color: resolved?.bgColor ?? fallbackColor,
  };
};

const Statistics = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { user } = useAuth();
  const { categories: expenseCategories } = useCategories();
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionType[]>([]);

  const insights = useMemo<InsightSummary>(() => {
    const grouped: PeriodInsight[] = [];

    for (let i = 0; i < chartData.length; i += 2) {
      const incomeRow = chartData[i];
      if (!incomeRow) continue;

      const expenseRow = chartData[i + 1];
      const income = Number(incomeRow?.value ?? 0);
      const expense = Number(expenseRow?.value ?? 0);

      grouped.push({
        label: String(incomeRow?.label ?? `Period ${Math.floor(i / 2) + 1}`),
        income,
        expense,
        net: income - expense,
      });
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let bestNetPeriod: PeriodInsight | null = null;
    let highestExpensePeriod: PeriodInsight | null = null;

    grouped.forEach((item) => {
      totalIncome += item.income;
      totalExpense += item.expense;

      if (!bestNetPeriod || item.net > bestNetPeriod.net) {
        bestNetPeriod = item;
      }

      if (
        !highestExpensePeriod ||
        item.expense > highestExpensePeriod.expense
      ) {
        highestExpensePeriod = item;
      }
    });

    const net = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
    const expenseRatio =
      totalIncome + totalExpense > 0
        ? (totalExpense / (totalIncome + totalExpense)) * 100
        : 0;

    return {
      hasData: grouped.length > 0,
      totalIncome,
      totalExpense,
      net,
      savingsRate,
      expenseRatio,
      bestNetPeriod,
      highestExpensePeriod,
    };
  }, [chartData]);

  const expenseShareWidth = useMemo<`${number}%`>(() => {
    if (insights.expenseRatio <= 0) return "0%";
    const clampedRatio = Number(
      Math.min(Math.max(insights.expenseRatio, 4), 100).toFixed(1),
    );
    return `${clampedRatio}%`;
  }, [insights.expenseRatio]);

  const budgetColor =
    insights.savingsRate < 0
      ? colors.rose
      : insights.savingsRate < 20
        ? "#f59e0b"
        : colors.primary;

  const expenseByCategory = useMemo<ExpenseCategorySummary>(() => {
    const expenseTransactions = transactions.filter(
      (item) =>
        String(item.type ?? "").toLowerCase() === "expense" &&
        !isTransferTransaction(item),
    );
    const totalsByCategory = new Map<string, number>();

    expenseTransactions.forEach((item) => {
      const amount = Number(item?.amount ?? 0);
      if (amount <= 0) return;

      const categoryKey = resolveExpenseCategory(
        expenseCategories,
        item.category,
      ).key;
      totalsByCategory.set(
        categoryKey,
        (totalsByCategory.get(categoryKey) ?? 0) + amount,
      );
    });

    const totalAmount = Array.from(totalsByCategory.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    const breakdown = Array.from(totalsByCategory.entries())
      .map(([key, amount], index) => {
        const category = resolveExpenseCategory(expenseCategories, key, index);
        const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
        return {
          key,
          label: category.label,
          amount,
          percentage,
          color: category.color,
          tooltipText: `${percentage.toFixed(1)}%`,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const donutData: pieDataItem[] = breakdown.map((item) => ({
      value: item.amount,
      color: item.color,
      tooltipText: item.tooltipText,
      textColor: colors.white,
    }));

    return {
      hasData: totalAmount > 0 && breakdown.length > 0,
      totalAmount,
      donutData,
      breakdown,
      topCategory: breakdown[0] ?? null,
    };
  }, [transactions, expenseCategories]);

  const largestExpenseTransaction = useMemo(() => {
    const expenseTransactions = transactions.filter(
      (item) =>
        String(item.type ?? "").toLowerCase() === "expense" &&
        !isTransferTransaction(item),
    );

    if (!expenseTransactions.length) return null;

    let largest = expenseTransactions[0];

    for (const current of expenseTransactions) {
      if (Number(current?.amount ?? 0) > Number(largest?.amount ?? 0)) {
        largest = current;
      }
    }

    return largest;
  }, [transactions]);

  const largestExpenseMeta = useMemo(() => {
    if (!largestExpenseTransaction) return null;

    const category = resolveExpenseCategory(
      expenseCategories,
      largestExpenseTransaction.category,
    );

    return {
      label: category.label,
      color: category.color,
      date: formatStatsTransactionDate(largestExpenseTransaction.date),
      amount: Number(largestExpenseTransaction.amount ?? 0),
    };
  }, [expenseCategories, largestExpenseTransaction]);

  const getWeeklyStats = useCallback(async () => {
    if (!user?.uid) return;

    setChartLoading(true);
    const res = await fetchWeeklyStats(user.uid);
    setChartLoading(false);

    if (res.success) {
      setChartData(Array.isArray(res?.data?.stats) ? res.data.stats : []);
      setTransactions(
        Array.isArray(res?.data?.transactions) ? res.data.transactions : [],
      );
    } else {
      Alert.alert("Error", res.msg);
    }
  }, [user?.uid]);

  const getMonthlyStats = useCallback(async () => {
    if (!user?.uid) return;

    setChartLoading(true);
    const res = await fetchMonthlyStats(user.uid);
    setChartLoading(false);

    if (res.success) {
      setChartData(Array.isArray(res?.data?.stats) ? res.data.stats : []);
      setTransactions(
        Array.isArray(res?.data?.transactions) ? res.data.transactions : [],
      );
    } else {
      Alert.alert("Error", res.msg);
    }
  }, [user?.uid]);

  const getYearlyStats = useCallback(async () => {
    if (!user?.uid) return;

    setChartLoading(true);
    const res = await fetchYearlyStats(user.uid);
    setChartLoading(false);

    if (res.success) {
      setChartData(Array.isArray(res?.data?.stats) ? res.data.stats : []);
      setTransactions(
        Array.isArray(res?.data?.transactions) ? res.data.transactions : [],
      );
    } else {
      Alert.alert("Error", res.msg);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    if (activeIndex === 0) {
      getWeeklyStats();
      return;
    }

    if (activeIndex === 1) {
      getMonthlyStats();
      return;
    }

    getYearlyStats();
  }, [activeIndex, getMonthlyStats, getWeeklyStats, getYearlyStats, user?.uid]);
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Header title="Statistics" />

          <ScrollView
            contentContainerStyle={{
              gap: spacingY._20,
              paddingTop: spacingY._5,
              paddingBottom: verticalScale(100),
            }}
            showsVerticalScrollIndicator={false}
          >
            <SegmentedControl
              values={["Weekly", "Monthly", "Yearly"]}
              selectedIndex={activeIndex}
              onChange={(event) => {
                setActiveIndex(event.nativeEvent.selectedSegmentIndex);
              }}
              tintColor={colors.neutral200}
              backgroundColor={colors.neutral800}
              activeFontStyle={styles.segmentFontStyle}
              style={styles.segmmentStyle}
              fontStyle={{ ...styles.segmentFontStyle, color: colors.white }}
            />
            <View style={styles.chartContainer}>
              {chartData.length > 0 ? (
                <BarChart
                  data={chartData}
                  barWidth={scale(12)}
                  spacing={[1, 2].includes(activeIndex) ? scale(25) : scale(16)}
                  roundedTop
                  roundedBottom
                  hideRules
                  formatYLabel={(value) =>
                    formatRupiah(Number(value), "compact")
                  }
                  yAxisThickness={0}
                  xAxisThickness={0}
                  yAxisLabelWidth={
                    [1, 2].includes(activeIndex) ? scale(60) : scale(70)
                  }
                  yAxisTextStyle={{ color: colors.neutral350 }}
                  xAxisLabelTextStyle={{
                    color: colors.neutral350,
                    fontSize: verticalScale(12),
                  }}
                  noOfSections={3}
                  minHeight={5}
                />
              ) : (
                <View style={styles.noChart} />
              )}
              {chartLoading && (
                <View style={styles.chartLoadingContainer}>
                  <Loading color={colors.white} />
                </View>
              )}
            </View>

            <View style={styles.insightSection}>
              <View style={styles.insightHeader}>
                <Typo size={17} fontWeight={"600"}>
                  Quick Insights
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  {periodLabels[activeIndex]}
                </Typo>
              </View>

              {insights.hasData ? (
                <>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                      <Typo size={12} color={colors.neutral400}>
                        Income
                      </Typo>
                      <Typo size={15} fontWeight={"600"} color={colors.primary}>
                        {formatRupiah(insights.totalIncome, "compact")}
                      </Typo>
                    </View>
                    <View style={styles.summaryCard}>
                      <Typo size={12} color={colors.neutral400}>
                        Expense
                      </Typo>
                      <Typo size={15} fontWeight={"600"} color={colors.rose}>
                        {formatRupiah(insights.totalExpense, "compact")}
                      </Typo>
                    </View>
                    <View style={styles.summaryCard}>
                      <Typo size={12} color={colors.neutral400}>
                        Net Cashflow
                      </Typo>
                      <Typo
                        size={15}
                        fontWeight={"600"}
                        color={insights.net >= 0 ? colors.primary : colors.rose}
                      >
                        {formatRupiah(insights.net, "compact")}
                      </Typo>
                    </View>
                    <View style={styles.summaryCard}>
                      <Typo size={12} color={colors.neutral400}>
                        Savings Rate
                      </Typo>
                      <Typo size={15} fontWeight={"600"} color={budgetColor}>
                        {insights.savingsRate >= 0 ? "+" : ""}
                        {insights.savingsRate.toFixed(1)}%
                      </Typo>
                    </View>
                  </View>

                  <View style={styles.progressCard}>
                    <View style={styles.progressLabelRow}>
                      <Typo size={12} color={colors.neutral300}>
                        Expense share
                      </Typo>
                      <Typo size={12} color={colors.neutral100}>
                        {insights.expenseRatio.toFixed(1)}%
                      </Typo>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: expenseShareWidth,
                            backgroundColor: budgetColor,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.highlightsRow}>
                    <View style={styles.highlightCard}>
                      <Typo size={11} color={colors.neutral400}>
                        Best Net
                      </Typo>
                      <Typo size={13} fontWeight={"600"}>
                        {insights.bestNetPeriod?.label}
                      </Typo>
                      <Typo size={12} color={colors.primary}>
                        {formatRupiah(
                          insights.bestNetPeriod?.net ?? 0,
                          "compact",
                        )}
                      </Typo>
                    </View>

                    <View style={styles.highlightCard}>
                      <Typo size={11} color={colors.neutral400}>
                        Highest Expense
                      </Typo>
                      <Typo size={13} fontWeight={"600"}>
                        {insights.highestExpensePeriod?.label}
                      </Typo>
                      <Typo size={12} color={colors.rose}>
                        {formatRupiah(
                          insights.highestExpensePeriod?.expense ?? 0,
                          "compact",
                        )}
                      </Typo>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyInsight}>
                  <Typo size={13} color={colors.neutral400}>
                    Add transactions to unlock your stats insights.
                  </Typo>
                </View>
              )}
            </View>

            <View style={styles.insightSection}>
              <View style={styles.insightHeader}>
                <Typo size={17} fontWeight={"600"}>
                  Expense by Category
                </Typo>
              </View>

              {expenseByCategory.hasData ? (
                <>
                  <View style={styles.donutWrapper}>
                    <PieChart
                      data={expenseByCategory.donutData}
                      donut
                      radius={scale(94)}
                      innerRadius={scale(62)}
                      innerCircleColor={colors.neutral800}
                      focusOnPress
                      sectionAutoFocus
                      isAnimated
                      showTooltip
                      persistTooltip
                      tooltipBackgroundColor={colors.neutral700}
                      tooltipBorderRadius={radius._10}
                      tooltipTextNoOfLines={1}
                      tooltipVerticalShift={verticalScale(26)}
                      tooltipHorizontalShift={scale(14)}
                      tooltipWidth={scale(56)}
                      textColor={colors.white}
                      textSize={verticalScale(11)}
                      centerLabelComponent={() => (
                        <View style={styles.donutCenter}>
                          <Typo size={11} color={colors.neutral400}>
                            Total Expense
                          </Typo>
                          <Typo size={15} fontWeight={"600"}>
                            {formatRupiah(
                              expenseByCategory.totalAmount,
                              "compact",
                            )}
                          </Typo>
                        </View>
                      )}
                    />
                  </View>

                  <View style={styles.categoryLegend}>
                    {expenseByCategory.breakdown.slice(0, 6).map((item) => (
                      <View key={item.key} style={styles.categoryLegendRow}>
                        <View style={styles.legendLeft}>
                          <View
                            style={[
                              styles.legendDot,
                              { backgroundColor: item.color },
                            ]}
                          />
                          <Typo size={13}>{item.label}</Typo>
                        </View>

                        <View style={styles.legendRight}>
                          <Typo size={12} color={colors.neutral400}>
                            {item.percentage.toFixed(1)}%
                          </Typo>
                          <Typo size={13} fontWeight={"600"}>
                            {formatRupiah(item.amount, "compact")}
                          </Typo>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.emptyInsight}>
                  <Typo size={13} color={colors.neutral400}>
                    No expense data yet for category breakdown.
                  </Typo>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Statistics;

const styles = StyleSheet.create({
  chartContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  chartLoadingContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: radius._12,
    backgroundColor: "rgba(0,0,0, 0.6)",
  },
  header: {},
  noChart: {
    backgroundColor: "rgba(0,0,0, 0.6)",
    height: verticalScale(210),
  },
  searchIcon: {
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    height: verticalScale(35),
    width: verticalScale(35),
    borderCurve: "continuous",
  },
  segmmentStyle: {
    height: scale(37),
  },
  insightSection: {
    gap: spacingY._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._12,
    borderCurve: "continuous",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacingY._10,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    gap: spacingY._5,
    borderCurve: "continuous",
  },
  progressCard: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    gap: spacingY._7,
    borderCurve: "continuous",
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTrack: {
    height: verticalScale(8),
    backgroundColor: colors.neutral700,
    borderRadius: radius._30,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius._30,
  },
  highlightsRow: {
    flexDirection: "row",
    gap: spacingX._10,
  },
  donutWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._5,
  },
  donutCenter: {
    alignItems: "center",
    gap: 2,
  },
  categoryLegend: {
    gap: spacingY._10,
  },
  categoryLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    borderCurve: "continuous",
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    flex: 1,
  },
  legendRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  legendDot: {
    width: verticalScale(10),
    height: verticalScale(10),
    borderRadius: 999,
  },
  tipCard: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    borderCurve: "continuous",
  },
  largestExpenseCard: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    borderCurve: "continuous",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacingX._10,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    gap: spacingY._5,
    borderCurve: "continuous",
  },
  emptyInsight: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    borderCurve: "continuous",
  },
  segmentFontStyle: {
    fontSize: verticalScale(13),
    fontWeight: "bold",
    color: colors.black,
  },
  container: {
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._5,
    gap: spacingY._10,
  },
});
