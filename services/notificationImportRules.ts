export type NativeNotificationMessage = {
  title?: string;
  text?: string;
};

export type NativeNotificationPayload = {
  time?: string | number;
  app?: string;
  title?: string;
  titleBig?: string;
  text?: string;
  subText?: string;
  summaryText?: string;
  bigText?: string;
  audioContentsURI?: string;
  imageBackgroundURI?: string;
  extraInfoText?: string;
  groupedMessages?: NativeNotificationMessage[];
  icon?: string;
  image?: string;
};

export type NotificationImportStatus =
  | "authorized"
  | "denied"
  | "unknown"
  | "unavailable";

export type BuiltInSourceAppKey =
  | "dana"
  | "ovo"
  | "gopay"
  | "shopeepay"
  | "bca"
  | "bri"
  | "mandiri"
  | "bni"
  | "btn"
  | "bsi"
  | "cimb"
  | "danamon"
  | "permata"
  | "maybank"
  | "ocbc"
  | "uob"
  | "hsbc"
  | "dbs"
  | "panin"
  | "mega"
  | "muamalat"
  | "jago"
  | "jenius"
  | "seabank"
  | "neo"
  | "allobank"
  | "blu"
  | "linebank"
  | "linkaja"
  | "astrapay"
  | "doku";

export type SourceAppKey = BuiltInSourceAppKey;

export type NotificationImportConfig = {
  enabled: boolean;
  fallbackWalletId: string | null;
  sourceWalletMappings: Partial<Record<SourceAppKey, string>>;
  blockedSourceApps: string[];
};

export type NotificationImportDebugLevel = "info" | "warn" | "error";

export type NotificationImportDebugEvent = {
  time: string;
  level: NotificationImportDebugLevel;
  stage: string;
  message: string;
  data?: unknown;
};

export type SourceRule = {
  key: SourceAppKey;
  label: string;
  aliases: string[];
  walletHints: string[];
  incomeKeywords: string[];
  expenseKeywords: string[];
  categoryIncomeKeywords: { keyword: string; value: string }[];
  categoryExpenseKeywords: { keyword: string; value: string }[];
  descriptionFields: (keyof NativeNotificationPayload)[];
};

const bankIncomeKeywords = ["kredit", "diterima", "masuk", "credit", "refund"];
const bankExpenseKeywords = [
  "debit",
  "transfer",
  "pembayaran",
  "bayar",
  "keluar",
];
const walletIncomeKeywords = [
  "top up",
  "cashback",
  "refund",
  "masuk",
  "diterima",
];
const walletExpenseKeywords = [
  "transfer",
  "bayar",
  "pembayaran",
  "keluar",
  "purchase",
];
const defaultDescriptionFields: (keyof NativeNotificationPayload)[] = [
  "titleBig",
  "title",
  "text",
  "bigText",
  "summaryText",
  "subText",
];

const createSourceRule = (
  key: SourceAppKey,
  label: string,
  aliases: string[],
  kind: "bank" | "ewallet",
): SourceRule => ({
  key,
  label,
  aliases,
  walletHints: aliases,
  incomeKeywords: kind === "bank" ? bankIncomeKeywords : walletIncomeKeywords,
  expenseKeywords: kind === "bank" ? bankExpenseKeywords : walletExpenseKeywords,
  categoryIncomeKeywords: [
    { keyword: "gaji", value: "salary" },
    { keyword: "refund", value: "refund" },
    { keyword: "cashback", value: "bonus" },
  ],
  categoryExpenseKeywords: [
    { keyword: "debit", value: "others" },
    { keyword: "bayar", value: "others" },
    { keyword: "transfer", value: "others" },
    { keyword: "tagihan", value: "utilities" },
  ],
  descriptionFields: defaultDescriptionFields,
});

export type ResolvedNotificationTransaction = {
  shouldImport: boolean;
  reason?: string;
  type?: "income" | "expense";
  amount?: number;
  category?: string;
  description?: string;
  sourceApp?: string;
  sourceLabel?: string;
  sourceKey?: SourceAppKey;
  notificationTime?: Date;
  dedupeKey?: string;
};

