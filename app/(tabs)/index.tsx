import Button from "@/components/Button";
import HomeCard from "@/components/HomeCard";
import ScreenWrapper from "@/components/ScreenWrapper";
import TransactionList from "@/components/TransactionList";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import { loadNotificationImportManualAccess } from "@/services/notificationImportStorage";
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
    key: "notifications",
    label: "Notifications",
    route: "/notifications",
    icon: Icons.BellIcon,
  },
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

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadManualAccess = async () => {
        if (!user?.uid) {
          if (mounted) setManualAccessConfirmed(false);
          return;
        }

        const confirmed = await loadNotificationImportManualAccess(user.uid);
        if (mounted) setManualAccessConfirmed(confirmed);
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
          <TouchableOpacity
            onPress={() => router.push("/(modals)/searchModal")}
            style={styles.searchIcon}
          >
            <Icons.MagnifyingGlassIcon
              size={verticalScale(22)}
              color={colors.neutral200}
              weight="bold"
            />
          </TouchableOpacity>
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
              const showBadge = feature.key === "notifications" && !manualAccessConfirmed;
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
                      {showBadge && (
                        <View style={styles.featureBadge}>
                          <Typo size={10} fontWeight={"900"} color={colors.white}>
                            1
                          </Typo>
                        </View>
                      )}
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
  searchIcon: {
    backgroundColor: colors.neutral700,
    padding: spacingX._10,
    borderRadius: 50,
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
  featureBadge: {
    position: "absolute",
    top: -verticalScale(8),
    right: -verticalScale(8),
    minWidth: verticalScale(18),
    height: verticalScale(18),
    borderRadius: verticalScale(18),
    paddingHorizontal: 4,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    textAlign: "center",
  },
});
