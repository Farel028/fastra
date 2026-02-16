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
  DEFAULT_EXPENSE_CATEGORIES,
  StoredExpenseCategory,
  buildUniqueCategoryValue,
  createExpenseCategoryMap,
  loadExpenseCategories,
  normalizeHexColor,
  saveExpenseCategories,
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
  categoryList: StoredExpenseCategory[];
  categories: ExpenseCategoriesType;
  loading: boolean;
  addCategory: (input: AddCategoryInput) => Promise<AddResponse>;
  updateCategory: (
    value: string,
    input: UpdateCategoryInput,
  ) => Promise<SaveResponse>;
  deleteCategory: (value: string) => Promise<SaveResponse>;
  resetCategories: () => Promise<void>;
};

const CategoryContext = createContext<CategoryContextType | null>(null);

export const CategoryProvider = ({ children }: { children: React.ReactNode }) => {
  const [categoryList, setCategoryList] = useState<StoredExpenseCategory[]>(
    DEFAULT_EXPENSE_CATEGORIES,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const data = await loadExpenseCategories();
      if (mounted) {
        setCategoryList(data);
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo<ExpenseCategoriesType>(
    () => createExpenseCategoryMap(categoryList),
    [categoryList],
  );

  const persist = useCallback(async (next: StoredExpenseCategory[]) => {
    setCategoryList(next);
    await saveExpenseCategories(next);
  }, []);

  const addCategory = useCallback(
    async (input: AddCategoryInput): Promise<AddResponse> => {
      const label = String(input.label ?? "").trim();
      if (!label) return { success: false, msg: "Category name is required" };

      const value = buildUniqueCategoryValue(
        label,
        categoryList.map((item) => item.value),
      );

      const next: StoredExpenseCategory[] = [
        ...categoryList,
        {
          label,
          value,
          bgColor: normalizeHexColor(input.bgColor, "#525252"),
          iconName: input.iconName,
          isDefault: false,
        },
      ];

      await persist(next);
      return { success: true, value };
    },
    [categoryList, persist],
  );

  const updateCategory = useCallback(
    async (value: string, input: UpdateCategoryInput): Promise<SaveResponse> => {
      const normalizedValue = String(value ?? "").trim();
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

      await persist(next);
      return { success: true };
    },
    [categoryList, persist],
  );

  const deleteCategory = useCallback(
    async (value: string): Promise<SaveResponse> => {
      const normalizedValue = String(value ?? "").trim();
      const target = categoryList.find((item) => item.value === normalizedValue);
      if (!target) return { success: false, msg: "Category not found" };
      if (target.isDefault) {
        return { success: false, msg: "Default category cannot be deleted" };
      }

      const next = categoryList.filter((item) => item.value !== normalizedValue);
      await persist(next);

      return { success: true };
    },
    [categoryList, persist],
  );

  const resetCategories = useCallback(async () => {
    await persist(DEFAULT_EXPENSE_CATEGORIES);
  }, [persist]);

  return (
    <CategoryContext.Provider
      value={{
        categoryList,
        categories,
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
