import { expenseCategories } from "@/constants/data";
import { ExpenseCategoriesType } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Icons from "phosphor-react-native";

const STORAGE_KEY = "entrack.expense_categories.v1";

const isPhosphorIcon = (
  key: string,
  value: unknown,
): value is Icons.Icon =>
  key.endsWith("Icon") && typeof value === "function";

export const categoryIconMap: Record<string, Icons.Icon> = Object.entries(
  Icons,
).reduce(
  (acc, [key, value]) => {
    if (isPhosphorIcon(key, value)) {
      acc[key] = value;
    }
    return acc;
  },
  {} as Record<string, Icons.Icon>,
);

export type CategoryIconName = string;

export type StoredExpenseCategory = {
  label: string;
  value: string;
  bgColor: string;
  iconName: CategoryIconName;
  isDefault: boolean;
};

const defaultCategoryIconByValue: Record<string, CategoryIconName> = {
  groceries: "ShoppingCartIcon",
  rent: "HouseIcon",
  utilities: "LightbulbIcon",
  transportation: "CarIcon",
  entertainment: "FilmStripIcon",
  dining: "ForkKnifeIcon",
  health: "HeartIcon",
  insurance: "ShieldCheckIcon",
  savings: "PiggyBankIcon",
  clothing: "TShirtIcon",
  personal: "UserIcon",
  others: "DotsThreeOutlineIcon",
};

export const availableCategoryIcons = Object.keys(
  categoryIconMap,
).sort((a, b) => a.localeCompare(b));

const isIconName = (value: unknown): value is CategoryIconName =>
  typeof value === "string" && value in categoryIconMap;

const normalizeLabel = (value: unknown) => String(value ?? "").trim();

const slugify = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normalizeHexColor = (
  value: unknown,
  fallback = "#525252",
): string => {
  const hex = String(value ?? "")
    .trim()
    .replace(/^#/, "");

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }

  return fallback;
};

const sanitizeStoredCategory = (
  raw: any,
  fallback?: Partial<StoredExpenseCategory>,
): StoredExpenseCategory | null => {
  const value = slugify(raw?.value ?? fallback?.value);
  const label = normalizeLabel(raw?.label ?? fallback?.label);

  if (!value || !label) return null;

  const fallbackColor = fallback?.bgColor ?? "#525252";
  const iconName = isIconName(raw?.iconName)
    ? raw.iconName
    : isIconName(fallback?.iconName)
      ? fallback.iconName
      : "DotsThreeOutlineIcon";

  return {
    value,
    label,
    bgColor: normalizeHexColor(raw?.bgColor, fallbackColor),
    iconName,
    isDefault: Boolean(raw?.isDefault ?? fallback?.isDefault),
  };
};

export const DEFAULT_EXPENSE_CATEGORIES: StoredExpenseCategory[] = Object.values(
  expenseCategories,
).map((cat) => ({
  label: cat.label,
  value: cat.value,
  bgColor: cat.bgColor,
  iconName: defaultCategoryIconByValue[cat.value] ?? "DotsThreeOutlineIcon",
  isDefault: true,
}));

const mergeWithDefaults = (rawItems: any[]): StoredExpenseCategory[] => {
  const parsed = rawItems
    .map((item) => sanitizeStoredCategory(item))
    .filter(Boolean) as StoredExpenseCategory[];

  const parsedMap = new Map<string, StoredExpenseCategory>();
  parsed.forEach((item) => {
    if (!parsedMap.has(item.value)) parsedMap.set(item.value, item);
  });

  const withDefaults = DEFAULT_EXPENSE_CATEGORIES.map((def) => {
    const maybe = parsedMap.get(def.value);
    if (!maybe) return def;

    return {
      ...def,
      label: maybe.label,
      bgColor: maybe.bgColor,
      iconName: maybe.iconName,
      isDefault: true,
    };
  });

  const reserved = new Set(withDefaults.map((item) => item.value));
  const custom = parsed
    .filter((item) => !reserved.has(item.value))
    .map((item) => ({ ...item, isDefault: false }));

  return [...withDefaults, ...custom];
};

export const loadExpenseCategories = async (): Promise<
  StoredExpenseCategory[]
> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EXPENSE_CATEGORIES;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_EXPENSE_CATEGORIES;

    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_EXPENSE_CATEGORIES;
  }
};

export const saveExpenseCategories = async (
  items: StoredExpenseCategory[],
): Promise<void> => {
  const sanitized = items
    .map((item) => sanitizeStoredCategory(item))
    .filter(Boolean) as StoredExpenseCategory[];

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
};

export const createExpenseCategoryMap = (
  items: StoredExpenseCategory[],
): ExpenseCategoriesType => {
  const map: ExpenseCategoriesType = {};

  items.forEach((item) => {
    const iconName = isIconName(item.iconName)
      ? item.iconName
      : "DotsThreeOutlineIcon";

    map[item.value] = {
      label: item.label,
      value: item.value,
      icon: categoryIconMap[iconName],
      bgColor: item.bgColor,
    };
  });

  return map;
};

export const buildUniqueCategoryValue = (
  label: string,
  existingValues: string[],
): string => {
  const base = slugify(label) || "category";
  const taken = new Set(existingValues);
  if (!taken.has(base)) return base;

  let next = 2;
  let candidate = `${base}-${next}`;

  while (taken.has(candidate)) {
    next += 1;
    candidate = `${base}-${next}`;
  }

  return candidate;
};
