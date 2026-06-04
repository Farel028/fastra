import Button from "@/components/Button";
import HomeCard from "@/components/HomeCard";
import ScreenWrapper from "@/components/ScreenWrapper";
import TransactionList from "@/components/TransactionList";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import {
  loadNotificationImportManualAccess,
  loadPendingNotificationImportSummary,
} from "@/services/notificationImportStorage";
import { TransactionType } from "@/types";
import { verticalScale } from "@/utils/styling";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const homeFeatures = [
  {
    key: "debts",
    label: "Debts",
    route: "/debts",
    icon: Icons.ReceiptIcon,
  },
];

const Home = () => {
  const { user, refreshAuthSession } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [manualAccessConfirmed, setManualAccessConfirmed] = useState(false);
  const [pendingImportCount, setPendingImportCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadManualAccess = async () => {
        if (!user?.uid) {
          if (mounted) {
            setManualAccessConfirmed(false);
            setPendingImportCount(0);
          }
          return;
        }

        const [confirmed, pendingSummary] = await Promise.all([
          loadNotificationImportManualAccess(user.uid),
          loadPendingNotificationImportSummary(user.uid, 12),
        ]);
        if (mounted) {
          setManualAccessConfirmed(confirmed);
          setPendingImportCount(pendingSummary.totalCount);
        }
      };

      void loadManualAccess();

      return () => {
        mounted = false;
      };
    }, [user?.uid]),
  );

  const canFetchTransactions = Boolean(user?.uid);
  const constraints = canFetchTransactions
    ? [where("uid", "==", user?.uid), orderBy("date", "desc")]
    : [];

  const { data: recentTransaction, loading: transactionLoading } =
    useFetchData<TransactionType>(
      canFetchTransactions ? "transactions" : "",
      constraints,
      user?.uid,
    );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthSession();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthSession]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ gap: 4 }}>
            <Typo size={20} color={colors.neutral400}>
              Hi,{" "}
              <Typo size={20} fontWeight={"500"}>
                {user?.name}
              </Typo>
            </Typo>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/(modals)/searchModal")}
              style={styles.headerAction}
            >
              <Icons.MagnifyingGlassIcon
                size={verticalScale(21)}
                color={colors.neutral100}
                weight="bold"
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/notifications")}
              style={styles.headerAction}
            >
              <Icons.BellIcon
                size={verticalScale(21)}
                color={colors.neutral100}
                weight="bold"
              />
              {pendingImportCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Typo size={9} fontWeight={"900"} color={colors.black}>
                    {pendingImportCount > 99 ? "99+" : pendingImportCount}
                  </Typo>
                </View>
              ) : !manualAccessConfirmed ? (
                <View style={styles.notificationDot} />
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollViewStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.neutral800}
            />
          }
        >
          <View>
            <HomeCard />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {homeFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <View key={feature.key} style={styles.featureItem}>
                  <Button
                    style={styles.featureButton}
                    onPress={() => router.push(feature.route as any)}
                  >
                    <View style={styles.featureIconWrap}>
                      <Icon
                        size={verticalScale(24)}
                        color={colors.black}
                        weight="bold"
                      />
                    </View>
                  </Button>

                  <Typo
                    size={12}
                    color={colors.neutral300}
                    style={styles.featureLabel}
                  >
                    {feature.label}
                  </Typo>
                </View>
              );
            })}
          </ScrollView>

          <TransactionList
            data={recentTransaction}
            loading={transactionLoading}
            title="Recent Transactions"
            emptyListMessage="No transactions yet"
            showMonthYearHeader
            monthYearLocale="id-ID"
          />
        </ScrollView>

        <Button
          style={styles.floatingButton}
          onPress={() => router.push("/(modals)/transactionModal")}
        >
          <Icons.PlusIcon
            size={verticalScale(24)}
            color={colors.black}
            weight="bold"
          />
        </Button>
      </View>
    </ScreenWrapper>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
    marginTop: verticalScale(8),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: 999,
    paddingHorizontal: spacingX._10,
    height: verticalScale(44),
  },
  headerAction: {
    width: verticalScale(28),
    height: verticalScale(34),
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: verticalScale(2),
    right: verticalScale(1),
    width: verticalScale(9),
    height: verticalScale(9),
    borderRadius: verticalScale(9),
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.neutral800,
  },
  notificationBadge: {
    position: "absolute",
    top: verticalScale(-3),
    right: verticalScale(-5),
    minWidth: verticalScale(17),
    height: verticalScale(17),
    borderRadius: verticalScale(17),
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.neutral800,
  },
  floatingButton: {
    height: verticalScale(50),
    width: verticalScale(50),
    borderRadius: 100,
    position: "absolute",
    bottom: verticalScale(30),
    right: verticalScale(20),
  },
  scrollViewStyle: {
    marginTop: spacingY._10,
    paddingBottom: verticalScale(100),
    gap: spacingY._15,
  },
  featureItem: {
    width: verticalScale(68),
    alignItems: "center",
    gap: spacingY._5,
  },
  featureButton: {
    height: verticalScale(56),
    width: verticalScale(56),
    borderRadius: 100,
  },
  featureIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    textAlign: "center",
  },
});
