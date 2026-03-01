import { firestore } from "@/config/firebase";
import { expenseCategories, incomeCategories } from "@/constants/data";
import { ExpenseCategoriesType } from "@/types";
import { doc, getDoc, setDoc } from "firebase/firestore";
import * as Icons from "phosphor-react-native";

const EXPENSE_FIELD = "expenseCategories";
const INCOME_FIELD = "incomeCategories";

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
export type CategoryStorageResponse = { success: boolean; msg?: string };

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

const getCategoryField = (kind: CategoryKind) =>
  kind === "income" ? INCOME_FIELD : EXPENSE_FIELD;

const getUserDocRef = (uid: string) => doc(firestore, "users", uid);

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

const sanitizeCategoryList = <T extends StoredCategory>(items: T[]): T[] =>
  items
    .map((item) => sanitizeStoredCategory(item))
    .filter(Boolean) as T[];

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

const loadCategoriesByKind = async <T extends StoredCategory>(
  uid: string | undefined,
  kind: CategoryKind,
  defaults: T[],
): Promise<T[]> => {
  if (!uid) return defaults;

  try {
    const snap = await getDoc(getUserDocRef(uid));
    if (!snap.exists()) return defaults;

    const raw = snap.data()?.[getCategoryField(kind)];
    if (!Array.isArray(raw)) return defaults;

    return mergeWithDefaults(raw, defaults) as T[];
  } catch {
    return defaults;
  }
};

const saveCategoriesByKind = async <T extends StoredCategory>(
  uid: string | undefined,
  kind: CategoryKind,
  items: T[],
): Promise<CategoryStorageResponse> => {
  if (!uid) {
    return {
      success: false,
      msg: "You need to login first.",
    };
  }

  try {
    const sanitized = sanitizeCategoryList(items);
    await setDoc(
      getUserDocRef(uid),
      {
        [getCategoryField(kind)]: sanitized,
      },
      { merge: true },
    );
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      msg: error?.message || "Failed to save categories.",
    };
  }
};

export const loadExpenseCategories = async (
  uid?: string,
): Promise<StoredExpenseCategory[]> =>
  loadCategoriesByKind(uid, "expense", DEFAULT_EXPENSE_CATEGORIES);

export const loadIncomeCategories = async (
  uid?: string,
): Promise<StoredIncomeCategory[]> =>
  loadCategoriesByKind(uid, "income", DEFAULT_INCOME_CATEGORIES);

export const saveExpenseCategories = async (
  uid: string | undefined,
  items: StoredExpenseCategory[],
): Promise<CategoryStorageResponse> =>
  saveCategoriesByKind(uid, "expense", items);

export const saveIncomeCategories = async (
  uid: string | undefined,
  items: StoredIncomeCategory[],
): Promise<CategoryStorageResponse> =>
  saveCategoriesByKind(uid, "income", items);

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

