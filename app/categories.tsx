import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useCategories } from "@/contexts/categoryContext";
import { categoryIconMap } from "@/services/categoryService";
import { verticalScale } from "@/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const Categories = () => {
  const router = useRouter();
  const { categoryList, loading, resetCategories } = useCategories();

  const onOpenModal = (value?: string) => {
    router.push({
      pathname: "/(modals)/categoryModal",
      params: value ? { value } : {},
    });
  };

  const onReset = () => {
    Alert.alert(
      "Reset Categories",
      "This will restore all category labels, colors, and icons to default.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetCategories();
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Categories"
          leftIcon={<BackButton />}
          style={{ marginVertical: spacingY._10 }}
        />

        <View style={styles.topActionRow}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.topBtn, styles.topBtnPrimary]}
            onPress={() => onOpenModal()}
          >
            <Icons.PlusIcon size={verticalScale(16)} color={colors.black} weight="bold" />
            <Typo size={13} color={colors.black} fontWeight={"800"}>
              Add Category
            </Typo>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.topBtn}
            onPress={onReset}
          >
            <Icons.PowerIcon
              size={verticalScale(16)}
              color={colors.white}
              weight="bold"
            />
            <Typo size={13} fontWeight={"700"}>
              Reset Default
            </Typo>
          </TouchableOpacity>
        </View>

        <Typo size={13} color={colors.neutral400} style={styles.subtext}>
          Default categories stay available. You can edit their look and add your
          own categories.
        </Typo>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {categoryList.map((item) => {
            const Icon = categoryIconMap[item.iconName];
            return (
              <View key={item.value} style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: item.bgColor }]}>
                  <Icon size={verticalScale(20)} color={colors.white} weight="fill" />
                </View>

                <View style={styles.rowText}>
                  <Typo size={15} fontWeight={"700"}>
                    {item.label}
                  </Typo>
                  <Typo size={12} color={colors.neutral400}>
                    {item.value}
                  </Typo>
                </View>

                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: item.isDefault ? colors.neutral700 : "#134E4A",
                    },
                  ]}
                >
                  <Typo size={11} fontWeight={"700"}>
                    {item.isDefault ? "Default" : "Custom"}
                  </Typo>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.editBtn}
                  onPress={() => onOpenModal(item.value)}
                >
                  <Icons.PencilSimpleLine
                    size={verticalScale(16)}
                    color={colors.white}
                    weight="bold"
                  />
                </TouchableOpacity>
              </View>
            );
          })}

          {!loading && categoryList.length === 0 && (
            <Typo size={14} color={colors.neutral400} style={{ textAlign: "center" }}>
              No categories found.
            </Typo>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default Categories;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  topActionRow: {
    flexDirection: "row",
    gap: spacingX._10,
    marginTop: spacingY._10,
  },
  topBtn: {
    flex: 1,
    height: verticalScale(42),
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral800,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
  },
  topBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subtext: {
    marginTop: spacingY._10,
  },
  list: {
    paddingTop: spacingY._15,
    paddingBottom: spacingY._40,
    gap: spacingY._10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    backgroundColor: colors.neutral900,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._10,
  },
  iconWrap: {
    width: verticalScale(38),
    height: verticalScale(38),
    borderRadius: verticalScale(38),
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    borderRadius: radius._10,
    paddingHorizontal: spacingX._7,
    paddingVertical: spacingY._5,
  },
  editBtn: {
    width: verticalScale(34),
    height: verticalScale(34),
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral800,
    alignItems: "center",
    justifyContent: "center",
  },
});
