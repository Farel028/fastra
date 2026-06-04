import {
  categoryByExpenseKeyword,
  categoryByIncomeKeyword,
  NEGATIVE_KEYWORDS,
  NativeNotificationPayload,
  NOTIFICATION_SOURCE_RULES,
  POSITIVE_KEYWORDS,
  ResolvedNotificationTransaction,
  SourceAppKey,
  SourceRule,
} from "@/services/notificationImportRules";

const normalizeWhitespace = (value?: unknown): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeText = (value?: unknown): string =>
  normalizeWhitespace(value).toLowerCase();

const simpleHash = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseRawNotification = (
  raw: string | Record<string, unknown>,
): NativeNotificationPayload | null => {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (isJsonObject(parsed)) return parsed as NativeNotificationPayload;
      return null;
    } catch {
      return null;
    }
  }

  return isJsonObject(raw) ? (raw as NativeNotificationPayload) : null;
};

export const getSourceRule = (text: string): SourceRule | null => {
  return getSourceRuleFromList(text, NOTIFICATION_SOURCE_RULES);
};

export const getSourceRuleFromList = (
  text: string,
  sourceRules: SourceRule[],
): SourceRule | null => {
  const normalized = text.toLowerCase();
  return (
    sourceRules.find((rule) =>
      rule.aliases.some((keyword) => normalized.includes(keyword)),
    ) ?? null
  );
};

export const getSourceKey = (
  payload: NativeNotificationPayload,
  text: string,
  sourceRules = NOTIFICATION_SOURCE_RULES,
): SourceAppKey | null => {
  const fromApp = normalizeText(payload.app);
  if (fromApp) {
    const byApp = sourceRules.find((rule) =>
      rule.aliases.some((alias) => fromApp.includes(alias)),
    );
    if (byApp) return byApp.key;
  }

  const byText = getSourceRuleFromList(text, sourceRules);
  return byText?.key ?? null;
};

export const extractCombinedText = (payload: NativeNotificationPayload): string => {
  const grouped = Array.isArray(payload.groupedMessages)
    ? payload.groupedMessages
        .flatMap((item) => [item.title, item.text])
        .filter(Boolean)
        .join(" ")
    : "";

  return normalizeWhitespace(
    [
      payload.app,
      payload.title,
      payload.titleBig,
      payload.text,
      payload.subText,
      payload.summaryText,
      payload.bigText,
      payload.extraInfoText,
      grouped,
    ]
      .filter(Boolean)
      .join(" "),
  );
};

export const extractNotificationTime = (
  payload: NativeNotificationPayload,
): Date => {
  if (typeof payload.time === "number") {
    const maybe = new Date(payload.time);
    if (!Number.isNaN(maybe.getTime())) return maybe;
  }

  if (typeof payload.time === "string") {
    const parsedNumber = Number(payload.time);
    if (Number.isFinite(parsedNumber)) {
      const maybe = new Date(parsedNumber);
      if (!Number.isNaN(maybe.getTime())) return maybe;
    }

    const maybe = new Date(payload.time);
    if (!Number.isNaN(maybe.getTime())) return maybe;
  }

  return new Date();
};

const normalizeAmountString = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;

  const numeric = cleaned
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "")
    .replace(/,/g, ".");

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

