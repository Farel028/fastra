import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const legalItems = [
  {
    title: "Privacy Policy",
    subtitle: "How your financial and notification data is handled",
    icon: Icons.ShieldCheckIcon,
    doc: "privacy",
    color: "#0EA5E9",
  },
  {
    title: "Terms of Use",
    subtitle: "Rules and responsibility when using Fastra",
    icon: Icons.FileTextIcon,
    doc: "terms",
    color: "#22C55E",
  },
  {
    title: "Changelog",
    subtitle: "See what changed in recent updates",
    icon: Icons.ListChecksIcon,
    doc: "changelog",
    color: "#F59E0B",
  },
];

const About = () => {
  const router = useRouter();

  const openWebsite = () => {
    Linking.openURL("https://fastra.my.id");
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="About"
          leftIcon={<BackButton />}
          style={{ marginVertical: spacingY._10 }}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logoMark}
              contentFit="cover"
              transition={100}
            />

            <View style={styles.brandText}>
              <Typo size={28} fontWeight={"900"}>
                Fastra
              </Typo>
              <Typo size={14} color={colors.neutral400}>
                Personal finance tracking for wallets, transactions, debts, and
                notification imports.
              </Typo>
            </View>

            <View style={styles.versionBadge}>
              <Typo size={12} color={colors.black} fontWeight={"900"}>
                v2.0.3
              </Typo>
            </View>
          </View>

          <View style={styles.list}>
            {legalItems.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.title}
                  activeOpacity={0.88}
                  style={styles.item}
                  onPress={() =>
                    router.push({
                      pathname: "/legal",
                      params: { doc: item.doc },
                    } as any)
                  }
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

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.websiteButton}
            onPress={openWebsite}
          >
            <Icons.GlobeHemisphereEastIcon
              size={verticalScale(18)}
              color={colors.black}
              weight="bold"
            />
            <Typo size={14} color={colors.black} fontWeight={"900"}>
              fastra.my.id
            </Typo>
            <Icons.ArrowSquareOutIcon
              size={verticalScale(16)}
              color={colors.black}
              weight="bold"
            />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default About;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  content: {
    paddingTop: spacingY._10,
    paddingBottom: spacingY._40,
  },
  brandBlock: {
    gap: spacingY._12,
  },
  logoMark: {
    width: verticalScale(72),
    height: verticalScale(72),
    borderRadius: radius._20,
    backgroundColor: colors.neutral900,
  },
  brandText: {
    gap: spacingY._5,
  },
  versionBadge: {
    alignSelf: "flex-start",
    borderRadius: radius._30,
    backgroundColor: colors.primary,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._5,
  },
  list: {
    marginTop: spacingY._25,
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
  websiteButton: {
    marginTop: spacingY._20,
    height: verticalScale(46),
    borderRadius: radius._15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacingX._7,
  },
});
