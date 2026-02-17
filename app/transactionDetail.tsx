import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import {
  debtCategory,
  incomeCategory,
  transferCategory,
} from "@/constants/data";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { useCategories } from "@/contexts/categoryContext";
import useFetchData from "@/hooks/useFetchData";
import { deleteTransaction } from "@/services/transactionService";
import { WalletType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import { documentId, orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

type DebtKind = "PIUTANG" | "HUTANG";
type DebtStatus = "ONGOING" | "PAID";

type DebtDoc = {
  id?: string;
  uid: string;
  kind: DebtKind;
  personName: string;
  note?: string;
  amount: number;
  paidAmount: number;
  status?: DebtStatus;
};

type TransactionMetaDoc = {
  id?: string;
  uid?: string;
  isTransfer?: boolean;
  transferId?: string;
  transferFromId?: string;
  transferToId?: string;
};

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Description format:
 *  - [DEBT:<debtId>] ...
 *  - [PAYMENT:<debtId>] ...
 */
const parseDebtMeta = (description: string) => {
  const match = /^\[(DEBT|PAYMENT):([^\]]+)\]/i.exec(
    (description ?? "").trim(),
  );
  if (!match) return null;

  return {
    event: match[1].toUpperCase() as "DEBT" | "PAYMENT",
    debtId: String(match[2] ?? "").trim(),
  };
};

export default function TransactionDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { categories: expenseCategories, incomeCategories } = useCategories();

  const [loading, setLoading] = useState(false);

  const id = first(params.id) ?? "";
  const type = (first(params.type) ?? "expense") as "income" | "expense";
  const amount = Number(first(params.amount) ?? 0);
  const categoryValue = first(params.category) ?? "";
  const description = first(params.description) ?? "";
  const image = first(params.image) ?? "";
  const walletId = first(params.walletId) ?? "";
  const dateISO = first(params.date);

  const dateObj = useMemo(() => {
    const d = dateISO ? new Date(dateISO) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  }, [dateISO]);

  // ---- TRANSACTION META FETCH (guarded) ----
  const transactionConstraints = useMemo(() => {
    if (!id) return [];
    return [where(documentId(), "==", id)];
  }, [id]);

  const { data: transactionRaw } = useFetchData<TransactionMetaDoc>(
    id ? "transactions" : "",
    transactionConstraints,
  );

  const transactionMeta = useMemo(() => {
    const row = transactionRaw?.[0];
    if (!row) return undefined;
    if (user?.uid && row.uid && row.uid !== user.uid) return undefined;
    return row;
  }, [transactionRaw, user?.uid]);

  const isTransferTransaction = Boolean(transactionMeta?.isTransfer);

  // ---- WALLET FETCH (guarded) ----
  const walletConstraints = useMemo(() => {
    if (!user?.uid) return [];
    return [where("uid", "==", user.uid), orderBy("created", "desc")];
  }, [user?.uid]);

  const { data: walletsRaw } = useFetchData<WalletType>(
    user?.uid ? "wallets" : "",
    walletConstraints,
  );

  const wallets = useMemo(() => walletsRaw ?? [], [walletsRaw]);

  // Wallet id getter (biar match aman)
  const getWalletId = (w: WalletType) =>
    String((w as any)?.id ?? (w as any)?.docId ?? (w as any)?.walletId ?? "");

  const walletText = useMemo(() => {
    const w = wallets.find((x) => getWalletId(x) === String(walletId));
    return w?.name ?? "Wallet";
  }, [wallets, walletId]);

  const transferFromText = useMemo(() => {
    const transferFromId = String(transactionMeta?.transferFromId ?? "");
    if (!transferFromId) return "from";

    const fromWallet = wallets.find((x) => getWalletId(x) === transferFromId);
    return fromWallet?.name ?? "from";
  }, [transactionMeta?.transferFromId, wallets]);

  const transferToText = useMemo(() => {
    const transferToId = String(transactionMeta?.transferToId ?? "");
    if (!transferToId) return "to";

    const toWallet = wallets.find((x) => getWalletId(x) === transferToId);
    return toWallet?.name ?? "to";
  }, [transactionMeta?.transferToId, wallets]);

  const transferRouteText = useMemo(() => {
    if (!isTransferTransaction) return "";
    return `Transfer ${transferFromText} -> ${transferToText}`;
  }, [isTransferTransaction, transferFromText, transferToText]);

  // ---- DEBT META + DEBT FETCH (guarded) ----
  const debtMeta = useMemo(() => parseDebtMeta(description), [description]);
  const isDebtTransaction = Boolean(debtMeta?.debtId);

  const debtConstraints = useMemo(() => {
    if (!debtMeta?.debtId) return [];
    return [where(documentId(), "==", debtMeta.debtId)];
  }, [debtMeta?.debtId]);

  const { data: debtRaw } = useFetchData<DebtDoc>(
    debtMeta?.debtId ? "debts" : "",
    debtConstraints,
  );

  const debt = useMemo(() => {
    const row = debtRaw?.[0];
    if (!row) return undefined;
    if (user?.uid && row.uid && row.uid !== user.uid) return undefined;
    return row;
  }, [debtRaw, user?.uid]);

  // ---- CATEGORY ----
  const category = useMemo(() => {
    if (isDebtTransaction) return debtCategory;
    if (isTransferTransaction) return transferCategory;
    if (type === "income") {
      return (incomeCategories as any)?.[categoryValue] ?? incomeCategory;
    }
    return (
      (expenseCategories as any)?.[categoryValue] ??
      (expenseCategories as any)?.others ??
      (expenseCategories as any)?.other
    );
  }, [
    isDebtTransaction,
    isTransferTransaction,
    type,
    categoryValue,
    expenseCategories,
  ]);

  // ---- TEXTS ----
  const dateText = dateObj.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const timeText = dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const debtActionText = useMemo(() => {
    if (!debtMeta) return "";

    // Payment event
    if (debtMeta.event === "PAYMENT") {
      if (debt?.kind === "PIUTANG") return "Receive Payment";
      if (debt?.kind === "HUTANG") return "Pay Debt";
      return "Debt Payment";
    }

    // Create debt event
    if (debt?.kind === "PIUTANG") return "Create Lent Debt";
    if (debt?.kind === "HUTANG") return "Create Borrow Debt";
    return "Create Debt";
  }, [debt?.kind, debtMeta]);

  const defaultTypeText = isTransferTransaction
    ? "Transfer"
    : type === "income"
      ? "Income"
      : "Expense";

  const titleText = debtActionText || category?.label || defaultTypeText;

  const categoryText = category?.label || defaultTypeText;

  const isIncome = type === "income";
  const amountColor = isIncome ? colors.primary : colors.rose;

  const debtKindText =
    debt?.kind === "PIUTANG"
      ? "Piutang"
      : debt?.kind === "HUTANG"
        ? "Hutang"
        : "-";

  const debtStatusText =
    debt?.status === "PAID"
      ? "Paid"
      : debt?.status === "ONGOING"
        ? "Ongoing"
        : "-";

  const noteText = useMemo(() => {
    if (isTransferTransaction) return transferRouteText;
    if (isDebtTransaction) return String(debt?.note ?? "").trim();
    return String(description ?? "").trim();
  }, [
    isTransferTransaction,
    transferRouteText,
    isDebtTransaction,
    debt?.note,
    description,
  ]);

  // ---- ACTIONS ----
  const onOpenDebt = () => {
    if (!debtMeta?.debtId) return;
    router.push({
      pathname: "/debtDetail",
      params: { id: debtMeta.debtId },
    });
  };

  const onEdit = () => {
    if (isDebtTransaction) {
      Alert.alert(
        "Debt Transaction",
        "Transaksi ini dikelola otomatis dari fitur Debt. Edit dari Debt Detail.",
      );
      return;
    }

    router.push({
      pathname: "/(modals)/transactionModal",
      params: {
        id,
        type,
        amount: String(amount),
        category: categoryValue,
        date: dateObj.toISOString(),
        description,
        image,
        walletId,
      },
    });
  };

  const onDelete = async () => {
    if (isDebtTransaction) {
      Alert.alert(
        "Debt Transaction",
        "Transaksi debt tidak bisa dihapus dari sini. Hapus dari Debt Detail.",
      );
      return;
    }

    if (!id) {
      Alert.alert("Error", "id transaksi tidak ditemukan.");
      return;
    }

    setLoading(true);
    const res = await deleteTransaction(id);
    setLoading(false);

    if (res.success) router.back();
    else Alert.alert("Delete", res.msg);
  };

  const confirmDelete = () => {
    if (loading) return;
    Alert.alert("Hapus transaksi?", "Aksi ini tidak bisa dibatalkan.", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Transaction Detail"
          leftIcon={<BackButton />}
          style={{ paddingTop: scale(10) }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: isIncome ? "#10221A" : "#2A1012" },
              ]}
            >
              {isIncome ? (
                <Icons.ArrowUp
                  size={verticalScale(36)}
                  color={colors.primary}
                  weight="bold"
                />
              ) : (
                <Icons.ArrowDown
                  size={verticalScale(36)}
                  color={colors.rose}
                  weight="bold"
                />
              )}
            </View>

            <Typo
              size={34}
              fontWeight={"900"}
              color={amountColor}
              style={{ marginTop: spacingY._10 }}
            >
              {isIncome ? "+" : "-"}
              {formatRupiah(amount)}
            </Typo>

            <Typo
              size={14}
              color={colors.neutral400}
              style={{ marginTop: spacingY._5 }}
            >
              {isDebtTransaction
                ? "Debt Transaction"
                : isTransferTransaction
                  ? "Transfer"
                : isIncome
                  ? "Income"
                  : "Expense"}
            </Typo>
          </View>

          <View style={styles.card}>
            <Row label="Title" value={titleText} />
            <Divider />
            <Row label="Category" value={categoryText} />
            <Divider />
            <Row label="Wallet" value={walletText} />
            <Divider />
            <Row label="Date" value={dateText} />
            <Divider />
            <Row label="Time" value={timeText} />

            {isDebtTransaction && (
              <>
                <Divider />
                <Row label="Debt Type" value={debtKindText} />
                <Divider />
                <Row label="Person" value={debt?.personName ?? "-"} />
                <Divider />
                <Row label="Debt Status" value={debtStatusText} />
              </>
            )}

            {!!noteText && (
              <>
                <Divider />
                <Row
                  label={
                    isDebtTransaction
                      ? "Debt Note"
                      : isTransferTransaction
                        ? "Transfer Note"
                        : "Note"
                  }
                  value={noteText}
                />
              </>
            )}

            {!!image && (
              <>
                <Divider />
                <View style={{ gap: spacingY._10 }}>
                  <Typo size={14} color={colors.neutral400}>
                    Attachment
                  </Typo>
                  <View style={styles.attachmentWrap}>
                    <Image
                      source={{ uri: image }}
                      style={styles.attachment}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {isDebtTransaction && debtMeta?.debtId && (
          <View style={styles.bottomTabs}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.btn,
                styles.btnEdit,
                loading && { opacity: 0.5 },
              ]}
              onPress={onOpenDebt}
              disabled={loading}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: scale(10),
                }}
              >
                <Icons.ReceiptIcon
                  size={verticalScale(20)}
                  color={colors.black}
                  weight="bold"
                />
                <Typo fontWeight={"900"} color={colors.black}>
                  Open Debt
                </Typo>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {!isDebtTransaction && (
          <View style={styles.bottomTabs}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.btn,
                styles.btnDanger,
                loading && { opacity: 0.5 },
              ]}
              onPress={confirmDelete}
              disabled={loading}
            >
              <Icons.Trash
                size={verticalScale(20)}
                color={colors.rose}
                weight="bold"
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.btn,
                styles.btnEdit,
                loading && { opacity: 0.5 },
              ]}
              onPress={onEdit}
              disabled={loading}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: scale(10),
                }}
              >
                <Icons.PencilSimpleLine
                  size={verticalScale(20)}
                  color={colors.black}
                  weight="bold"
                />
                <Typo fontWeight={"900"} color={colors.black}>
                  Edit
                </Typo>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Typo size={14} color={colors.neutral400}>
        {label}
      </Typo>
      <Typo
        size={16}
        fontWeight={"700"}
        style={{ maxWidth: "65%", textAlign: "right" }}
      >
        {value}
      </Typo>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(110),
  },

  hero: {
    alignItems: "center",
    paddingTop: spacingY._20,
    paddingBottom: spacingY._10,
  },
  heroIcon: {
    width: verticalScale(90),
    height: verticalScale(90),
    borderRadius: verticalScale(90),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral800,
  },

  card: {
    marginTop: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingY._15,
    gap: spacingY._12,
    backgroundColor: colors.neutral900,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacingX._12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral800,
  },

  openDebtBtn: {
    height: verticalScale(44),
    borderRadius: radius._12,
    backgroundColor: colors.neutral200,
    borderWidth: 1,
    borderColor: colors.neutral200,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: scale(8),
  },

  attachmentWrap: {
    borderRadius: radius._17,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.neutral800,
  },
  attachment: {
    width: "100%",
    height: verticalScale(160),
  },

  bottomTabs: {
    position: "absolute",
    left: spacingY._20,
    right: spacingY._20,
    bottom: spacingY._15,
    flexDirection: "row",
    gap: scale(12),
  },
  btn: {
    height: verticalScale(58),
    borderRadius: radius._17,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.neutral800,
    backgroundColor: colors.neutral900,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacingX._15,
  },
  btnDanger: {
    width: verticalScale(70),
    backgroundColor: "#2A1012",
    borderColor: "#3A1518",
  },
  btnEdit: {
    flex: 1,
    backgroundColor: colors.neutral200,
    borderColor: colors.neutral200,
  },
});