export type PendingNotificationImport = {
  id: string;
  createdAt: string;
  dedupeKey: string;
  sourceApp: string;
  sourceLabel: string;
  sourceKey?: SourceAppKey;
  title?: string;
  text?: string;
  bigText?: string;
  type: "income" | "expense";
  amount: number;
  category?: string;
  description?: string;
  walletId: string;
  notificationTime: string;
};

export const NOTIFICATION_SOURCE_RULES: SourceRule[] = [
  {
    key: "dana",
    label: "DANA",
    aliases: ["dana"],
    walletHints: ["dana"],
    incomeKeywords: ["top up", "isi saldo", "cashback", "refund", "masuk", "diterima"],
    expenseKeywords: ["transfer", "bayar", "pembayaran", "keluar", "top up"],
    categoryIncomeKeywords: [
      { keyword: "cashback", value: "bonus" },
      { keyword: "refund", value: "refund" },
      { keyword: "top up", value: "savings" },
      { keyword: "isi saldo", value: "savings" },
    ],
    categoryExpenseKeywords: [
      { keyword: "transfer", value: "others" },
      { keyword: "bayar", value: "others" },
      { keyword: "pembayaran", value: "others" },
      { keyword: "makan", value: "dining" },
      { keyword: "transport", value: "transportation" },
    ],
    descriptionFields: ["titleBig", "title", "text", "bigText"],
  },
  {
    key: "ovo",
    label: "OVO",
    aliases: ["ovo"],
    walletHints: ["ovo"],
    incomeKeywords: ["top up", "cashback", "refund", "masuk", "diterima"],
    expenseKeywords: ["transfer", "bayar", "payment", "keluar", "purchase"],
    categoryIncomeKeywords: [
      { keyword: "cashback", value: "bonus" },
      { keyword: "refund", value: "refund" },
      { keyword: "top up", value: "savings" },
    ],
    categoryExpenseKeywords: [
      { keyword: "bayar", value: "others" },
      { keyword: "payment", value: "others" },
      { keyword: "makanan", value: "dining" },
      { keyword: "merchant", value: "others" },
    ],
    descriptionFields: ["titleBig", "title", "text", "summaryText"],
  },
  {
    key: "gopay",
    label: "GoPay",
    aliases: ["gopay", "go pay"],
    walletHints: ["gopay", "go pay"],
    incomeKeywords: ["top up", "cashback", "refund", "masuk", "diterima"],
    expenseKeywords: ["bayar", "pembayaran", "transfer", "keluar", "purchase"],
    categoryIncomeKeywords: [
      { keyword: "cashback", value: "bonus" },
      { keyword: "refund", value: "refund" },
      { keyword: "top up", value: "savings" },
    ],
    categoryExpenseKeywords: [
      { keyword: "bayar", value: "others" },
      { keyword: "transport", value: "transportation" },
      { keyword: "makan", value: "dining" },
      { keyword: "merchant", value: "others" },
    ],
    descriptionFields: ["titleBig", "title", "text", "summaryText"],
  },
  {
    key: "shopeepay",
    label: "ShopeePay",
    aliases: ["shopeepay", "shopee pay"],
    walletHints: ["shopeepay", "shopee pay"],
    incomeKeywords: ["top up", "cashback", "refund", "masuk", "diterima"],
    expenseKeywords: ["bayar", "pembayaran", "transfer", "keluar", "purchase"],
    categoryIncomeKeywords: [
      { keyword: "cashback", value: "bonus" },
      { keyword: "refund", value: "refund" },
      { keyword: "top up", value: "savings" },
    ],
    categoryExpenseKeywords: [
      { keyword: "bayar", value: "others" },
      { keyword: "belanja", value: "others" },
      { keyword: "makanan", value: "dining" },
      { keyword: "voucher", value: "others" },
    ],
    descriptionFields: ["titleBig", "title", "text", "summaryText"],
  },
  {
    key: "bca",
    label: "BCA",
    aliases: ["bca", "mybca", "klikbca"],
    walletHints: ["bca"],
    incomeKeywords: ["kredit", "diterima", "masuk", "credit", "refund"],
    expenseKeywords: ["debit", "transfer", "pembayaran", "bayar", "keluar"],
    categoryIncomeKeywords: [
      { keyword: "gaji", value: "salary" },
      { keyword: "refund", value: "refund" },
      { keyword: "kredit", value: "salary" },
    ],
    categoryExpenseKeywords: [
      { keyword: "debit", value: "others" },
      { keyword: "transfer", value: "others" },
      { keyword: "makan", value: "dining" },
      { keyword: "transport", value: "transportation" },
      { keyword: "tagihan", value: "utilities" },
    ],
    descriptionFields: ["titleBig", "title", "text", "bigText", "subText"],
  },
  {
    key: "bri",
    label: "BRI",
    aliases: ["bri", "brimo"],
    walletHints: ["bri", "brimo"],
    incomeKeywords: ["kredit", "diterima", "masuk", "refund"],
    expenseKeywords: ["debit", "transfer", "pembayaran", "bayar", "keluar"],
    categoryIncomeKeywords: [
      { keyword: "gaji", value: "salary" },
      { keyword: "refund", value: "refund" },
      { keyword: "bonus", value: "bonus" },
    ],
    categoryExpenseKeywords: [
      { keyword: "debit", value: "others" },
      { keyword: "bayar", value: "others" },
      { keyword: "transfer", value: "others" },
      { keyword: "tagihan", value: "utilities" },
    ],
    descriptionFields: ["titleBig", "title", "text", "bigText", "subText"],
  },
  {
    key: "mandiri",
    label: "Mandiri",
    aliases: ["mandiri", "livin"],
    walletHints: ["mandiri", "livin"],
    incomeKeywords: ["kredit", "diterima", "masuk", "refund"],
    expenseKeywords: ["debit", "transfer", "pembayaran", "bayar", "keluar"],
    categoryIncomeKeywords: [
      { keyword: "gaji", value: "salary" },
      { keyword: "refund", value: "refund" },
      { keyword: "cashback", value: "bonus" },
    ],
    categoryExpenseKeywords: [
      { keyword: "debit", value: "others" },
      { keyword: "bayar", value: "others" },
      { keyword: "transfer", value: "others" },
      { keyword: "makan", value: "dining" },
      { keyword: "transport", value: "transportation" },
    ],
    descriptionFields: ["titleBig", "title", "text", "bigText", "subText"],
  },
  {
    key: "bni",
    label: "BNI",
    aliases: ["bni", "wondr"],
    walletHints: ["bni", "wondr"],
    incomeKeywords: ["kredit", "diterima", "masuk", "refund"],
    expenseKeywords: ["debit", "transfer", "pembayaran", "bayar", "keluar"],
    categoryIncomeKeywords: [
      { keyword: "gaji", value: "salary" },
      { keyword: "refund", value: "refund" },
      { keyword: "cashback", value: "bonus" },
    ],
    categoryExpenseKeywords: [
      { keyword: "debit", value: "others" },
      { keyword: "bayar", value: "others" },
      { keyword: "transfer", value: "others" },
      { keyword: "tagihan", value: "utilities" },
    ],
    descriptionFields: ["titleBig", "title", "text", "bigText", "subText"],
  },
  {
    key: "cimb",
    label: "CIMB",
    aliases: ["cimb", "octo"],
    walletHints: ["cimb", "octo"],
    incomeKeywords: ["kredit", "diterima", "masuk", "refund"],
    expenseKeywords: ["debit", "transfer", "pembayaran", "bayar", "keluar"],
    categoryIncomeKeywords: [
      { keyword: "gaji", value: "salary" },
      { keyword: "refund", value: "refund" },
      { keyword: "cashback", value: "bonus" },
    ],
    categoryExpenseKeywords: [
      { keyword: "debit", value: "others" },
      { keyword: "bayar", value: "others" },
      { keyword: "transfer", value: "others" },
      { keyword: "tagihan", value: "utilities" },
    ],
    descriptionFields: ["titleBig", "title", "text", "bigText", "subText"],
  },
  createSourceRule("btn", "BTN", ["btn"], "bank"),
  createSourceRule("bsi", "BSI", ["bsi", "bank syariah indonesia"], "bank"),
  createSourceRule("danamon", "Danamon", ["danamon"], "bank"),
  createSourceRule("permata", "PermataBank", ["permata", "permatabank"], "bank"),
  createSourceRule("maybank", "Maybank", ["maybank"], "bank"),
  createSourceRule("ocbc", "OCBC", ["ocbc"], "bank"),
  createSourceRule("uob", "UOB", ["uob"], "bank"),
  createSourceRule("hsbc", "HSBC", ["hsbc"], "bank"),
  createSourceRule("dbs", "DBS", ["dbs"], "bank"),
  createSourceRule("panin", "Panin", ["panin"], "bank"),
  createSourceRule("mega", "Bank Mega", ["mega", "bank mega"], "bank"),
  createSourceRule("muamalat", "Muamalat", ["muamalat"], "bank"),
  createSourceRule("jago", "Bank Jago", ["jago", "bank jago"], "bank"),
  createSourceRule("jenius", "Jenius", ["jenius"], "bank"),
  createSourceRule("seabank", "SeaBank", ["seabank", "sea bank"], "bank"),
  createSourceRule("neo", "Bank Neo", ["neo", "neobank", "bank neo"], "bank"),
  createSourceRule("allobank", "Allo Bank", ["allobank", "allo bank"], "bank"),
  createSourceRule("blu", "blu", ["blu", "bca digital"], "bank"),
  createSourceRule("linebank", "LINE Bank", ["linebank", "line bank"], "bank"),
  createSourceRule("linkaja", "LinkAja", ["linkaja", "link aja"], "ewallet"),
  createSourceRule("astrapay", "AstraPay", ["astrapay", "astra pay"], "ewallet"),
  createSourceRule("doku", "DOKU", ["doku"], "ewallet"),
];

