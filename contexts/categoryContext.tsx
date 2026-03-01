import { ExpenseCategoriesType } from "@/types";
import { useAuth } from "@/contexts/authContext";
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
  resetCategories: (kind?: CategoryKind) => Promise<SaveResponse>;
};

const CategoryContext = createContext<CategoryContextType | null>(null);

export const CategoryProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
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
      if (!user?.uid) {
        if (mounted) {
          setExpenseCategoryList(DEFAULT_EXPENSE_CATEGORIES);
          setIncomeCategoryList(DEFAULT_INCOME_CATEGORIES);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const [expenseData, incomeData] = await Promise.all([
        loadExpenseCategories(user.uid),
        loadIncomeCategories(user.uid),
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
  }, [user?.uid]);

  const categories = useMemo<ExpenseCategoriesType>(
    () => createExpenseCategoryMap(expenseCategoryList),
    [expenseCategoryList],
  );

  const incomeCategories = useMemo<ExpenseCategoriesType>(
    () => createIncomeCategoryMap(incomeCategoryList),
    [incomeCategoryList],
  );

  const persist = useCallback(
    async (kind: CategoryKind, next: StoredCategory[]): Promise<SaveResponse> => {
      if (!user?.uid) {
        return { success: false, msg: "Please login first." };
      }

      if (kind === "income") {
        const normalized = next as StoredIncomeCategory[];
        const saveRes = await saveIncomeCategories(user.uid, normalized);
        if (!saveRes.success) return saveRes;
        setIncomeCategoryList(normalized);
        return { success: true };
      }

      const normalized = next as StoredExpenseCategory[];
      const saveRes = await saveExpenseCategories(user.uid, normalized);
      if (!saveRes.success) return saveRes;
      setExpenseCategoryList(normalized);
      return { success: true };
    },
    [user?.uid],
  );

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

      const saveRes = await persist(kind, next);
      if (!saveRes.success) return saveRes;
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

      const saveRes = await persist(kind, next);
      if (!saveRes.success) return saveRes;
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
      const saveRes = await persist(kind, next);
      if (!saveRes.success) return saveRes;
      return { success: true };
    },
    [getListByKind, persist],
  );

  const resetCategories = useCallback(async (kind?: CategoryKind): Promise<SaveResponse> => {
    if (!user?.uid) {
      return { success: false, msg: "Please login first." };
    }

    if (!kind) {
      const [expenseRes, incomeRes] = await Promise.all([
        saveExpenseCategories(user.uid, DEFAULT_EXPENSE_CATEGORIES),
        saveIncomeCategories(user.uid, DEFAULT_INCOME_CATEGORIES),
      ]);

      if (!expenseRes.success) return expenseRes;
      if (!incomeRes.success) return incomeRes;

      setExpenseCategoryList(DEFAULT_EXPENSE_CATEGORIES);
      setIncomeCategoryList(DEFAULT_INCOME_CATEGORIES);
      return { success: true };
    }

    if (kind === "income") {
      return persist("income", DEFAULT_INCOME_CATEGORIES);
    }

    return persist("expense", DEFAULT_EXPENSE_CATEGORIES);
  }, [persist, user?.uid]);

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
