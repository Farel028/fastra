import { Href } from "expo-router";
import { Firestore, Timestamp } from "firebase/firestore";
import { Icon } from "phosphor-react-native";
import React, { ReactNode } from "react";
import {
  ActivityIndicator,
  ActivityIndicatorProps,
  ImageStyle,
  PressableProps,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";

export type ScreenWrapperProps = {
  style?: ViewStyle;
  children: React.ReactNode;
};
export type ModalWrapperProps = {
  style?: ViewStyle;
  children: React.ReactNode;
  bg?: string;
};
export type accountOptionType = {
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  routeName?: any;
};

export type TypoProps = TextProps & {
  size?: number;
  color?: string;
  fontWeight?: TextStyle["fontWeight"];
  children: any | null;
  style?: TextStyle;
  textProps?: TextProps;
};

export type IconComponent = React.ComponentType<{
  height?: number;
  width?: number;
  strokeWidth?: number;
  color?: string;
  fill?: string;
}>;

export type IconProps = {
  name: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
};

export type HeaderProps = {
  title?: string;
  style?: ViewStyle;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export type BackButtonProps = {
  style?: ViewStyle;
  iconSize?: number;
};

export type TransactionType = {
  id?: string;
  type: string;
  amount: number;
  category?: string;
  date: Date | Timestamp | string;
  description?: string;
  image?: any;
  uid?: string;
  walletId: string;
  autoImported?: boolean;
  autoImportSource?: string;
  autoImportSourceLabel?: string;
  autoImportDedupeKey?: string;
};

export type CategoryType = {
  label: string;
  value: string;
  icon: Icon;
  bgColor: string;
};
export type ExpenseCategoriesType = {
  [key: string]: CategoryType;
};

export type TransactionListType = {
  data: TransactionType[];
  title?: string;
  loading?: boolean;
  emptyListMessage?: string;
  fitParent?: boolean;
  disableItemAnimation?: boolean;
  showMonthYearHeader?: boolean;
  monthYearLocale?: string;
};

export type TransactionItemProps = {
  item: TransactionType;
  index: number;
  handleClick: Function;
  disableAnimation?: boolean;
  descriptionText?: string;
};

export interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  inputRef?: React.RefObject<TextInput>;
  //   label?: string;
  //   error?: string;
}

export interface CustomButtonProps extends TouchableOpacityProps {
  style?: ViewStyle;
  onPress?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}

export type ImageUploadProps = {
  file?: any;
  onSelect: (file: any) => void;
  onClear: () => void;
  containerStyle?: ViewStyle;
  imageStyle?: ViewStyle;
  placeholder?: string;
};

export type UserType = {
  uid?: string;
  email?: string | null;
  name: string | null;
  username?: string | null;
  image?: any;
} | null;

export type UserDataType = {
  name: string;
  image?: any;
};

export type AuthActionCode =
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_CREDENTIALS"
  | "INVALID_EMAIL"
  | "INVALID_USERNAME"
  | "TOO_MANY_REQUESTS"
  | "USER_NOT_FOUND"
  | "USERNAME_IN_USE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type AuthActionResponse = {
  success: boolean;
  msg?: string;
  code?: AuthActionCode;
};

export type AuthContextType = {
  user: UserType;
  setUser: Function;
  login: (identifier: string, password: string) => Promise<AuthActionResponse>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<AuthActionResponse>;
  resendVerificationEmail: (
    identifier: string,
    password: string
  ) => Promise<AuthActionResponse>;
  forgotPassword: (email: string) => Promise<AuthActionResponse>;
  updateUserData: (userId: string) => Promise<void>;
  refreshAuthSession: () => Promise<AuthActionResponse>;
};

export type ResponseType = {
  success: boolean;
  data?: any;
  msg?: string;
};

export type WalletType = {
  id?: string;
  name: string;
  amount?: number;
  totalIncome?: number;
  totalExpenses?: number;
  image: any;
  uid?: string;
  created?: Date;
  isSystem?: boolean;
  hidden?: boolean;
};

export type DebtKind = "HUTANG" | "PIUTANG";

export type DebtType = {
  id?: string;
  uid: string;
  kind: DebtKind;
  personName: string;
  amount: number;
  paidAmount: number;
  date?: Date | null;
  dueDate?: Date | null;
  walletId: string;
  note?: string;
  status: "ONGOING" | "PAID";
  created?: any;
  updated?: any;
};
