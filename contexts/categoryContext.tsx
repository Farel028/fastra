import { ExpenseCategoriesType } from "@/types";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CategoryIconName,
  CategoryKind,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  StoredCategory,
  StoredExpenseCategory,
  StoredIncomeCategory,
  buildUniqueCategoryValue,
  createExpenseCategoryMap,
  createIncomeCategoryMap,
  loadExpenseCategories,
  loadIncomeCategories,
  normalizeHexColor,
  saveExpenseCategories,
  saveIncomeCategories,
} from "@/services/categoryService";

type SaveResponse = { success: boolean; msg?: string };
type AddResponse = SaveResponse & { value?: string };

type AddCategoryInput = {
  label: string;
  bgColor: string;
  iconName: CategoryIconName;
};

type UpdateCategoryInput = Partial<{
  label: string;
  bgColor: string;
  iconName: CategoryIconName;
}>;

type CategoryContextType = {
  categoryList: StoredExpenseCategory[]; // legacy alias for expense categories
  expenseCategoryList: StoredExpenseCategory[];
  incomeCategoryList: StoredIncomeCategory[];
  categories: ExpenseCategoriesType;
  incomeCategories: ExpenseCategoriesType;
  loading: boolean;
  addCategory: (kind: CategoryKind, input: AddCategoryInput) => Promise<AddResponse>;
  updateCategory: (
    kind: CategoryKind,
    value: string,
    input: UpdateCategoryInput,
  ) => Promise<SaveResponse>;
  deleteCategory: (kind: CategoryKind, value: string) => Promise<SaveResponse>;
  resetCategories: (kind?: CategoryKind) => Promise<void>;
};

const CategoryContext = createContext<CategoryContextType | null>(null);

export const CategoryProvider = ({ children }: { children: React.ReactNode }) => {
  const [expenseCategoryList, setExpenseCategoryList] = useState<
    StoredExpenseCategory[]
  >(
    DEFAULT_EXPENSE_CATEGORIES,
  );
  const [incomeCategoryList, setIncomeCategoryList] = useState<
    StoredIncomeCategory[]
  >(DEFAULT_INCOME_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const [expenseData, incomeData] = await Promise.all([
        loadExpenseCategories(),
        loadIncomeCategories(),
      ]);
      if (mounted) {
        setExpenseCategoryList(expenseData);
        setIncomeCategoryList(incomeData);
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo<ExpenseCategoriesType>(
    () => createExpenseCategoryMap(expenseCategoryList),
    [expenseCategoryList],
  );

  const incomeCategories = useMemo<ExpenseCategoriesType>(
    () => createIncomeCategoryMap(incomeCategoryList),
    [incomeCategoryList],
  );

  const persist = useCallback(async (kind: CategoryKind, next: StoredCategory[]) => {
    if (kind === "income") {
      const normalized = next as StoredIncomeCategory[];
      setIncomeCategoryList(normalized);
      await saveIncomeCategories(normalized);
      return;
    }

    const normalized = next as StoredExpenseCategory[];
    setExpenseCategoryList(normalized);
    await saveExpenseCategories(normalized);
  }, []);

  const getListByKind = useCallback(
    (kind: CategoryKind): StoredCategory[] =>
      kind === "income" ? incomeCategoryList : expenseCategoryList,
    [expenseCategoryList, incomeCategoryList],
  );

  const addCategory = useCallback(
    async (kind: CategoryKind, input: AddCategoryInput): Promise<AddResponse> => {
      const label = String(input.label ?? "").trim();
      if (!label) return { success: false, msg: "Category name is required" };

      const categoryList = getListByKind(kind);
      const value = buildUniqueCategoryValue(
        label,
        categoryList.map((item) => item.value),
      );

      const next: StoredCategory[] = [
        ...categoryList,
        {
          label,
          value,
          bgColor: normalizeHexColor(input.bgColor, "#525252"),
          iconName: input.iconName,
          isDefault: false,
        },
      ];

      await persist(kind, next);
      return { success: true, value };
    },
    [getListByKind, persist],
  );

  const updateCategory = useCallback(
    async (
      kind: CategoryKind,
      value: string,
      input: UpdateCategoryInput,
    ): Promise<SaveResponse> => {
      const normalizedValue = String(value ?? "").trim();
      const categoryList = getListByKind(kind);
      const target = categoryList.find((item) => item.value === normalizedValue);
      if (!target) return { success: false, msg: "Category not found" };

      const label =
        typeof input.label === "string" ? input.label.trim() : target.label;
      if (!label) return { success: false, msg: "Category name is required" };

      const next = categoryList.map((item) => {
        if (item.value !== normalizedValue) return item;

        return {
          ...item,
          label,
          bgColor: normalizeHexColor(input.bgColor, item.bgColor),
          iconName: input.iconName ?? item.iconName,
        };
      });

      await persist(kind, next);
      return { success: true };
    },
    [getListByKind, persist],
  );

  const deleteCategory = useCallback(
    async (kind: CategoryKind, value: string): Promise<SaveResponse> => {
      const normalizedValue = String(value ?? "").trim();
      const categoryList = getListByKind(kind);
      const target = categoryList.find((item) => item.value === normalizedValue);
      if (!target) return { success: false, msg: "Category not found" };
      if (target.isDefault) {
        return { success: false, msg: "Default category cannot be deleted" };
      }

      const next = categoryList.filter((item) => item.value !== normalizedValue);
      await persist(kind, next);

      return { success: true };
    },
    [getListByKind, persist],
  );

  const resetCategories = useCallback(async (kind?: CategoryKind) => {
    if (!kind) {
      setExpenseCategoryList(DEFAULT_EXPENSE_CATEGORIES);
      setIncomeCategoryList(DEFAULT_INCOME_CATEGORIES);
      await Promise.all([
        saveExpenseCategories(DEFAULT_EXPENSE_CATEGORIES),
        saveIncomeCategories(DEFAULT_INCOME_CATEGORIES),
      ]);
      return;
    }

    if (kind === "income") {
      await persist("income", DEFAULT_INCOME_CATEGORIES);
      return;
    }

    await persist("expense", DEFAULT_EXPENSE_CATEGORIES);
  }, [persist]);

  return (
    <CategoryContext.Provider
      value={{
        categoryList: expenseCategoryList,
        expenseCategoryList,
        incomeCategoryList,
        categories,
        incomeCategories,
        loading,
        addCategory,
        updateCategory,
        deleteCategory,
        resetCategories,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error("useCategories must be used within CategoryProvider");
  }
  return context;
};
