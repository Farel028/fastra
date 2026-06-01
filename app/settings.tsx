import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

const settingsItems = [
  {
    title: "Notifications",
    subtitle: "Review imported notifications",
    icon: Icons.BellIcon,
    route: "/notifications" as const,
    color: "#F59E0B",
  },
  {
    title: "Categories",
    subtitle: "Check and update expense categories",
    icon: Icons.GearSixIcon,
    route: "/categories" as const,
    color: "#0EA5E9",
  },
  {
    title: "Notif Import",
    subtitle: "Auto read bank and e-wallet notifications",
    icon: Icons.BellIcon,
    route: "/notification-import" as const,
    color: "#22C55E",
  },
];

const Settings = () => {
  const router = useRouter();

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Settings"
          leftIcon={<BackButton />}
          style={{ marginVertical: spacingY._10 }}
        />

        <View style={styles.list}>
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.title}
                activeOpacity={0.88}
                style={styles.item}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.iconWrap, { backgroundColor: item.color }]}>
                  <Icon
                    size={verticalScale(22)}
                    color={colors.white}
                    weight="fill"
                  />
                </View>

                <View style={styles.itemText}>
                  <Typo size={16} fontWeight={"700"}>
                    {item.title}
                  </Typo>
                  <Typo size={13} color={colors.neutral400}>
                    {item.subtitle}
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
    </ScreenWrapper>
  );
};

export default Settings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  list: {
    marginTop: spacingY._15,
    gap: spacingY._12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    backgroundColor: colors.neutral900,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._12,
  },
  iconWrap: {
    width: verticalScale(42),
    height: verticalScale(42),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    flex: 1,
    gap: verticalScale(2),
  },
});
