import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import SheetModal from "@/components/SheetModal";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useCategories } from "@/contexts/categoryContext";
import {
  CategoryIconName,
  CategoryKind,
  availableCategoryIcons,
  categoryIconMap,
  normalizeHexColor,
} from "@/services/categoryService";
import { scale, verticalScale } from "@/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const QUICK_ICON_NAMES = [
  "ShoppingCartIcon",
  "HouseIcon",
  "ForkKnifeIcon",
  "CarIcon",
  "WalletIcon",
  "MoneyWavyIcon",
  "PiggyBankIcon",
  "CalendarIcon",
  "GiftIcon",
  "CoffeeIcon",
  "MusicNotesIcon",
  "FilmStripIcon",
  "MonitorIcon",
  "BookOpenIcon",
  "AirplaneIcon",
  "HeartIcon",
  "TShirtIcon",
  "GameControllerIcon",
  "PawPrintIcon",
  "ScissorsIcon",
  "BuildingOfficeIcon",
  "GraduationCapIcon",
  "BasketballIcon",
  "BugIcon",
  "GlobeIcon",
  "LightningIcon",
  "WrenchIcon",
  "DotsThreeOutlineIcon",
];

const colorPresets = [
  "#4B5563",
  "#075985",
  "#CA8A04",
  "#B45309",
  "#0F766E",
  "#BE185D",
  "#E11D48",
  "#404040",
  "#065F46",
  "#7C3AED",
  "#A21CAF",
  "#525252",
  "#0EA5E9",
  "#16A34A",
];

const hslToHex = (h: number, s: number, l: number) => {
  const saturation = s / 100;
  const lightness = l / 100;

  const k = (n: number) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number) =>
    lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const toHex = (value: number) =>
    Math.round(255 * value)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
};

const COLOR_PICKER_COLORS = (() => {
  const all: string[] = [];

  for (let hue = 0; hue < 360; hue += 12) {
    all.push(hslToHex(hue, 90, 45));
    all.push(hslToHex(hue, 80, 55));
    all.push(hslToHex(hue, 70, 65));
  }

  ["#101010", "#262626", "#404040", "#737373", "#A3A3A3"]
    .forEach((shade) => all.push(shade));

  return Array.from(new Set(all));
})();

const getIconSearchToken = (name: string) =>
  name.replace(/Icon$/, "").toLowerCase();

const hexToRgb = (hexColor: string) => {
  const hex = normalizeHexColor(hexColor, "#525252").replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
};

const getContrastColor = (hexColor: string) => {
  const { r, g, b } = hexToRgb(hexColor);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 160 ? colors.black : colors.white;
};

