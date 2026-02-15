import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { expenseCategories, incomeCategory } from "@/constants/data";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import { deleteTransaction } from "@/services/transactionService";
import { WalletType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import { orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Image, StyleSheet, TouchableOpacity, View } from "react-native";

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default function TransactionDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const { data: wallets } = useFetchData<WalletType>("wallets", [
    where("uid", "==", user?.uid),
    orderBy("created", "desc"),
  ]);

  const [loading, setLoading] = useState(false);

  const id = first(params.id) ?? "";
  const type = (first(params.type) ?? "expense") as any;
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

  const category = useMemo(() => {
    if (type === "income") return incomeCategory;
    return expenseCategories[categoryValue as any];
  }, [type, categoryValue]);

  const titleText =
    category?.label ?? (type === "income" ? "Income" : "Expense");

  const walletText = useMemo(() => {
    const w = wallets.find((x) => (x.id as any) === walletId);
    return w?.name ?? "Wallet";
  }, [wallets, walletId]);

  const dateText = dateObj.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const timeText = dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const onEdit = () => {
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
    if (!id || !walletId) {
      Alert.alert("Error", "id / walletId tidak ditemukan.");
      return;
    }
    setLoading(true);
    const res = await deleteTransaction(id, walletId);
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

  const isIncome = type === "income";
  const amountColor = isIncome ? colors.primary : colors.rose;

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Transaction Detail"
          leftIcon={<BackButton />}
          style={{ paddingTop: scale(10) }}
        />

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
            {isIncome ? "Income" : "Expense"}
          </Typo>
        </View>

        <View style={styles.card}>
          <Row label="Title" value={titleText} />
          <Divider />
          <Row label="Category" value={titleText} />
          <Divider />
          <Row label="Wallet" value={walletText} />
          <Divider />
          <Row label="Date" value={dateText} />
          <Divider />
          <Row label="Time" value={timeText} />

          {!!description?.trim() && (
            <>
              <Divider />
              <Row label="Note" value={description} />
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

        {/* spacer biar ga ketutup bottom tabs */}
        <View style={{ height: verticalScale(90) }} />

        {/* bottom action tabs */}
        <View style={styles.bottomTabs}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.btn, styles.btnDanger, loading && { opacity: 0.5 }]}
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
            style={[styles.btn, styles.btnEdit, loading && { opacity: 0.5 }]}
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