export const extractAmount = (text: string): number | null => {
  const patterns = [
    /(?:rp|idr)\s*([0-9][0-9.,]*)/i,
    /(?:jumlah|nominal|sebesar|amount|total)\s*[:\-]?\s*([0-9][0-9.,]*)/i,
    /([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?)/,
    /([0-9]{4,})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const amount = match?.[1] ? normalizeAmountString(match[1]) : null;
    if (amount) return amount;
  }

  return null;
};

export const detectDirection = (
  text: string,
  sourceRule?: SourceRule | null,
): "income" | "expense" | null => {
  const lower = text.toLowerCase();
  const positiveHits = POSITIVE_KEYWORDS.filter((keyword) =>
    lower.includes(keyword),
  ).length;
  const negativeHits = NEGATIVE_KEYWORDS.filter((keyword) =>
    lower.includes(keyword),
  ).length;

  const sourcePositiveHits = sourceRule
    ? sourceRule.incomeKeywords.filter((keyword) => lower.includes(keyword)).length
    : 0;
  const sourceNegativeHits = sourceRule
    ? sourceRule.expenseKeywords.filter((keyword) => lower.includes(keyword)).length
    : 0;

  const totalPositive = positiveHits + sourcePositiveHits;
  const totalNegative = negativeHits + sourceNegativeHits;

  if (totalPositive > totalNegative) return "income";
  if (totalNegative > totalPositive) return "expense";

  if (sourceRule) {
    if (sourceRule.incomeKeywords.some((keyword) => lower.includes(keyword))) {
      return "income";
    }
    if (sourceRule.expenseKeywords.some((keyword) => lower.includes(keyword))) {
      return "expense";
    }
  }

  if (lower.includes("kredit") || lower.includes("diterima")) return "income";
  if (lower.includes("debit") || lower.includes("terdebet")) return "expense";
  return null;
};

export const resolveCategory = (
  direction: "income" | "expense",
  text: string,
  sourceRule?: SourceRule | null,
): string => {
  const lower = text.toLowerCase();

  const keywordList =
    sourceRule && direction === "income"
      ? sourceRule.categoryIncomeKeywords
      : sourceRule && direction === "expense"
        ? sourceRule.categoryExpenseKeywords
        : direction === "income"
          ? categoryByIncomeKeyword
          : categoryByExpenseKeyword;

  const match = keywordList.find((item) => lower.includes(item.keyword));
  if (match) return match.value;

  return direction === "income" ? "others_income" : "others";
};

export const buildDescription = (
  payload: NativeNotificationPayload,
  sourceLabel: string,
  sourceRule?: SourceRule | null,
): string => {
  const fields = sourceRule?.descriptionFields ?? [
    "titleBig",
    "title",
    "text",
    "bigText",
  ];
  const parts = fields
    .map((field) => payload[field])
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const fallback = parts.length ? parts.join(" - ") : sourceLabel;
  return fallback.slice(0, 140);
};

export const buildDedupeKey = (
  payload: NativeNotificationPayload,
  sourceLabel: string,
  amount: number,
  direction: "income" | "expense",
  notificationTime: Date,
): string => {
  const text = extractCombinedText(payload);
  const bucket = Math.floor(notificationTime.getTime() / 60000);
  return simpleHash([sourceLabel, String(amount), direction, String(bucket), text].join("|"));
};

export const resolveTransaction = (
  payload: NativeNotificationPayload,
  sourceRules = NOTIFICATION_SOURCE_RULES,
): ResolvedNotificationTransaction => {
  const combinedText = extractCombinedText(payload);
  const sourceRule = getSourceRuleFromList(combinedText, sourceRules);
  const sourceKey = getSourceKey(payload, combinedText, sourceRules);
  const direction = detectDirection(combinedText, sourceRule);
  const amount = extractAmount(combinedText);

  if (!direction) {
    return { shouldImport: false, reason: "Direction not detected" };
  }

  if (!amount) {
    return { shouldImport: false, reason: "Amount not detected" };
  }

  const sourceLabel = sourceRule?.label ?? payload.app ?? "Notification";
  const sourceApp = normalizeWhitespace(payload.app) || sourceLabel;
  const notificationTime = extractNotificationTime(payload);
  const category = resolveCategory(direction, combinedText, sourceRule);
  const description = buildDescription(payload, sourceLabel, sourceRule);
  const dedupeKey = buildDedupeKey(
    payload,
    sourceLabel,
    amount,
    direction,
    notificationTime,
  );

  return {
    shouldImport: true,
    type: direction,
    amount,
    category,
    description,
    sourceApp,
    sourceLabel,
    sourceKey: sourceKey ?? undefined,
    notificationTime,
    dedupeKey,
  };
};