const CategoryModal = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    expenseCategoryList,
    incomeCategoryList,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();

  const kindParam = first(params.kind);
  const kind: CategoryKind = kindParam === "income" ? "income" : "expense";
  const categoryList =
    kind === "income" ? incomeCategoryList : expenseCategoryList;

  const editingValue = first(params.value);
  const editingCategory = useMemo(
    () => categoryList.find((item) => item.value === editingValue),
    [categoryList, editingValue, kind],
  );

  const isEditing = Boolean(editingCategory);
  const [label, setLabel] = useState("");
  const [bgColor, setBgColor] = useState("#525252");
  const [iconName, setIconName] = useState<CategoryIconName>("DotsThreeOutlineIcon");
  const [saving, setSaving] = useState(false);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setLabel(editingCategory.label);
      setBgColor(editingCategory.bgColor);
      setIconName(
        categoryIconMap[editingCategory.iconName]
          ? editingCategory.iconName
          : "DotsThreeOutlineIcon",
      );
      return;
    }

    setLabel("");
    setBgColor("#525252");
    setIconName("DotsThreeOutlineIcon");
  }, [editingCategory]);

  const previewColor = useMemo(() => {
    const raw = String(bgColor ?? "").trim();
    return /^#?[0-9a-fA-F]{6}$/.test(raw)
      ? normalizeHexColor(raw, "#525252")
      : colors.neutral700;
  }, [bgColor]);

  const colorToSave = useMemo(
    () => normalizeHexColor(bgColor, editingCategory?.bgColor ?? "#525252"),
    [bgColor, editingCategory?.bgColor],
  );

  const quickIcons = useMemo(() => {
    const fromPreset = QUICK_ICON_NAMES.filter((name) => categoryIconMap[name]);
    if (fromPreset.length >= 24) return fromPreset.slice(0, 24);

    const more = availableCategoryIcons
      .filter((name) => !fromPreset.includes(name))
      .slice(0, 24 - fromPreset.length);

    return [...fromPreset, ...more];
  }, []);

  const filteredIcons = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return availableCategoryIcons;

    return availableCategoryIcons.filter((name) => {
      const normalized = name.toLowerCase();
      const token = getIconSearchToken(name);
      return normalized.includes(q) || token.includes(q);
    });
  }, [iconSearch]);

  const openIconPicker = () => {
    setIconSearch("");
    setIconPickerVisible(true);
  };

  const onSave = async () => {
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      Alert.alert("Category", "Category name is required");
      return;
    }

    setSaving(true);

    const res = isEditing
      ? await updateCategory(kind, editingCategory!.value, {
          label: cleanLabel,
          bgColor: colorToSave,
          iconName,
        })
      : await addCategory(kind, {
          label: cleanLabel,
          bgColor: colorToSave,
          iconName,
        });

    setSaving(false);

    if (!res.success) {
      Alert.alert("Category", res.msg ?? "Failed to save category");
      return;
    }

    router.back();
  };

  const onDelete = () => {
    if (!editingCategory || editingCategory.isDefault) return;

    Alert.alert(
      "Delete Category",
      "Delete this custom category?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            const res = await deleteCategory(kind, editingCategory.value);
            setSaving(false);

            if (!res.success) {
              Alert.alert("Category", res.msg ?? "Failed to delete category");
              return;
            }

            router.back();
          },
        },
      ],
      { cancelable: true },
    );
  };

  const PreviewIcon = categoryIconMap[iconName] ?? Icons.DotsThreeOutlineIcon;

  return (
    <ModalWrapper onClose={() => router.back()}>
      <View style={styles.container}>
        <Header
          title={
            isEditing
              ? `Update ${kind === "income" ? "Income" : "Expense"} Category`
              : `New ${kind === "income" ? "Income" : "Expense"} Category`
          }
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.previewCard}>
            <View style={[styles.previewIcon, { backgroundColor: previewColor }]}>
              <PreviewIcon size={verticalScale(22)} color={colors.white} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Typo size={16} fontWeight={"700"}>
                {label.trim() || "Category Name"}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                {isEditing
                  ? `${kind} • ${editingCategory?.value}`
                  : `${kind} • new-category`}
              </Typo>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Typo color={colors.neutral200}>Category Name</Typo>
            <Input
              placeholder="Example: Subscription"
              value={label}
              onChangeText={setLabel}
            />
          </View>

          <View style={styles.inputGroup}>
            <Typo color={colors.neutral200}>Background Color</Typo>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.colorPickerTrigger}
              onPress={() => setColorPickerVisible(true)}
            >
              <View
                style={[styles.colorPickerPreview, { backgroundColor: colorToSave }]}
              />
              <View style={{ flex: 1 }}>
                <Typo size={14} fontWeight={"700"}>
                  {colorToSave}
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  Tap to open color picker palette
                </Typo>
              </View>

              <Icons.CaretRightIcon
                size={verticalScale(16)}
                color={colors.neutral300}
                weight="bold"
              />
            </TouchableOpacity>
            <Input
              placeholder="#525252"
              value={bgColor}
              onChangeText={setBgColor}
              autoCapitalize="characters"
            />
          </View>

                  <View style={styles.inputGroup}>
          <Typo color={colors.neutral200}>Quick Colors</Typo>
          <View style={styles.colorRow}>
            {colorPresets.map((color) => {
              const active =
                normalizeHexColor(bgColor, "") === normalizeHexColor(color, "");
              return (
                <TouchableOpacity
                  key={color}
                  activeOpacity={0.85}
                  style={[
                    styles.colorChip,
                    { backgroundColor: color },
                    active && styles.colorChipActive,
                  ]}
                  onPress={() => setBgColor(color)}
                >
                  {active && (
                    <Icons.Check
                      size={verticalScale(14)}
                      color={getContrastColor(color)}
                      weight="bold"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

          <View style={styles.inputGroup}>
            <Typo color={colors.neutral200}>Icon</Typo>
            <View style={styles.iconGrid}>
              {quickIcons.map((item) => {
                const Icon = categoryIconMap[item];
                const active = item === iconName;

                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.85}
                    onPress={() => setIconName(item)}
                    style={[styles.iconBtn, active && styles.iconBtnActive]}
                  >
                    <Icon
                      size={verticalScale(18)}
                      color={active ? colors.black : colors.white}
                      weight={active ? "fill" : "regular"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.seeMoreBtn}
              onPress={openIconPicker}
            >
              <Typo size={13} color={colors.primary} fontWeight={"700"}>
                See more icons
              </Typo>
            </TouchableOpacity>
          </View>

          {!!editingCategory?.isDefault && (
            <Typo size={12} color={colors.neutral400}>
              Default category can be updated, but cannot be deleted.
            </Typo>
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        {isEditing && !editingCategory?.isDefault && !saving && (
          <Button
            onPress={onDelete}
            style={{ backgroundColor: colors.rose, paddingHorizontal: spacingX._15 }}
          >
            <Icons.Trash
              size={verticalScale(21)}
              color={colors.white}
              weight="bold"
            />
          </Button>
        )}

        <Button onPress={onSave} loading={saving} style={{ flex: 1 }}>
          <Typo color={colors.black} fontWeight={"800"}>
            {isEditing ? "Update Category" : "Add Category"}
          </Typo>
        </Button>
      </View>

      <SheetModal
        visible={iconPickerVisible}
        title="All Icons"
        onClose={() => setIconPickerVisible(false)}
      >
        <Input
          placeholder="Search icon name..."
          value={iconSearch}
          onChangeText={setIconSearch}
          icon={
            <Icons.MagnifyingGlassIcon
              size={verticalScale(18)}
              color={colors.neutral300}
              weight="bold"
            />
          }
        />

        <View style={styles.iconPickerInfoRow}>
          <Typo size={12} color={colors.neutral400}>
            {filteredIcons.length} icons
          </Typo>
        </View>

        <FlatList
          data={filteredIcons}
          keyExtractor={(item) => item}
          numColumns={6}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.iconPickerList}
          contentContainerStyle={styles.iconPickerContent}
          renderItem={({ item }) => {
            const Icon = categoryIconMap[item];
            const active = item === iconName;

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.iconPickerItem, active && styles.iconPickerItemActive]}
                onPress={() => {
                  setIconName(item);
                  setIconPickerVisible(false);
                }}
              >
                <Icon
                  size={verticalScale(21)}
                  color={active ? colors.black : colors.white}
                  weight={active ? "fill" : "regular"}
                />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Typo size={13} color={colors.neutral400} style={styles.emptyText}>
              Icon not found.
            </Typo>
          }
        />
      </SheetModal>

      <SheetModal
        visible={colorPickerVisible}
        title="Color Picker"
        onClose={() => setColorPickerVisible(false)}
      >
        <View style={styles.colorPickerHeaderCard}>
          <View style={[styles.colorPickerPreviewLarge, { backgroundColor: colorToSave }]} />
          <View style={{ flex: 1 }}>
            <Typo size={14} color={colors.neutral300}>
              Selected Color
            </Typo>
            <Typo size={17} fontWeight={"800"}>
              {colorToSave}
            </Typo>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Typo color={colors.neutral200}>Hex Color</Typo>
          <Input
            placeholder="#525252"
            value={bgColor}
            onChangeText={setBgColor}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputGroup}>
          <Typo color={colors.neutral200}>Palette</Typo>
          <ScrollView
            style={styles.colorPickerScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.colorPickerGrid}>
              {COLOR_PICKER_COLORS.map((item) => {
                const active =
                  normalizeHexColor(item, "") === normalizeHexColor(colorToSave, "");

                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.9}
                    style={[
                      styles.colorPickerChip,
                      { backgroundColor: item },
                      active && styles.colorPickerChipActive,
                    ]}
                    onPress={() => setBgColor(item)}
                  >
                    {active && (
                      <Icons.Check
                        size={verticalScale(14)}
                        color={getContrastColor(item)}
                        weight="bold"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <Button onPress={() => setColorPickerVisible(false)}>
          <Typo color={colors.black} fontWeight={"800"}>
            Done
          </Typo>
        </Button>
      </SheetModal>
    </ModalWrapper>
  );
};

export default CategoryModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  form: {
    gap: spacingY._20,
    paddingBottom: spacingY._30,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._12,
    backgroundColor: colors.neutral900,
  },
  previewIcon: {
    width: verticalScale(42),
    height: verticalScale(42),
    borderRadius: verticalScale(42),
    alignItems: "center",
    justifyContent: "center",
  },
  inputGroup: {
    gap: spacingY._7,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._10,
  },
  colorPickerTrigger: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    backgroundColor: colors.neutral900,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._12,
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  colorPickerPreview: {
    width: verticalScale(34),
    height: verticalScale(34),
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  colorChip: {
    width: verticalScale(30),
    height: verticalScale(30),
    borderRadius: verticalScale(30),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorChipActive: {
    borderColor: colors.white,
    borderWidth: 2,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._7,
  },
  iconBtn: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral800,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  seeMoreBtn: {
    alignSelf: "flex-start",
    paddingVertical: spacingY._7,
  },
  iconPickerInfoRow: {
    alignItems: "flex-end",
    marginTop: -spacingY._5,
  },
  iconPickerList: {
    maxHeight: verticalScale(390),
  },
  iconPickerContent: {
    paddingTop: spacingY._5,
    paddingBottom: spacingY._10,
  },
  iconPickerItem: {
    width: "16.6667%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacingY._7,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.neutral800,
    backgroundColor: colors.neutral900,
  },
  iconPickerItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: spacingY._20,
  },
  colorPickerHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    backgroundColor: colors.neutral900,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._10,
  },
  colorPickerPreviewLarge: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  colorPickerScroll: {
    maxHeight: verticalScale(240),
  },
  colorPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._7,
    paddingBottom: spacingY._7,
  },
  colorPickerChip: {
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorPickerChipActive: {
    borderColor: colors.white,
    borderWidth: 2,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
    borderTopWidth: 1,
  },
});
