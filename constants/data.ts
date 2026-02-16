import { CategoryType, ExpenseCategoriesType } from "@/types";
import { colors } from "./theme";

import * as Icons from "phosphor-react-native"; // Import all icons dynamically

export const expenseCategories: ExpenseCategoriesType = {
  groceries: {
    label: "Groceries",
    value: "groceries",
    icon: Icons.ShoppingCartIcon,
    bgColor: "#4B5563", // Deep Teal Green
  },
  rent: {
    label: "Rent",
    value: "rent",
    icon: Icons.HouseIcon,
    bgColor: "#075985", // Dark Blue
  },
  utilities: {
    label: "Utilities",
    value: "utilities",
    icon: Icons.LightbulbIcon,
    bgColor: "#ca8a04", // Dark Golden Brown
  },
  transportation: {
    label: "Transportation",
    value: "transportation",
    icon: Icons.CarIcon,
    bgColor: "#b45309", // Dark Orange-Red
  },
  entertainment: {
    label: "Entertainment",
    value: "entertainment",
    icon: Icons.FilmStripIcon,
    bgColor: "#0f766e", // Darker Red-Brown
  },
  dining: {
    label: "Dining",
    value: "dining",
    icon: Icons.ForkKnifeIcon,
    bgColor: "#be185d", // Dark Red
  },
  health: {
    label: "Health",
    value: "health",
    icon: Icons.HeartIcon,
    bgColor: "#e11d48", // Dark Purple
  },
  insurance: {
    label: "Insurance",
    value: "insurance",
    icon: Icons.ShieldCheckIcon,
    bgColor: "#404040", // Dark Gray
  },
  savings: {
    label: "Savings",
    value: "savings",
    icon: Icons.PiggyBankIcon,
    bgColor: "#065F46", // Deep Teal Green
  },
  clothing: {
    label: "Clothing",
    value: "clothing",
    icon: Icons.TShirtIcon,
    bgColor: "#7c3aed", // Dark Indigo
  },
  personal: {
    label: "Personal",
    value: "personal",
    icon: Icons.UserIcon,
    bgColor: "#a21caf", // Deep Pink
  },
  others: {
    label: "Others",
    value: "others",
    icon: Icons.DotsThreeOutlineIcon,
    bgColor: "#525252", // Neutral Dark Gray
  },
};

export const incomeCategories: ExpenseCategoriesType = {
  salary: {
    label: "Salary",
    value: "salary",
    icon: Icons.WalletIcon,
    bgColor: "#16A34A",
  },
  bonus: {
    label: "Bonus",
    value: "bonus",
    icon: Icons.GiftIcon,
    bgColor: "#0EA5E9",
  },
  freelance: {
    label: "Freelance",
    value: "freelance",
    icon: Icons.MoneyWavyIcon,
    bgColor: "#22C55E",
  },
  business: {
    label: "Business",
    value: "business",
    icon: Icons.BuildingOfficeIcon,
    bgColor: "#0284C7",
  },
  investment: {
    label: "Investment",
    value: "investment",
    icon: Icons.PiggyBankIcon,
    bgColor: "#0F766E",
  },
  refund: {
    label: "Refund",
    value: "refund",
    icon: Icons.ReceiptIcon,
    bgColor: "#14B8A6",
  },
  others_income: {
    label: "Others",
    value: "others_income",
    icon: Icons.CurrencyDollarSimpleIcon,
    bgColor: "#525252",
  },
};

// Compatibility fallback for older income transactions that have no category.
export const incomeCategory: CategoryType = incomeCategories.salary;

export const transferCategory: CategoryType = {
  label: "Transfer",
  value: "transfer",
  icon: Icons.WalletIcon,
  bgColor: "#0EA5E9",
};

export const debtCategory: CategoryType = {
  label: "Debt",
  value: "debt",
  icon: Icons.ReceiptIcon,
  bgColor: "#F59E0B",
};

export const transactionTypes = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
];
