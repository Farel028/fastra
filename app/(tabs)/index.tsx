import Button from "@/components/Button";
import HomeCard from "@/components/HomeCard";
import ScreenWrapper from "@/components/ScreenWrapper";
import TransactionList from "@/components/TransactionList";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import { TransactionType } from "@/types";
import { verticalScale } from "@/utils/styling";
import { useRouter } from "expo-router";
import { limit, orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

const homeFeatures = [
  {
    key: "debts",
    label: "Debts",
    route: "/debts",
    icon: Icons.ReceiptIcon,
  },
];

const Home = () => {
  const { user } = useAuth();
  const router = useRouter();

  const constraints = [
    where("uid", "==", user?.uid),
    orderBy("date", "desc"),
    limit(30),
  ];

  const { data: recentTransaction, loading: transactionLoading } =
    useFetchData<TransactionType>("transactions", constraints);
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
                    <Icon
                      size={verticalScale(24)}
                      color={colors.black}
                      weight="bold"
                    />
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
  featureLabel: {
    textAlign: "center",
  },
});
