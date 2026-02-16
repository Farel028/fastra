import { expenseCategories, incomeCategories } from "@/constants/data";
import { ExpenseCategoriesType } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Icons from "phosphor-react-native";

const EXPENSE_STORAGE_KEY = "entrack.expense_categories.v1";
const INCOME_STORAGE_KEY = "entrack.income_categories.v1";

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
export type CategoryKind = "expense" | "income";

export type StoredCategory = {
  label: string;
  value: string;
  bgColor: string;
  iconName: CategoryIconName;
  isDefault: boolean;
};

export type StoredExpenseCategory = StoredCategory;
export type StoredIncomeCategory = StoredCategory;

const defaultCategoryIconByValue: Record<string, CategoryIconName> = {
  salary: "WalletIcon",
  bonus: "GiftIcon",
  freelance: "MoneyWavyIcon",
  business: "BuildingOfficeIcon",
  investment: "PiggyBankIcon",
  refund: "ReceiptIcon",
  others_income: "CurrencyDollarSimpleIcon",
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
  fallback?: Partial<StoredCategory>,
): StoredCategory | null => {
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

export const DEFAULT_INCOME_CATEGORIES: StoredIncomeCategory[] = Object.values(
  incomeCategories,
).map((cat) => ({
  label: cat.label,
  value: cat.value,
  bgColor: cat.bgColor,
  iconName: defaultCategoryIconByValue[cat.value] ?? "DotsThreeOutlineIcon",
  isDefault: true,
}));

const mergeWithDefaults = (
  rawItems: any[],
  defaults: StoredCategory[],
): StoredCategory[] => {
  const parsed = rawItems
    .map((item) => sanitizeStoredCategory(item))
    .filter(Boolean) as StoredCategory[];

  const parsedMap = new Map<string, StoredCategory>();
  parsed.forEach((item) => {
    if (!parsedMap.has(item.value)) parsedMap.set(item.value, item);
  });

  const withDefaults = defaults.map((def) => {
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
    const raw = await AsyncStorage.getItem(EXPENSE_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPENSE_CATEGORIES;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_EXPENSE_CATEGORIES;

    return mergeWithDefaults(
      parsed,
      DEFAULT_EXPENSE_CATEGORIES,
    ) as StoredExpenseCategory[];
  } catch {
    return DEFAULT_EXPENSE_CATEGORIES;
  }
};

export const loadIncomeCategories = async (): Promise<StoredIncomeCategory[]> => {
  try {
    const raw = await AsyncStorage.getItem(INCOME_STORAGE_KEY);
    if (!raw) return DEFAULT_INCOME_CATEGORIES;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_INCOME_CATEGORIES;

    return mergeWithDefaults(
      parsed,
      DEFAULT_INCOME_CATEGORIES,
    ) as StoredIncomeCategory[];
  } catch {
    return DEFAULT_INCOME_CATEGORIES;
  }
};

export const saveExpenseCategories = async (
  items: StoredExpenseCategory[],
): Promise<void> => {
  const sanitized = items
    .map((item) => sanitizeStoredCategory(item))
    .filter(Boolean) as StoredExpenseCategory[];

  await AsyncStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(sanitized));
};

export const saveIncomeCategories = async (
  items: StoredIncomeCategory[],
): Promise<void> => {
  const sanitized = items
    .map((item) => sanitizeStoredCategory(item))
    .filter(Boolean) as StoredIncomeCategory[];

  await AsyncStorage.setItem(INCOME_STORAGE_KEY, JSON.stringify(sanitized));
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

export const createIncomeCategoryMap = (
  items: StoredIncomeCategory[],
): ExpenseCategoriesType => createExpenseCategoryMap(items);

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