export const POSITIVE_KEYWORDS = [
  "masuk",
  "diterima",
  "kredit",
  "cashback",
  "refund",
  "pengembalian",
  "gaji",
  "salary",
  "income",
];

export const NEGATIVE_KEYWORDS = [
  "keluar",
  "debit",
  "pembayaran",
  "bayar",
  "terkirim",
  "transfer",
  "top up",
  "topup",
  "charge",
  "purchase",
  "beli",
  "belanja",
  "withdraw",
  "tarik",
  "potongan",
  "terdebet",
];

export const categoryByExpenseKeyword = [
  { keyword: "grocer", value: "groceries" },
  { keyword: "makan", value: "dining" },
  { keyword: "food", value: "dining" },
  { keyword: "resto", value: "dining" },
  { keyword: "transport", value: "transportation" },
  { keyword: "parkir", value: "transportation" },
  { keyword: "listrik", value: "utilities" },
  { keyword: "air", value: "utilities" },
  { keyword: "pulsa", value: "utilities" },
  { keyword: "paket data", value: "utilities" },
  { keyword: "tagihan", value: "utilities" },
  { keyword: "sewa", value: "rent" },
  { keyword: "bill", value: "utilities" },
  { keyword: "shopping", value: "clothing" },
  { keyword: "belanja", value: "others" },
  { keyword: "top up", value: "savings" },
  { keyword: "topup", value: "savings" },
];

export const categoryByIncomeKeyword = [
  { keyword: "gaji", value: "salary" },
  { keyword: "salary", value: "salary" },
  { keyword: "bonus", value: "bonus" },
  { keyword: "cashback", value: "bonus" },
  { keyword: "refund", value: "refund" },
  { keyword: "komisi", value: "freelance" },
  { keyword: "freelance", value: "freelance" },
];
